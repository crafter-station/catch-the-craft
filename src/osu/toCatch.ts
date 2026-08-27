import { buildSliderPath } from "./curve";
import { type Beatmap, PLAYFIELD_WIDTH, type TimingPoint } from "./types";

export type CatchObjectKind = "fruit" | "droplet" | "banana";

export interface CatchObject {
	id: number;
	kind: CatchObjectKind;
	/** Playfield x in 0..512. */
	x: number;
	/** Time the object reaches the catcher, in ms from the start of the audio. */
	time: number;
	/** Combo this object belongs to. Drives which sponsor token is drawn. */
	comboIndex: number;
}

export interface CatchBeatmap {
	objects: CatchObject[];
	/** Catcher width in playfield units. */
	catcherWidth: number;
	/** How long an object is visible while falling, in ms. */
	fallDuration: number;
	/** Objects that break combo when missed (everything except bananas). */
	maxCombo: number;
}

const CATCHER_BASE_SIZE = 106.75;
const ALLOWED_CATCH_RANGE = 0.8;
const BASE_SCORING_DISTANCE = 100;

/** osu!'s catcher scale: lower circle size means a wider catcher. */
export function catcherWidthFor(circleSize: number): number {
	const scale = 1 - (0.7 * (circleSize - 5)) / 5;
	return CATCHER_BASE_SIZE * Math.abs(scale) * ALLOWED_CATCH_RANGE;
}

/** osu!'s approach-rate preempt, which in catch is the fall duration. */
export function fallDurationFor(approachRate: number): number {
	if (approachRate < 5) return 1200 + (600 * (5 - approachRate)) / 5;
	if (approachRate > 5) return 1200 - (750 * (approachRate - 5)) / 5;
	return 1200;
}

/**
 * Converts parsed hit objects into the stream of falling objects catch plays.
 *
 * Circles become fruit, sliders become a juice stream (fruit at each span
 * endpoint, droplets on the tick grid between them), and spinners become a
 * banana shower. Banana x positions are seeded from the beatmap id so every
 * player at the booth gets an identical chart — a random shower would make the
 * leaderboard unfair.
 */
export function toCatchBeatmap(beatmap: Beatmap): CatchBeatmap {
	const objects: CatchObject[] = [];
	const random = mulberry32(beatmap.metadata.beatmapId || 1);
	const timing = new TimingLookup(beatmap.timingPoints);

	let comboIndex = -1;
	let id = 0;

	const push = (kind: CatchObjectKind, x: number, time: number): void => {
		objects.push({
			id: id++,
			kind,
			x: clampToPlayfield(x),
			time,
			comboIndex: Math.max(0, comboIndex),
		});
	};

	for (const object of beatmap.hitObjects) {
		if (object.newCombo || comboIndex === -1) comboIndex++;

		if (object.type === "circle") {
			push("fruit", object.x, object.time);
			continue;
		}

		if (object.type === "spinner") {
			// Matches osu!'s shower spacing: halve until under 100ms per banana.
			let spacing = object.endTime - object.time;
			while (spacing > 100) spacing /= 2;
			if (spacing <= 0) continue;

			for (let time = object.time; time <= object.endTime; time += spacing) {
				push("banana", random() * PLAYFIELD_WIDTH, time);
			}
			continue;
		}

		const point = timing.at(object.time);
		const scoringDistance =
			BASE_SCORING_DISTANCE *
			beatmap.difficulty.sliderMultiplier *
			point.sliderVelocity;
		const velocity = scoringDistance / point.beatLength; // playfield units per ms
		if (!Number.isFinite(velocity) || velocity <= 0) {
			push("fruit", object.x, object.time);
			continue;
		}

		const path = buildSliderPath(
			object.curveType,
			object.points,
			object.pixelLength,
		);
		const spanDuration = object.pixelLength / velocity;
		const tickInterval =
			point.beatLength / Math.max(0.1, beatmap.difficulty.sliderTickRate);

		for (let span = 0; span < object.slides; span++) {
			const spanStart = object.time + span * spanDuration;
			const reversed = span % 2 === 1;
			const atProgress = (progress: number) =>
				path.pointAt(reversed ? 1 - progress : progress).x;

			// Fruit at the head of every span — the slider start and each repeat.
			push("fruit", atProgress(0), spanStart);

			for (
				let offset = tickInterval;
				offset < spanDuration - 1;
				offset += tickInterval
			) {
				push("droplet", atProgress(offset / spanDuration), spanStart + offset);
			}
		}

		// Fruit at the slider tail.
		const endReversed = (object.slides - 1) % 2 === 1;
		push(
			"fruit",
			path.pointAt(endReversed ? 0 : 1).x,
			object.time + object.slides * spanDuration,
		);
	}

	objects.sort((a, b) => a.time - b.time);

	return {
		objects,
		catcherWidth: catcherWidthFor(beatmap.difficulty.circleSize),
		fallDuration: fallDurationFor(beatmap.difficulty.approachRate),
		maxCombo: objects.reduce(
			(total, o) => total + (o.kind === "banana" ? 0 : 1),
			0,
		),
	};
}

function clampToPlayfield(x: number): number {
	return Math.min(PLAYFIELD_WIDTH, Math.max(0, x));
}

/** Resolves the beat length and slider velocity in effect at a given time. */
class TimingLookup {
	private readonly points: TimingPoint[];

	constructor(points: TimingPoint[]) {
		this.points = points;
	}

	at(time: number): { beatLength: number; sliderVelocity: number } {
		let beatLength = 500;
		let sliderVelocity = 1;
		let seenUninherited = false;

		for (const point of this.points) {
			if (point.time > time) break;
			if (point.uninherited) {
				beatLength = point.beatLength;
				sliderVelocity = 1; // an uninherited point resets velocity
				seenUninherited = true;
			} else {
				sliderVelocity = point.sliderVelocity;
			}
		}

		// Maps occasionally open with an inherited point before any uninherited one.
		if (!seenUninherited) {
			const first = this.points.find((p) => p.uninherited);
			if (first) beatLength = first.beatLength;
		}

		return { beatLength, sliderVelocity };
	}
}

function mulberry32(seed: number): () => number {
	let state = seed >>> 0;
	return () => {
		state = (state + 0x6d2b79f5) >>> 0;
		let t = state;
		t = Math.imul(t ^ (t >>> 15), t | 1);
		t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
		return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
	};
}
