import type { Beatmap, CurveType, HitObject, TimingPoint, Vec2 } from "./types";

const NEW_COMBO_FLAG = 1 << 2;
const TYPE_CIRCLE = 1 << 0;
const TYPE_SLIDER = 1 << 1;
const TYPE_SPINNER = 1 << 3;

function num(value: string | undefined, fallback = 0): number {
	if (value === undefined) return fallback;
	const parsed = Number.parseFloat(value.trim());
	return Number.isFinite(parsed) ? parsed : fallback;
}

/**
 * Parses a `.osu` file. Tolerant by design: real beatmaps come from a decade of
 * format versions, so missing keys fall back rather than throw. The one thing we
 * do reject is a file with no hit objects, which is never a usable map.
 */
export function parseOsu(source: string): Beatmap {
	const text = source.replace(/^\uFEFF/, "").replace(/\r\n/g, "\n");

	const beatmap: Beatmap = {
		formatVersion: num(/^osu file format v(\d+)/.exec(text)?.[1], 14),
		general: { audioFilename: "", audioLeadIn: 0, previewTime: -1, mode: 0 },
		metadata: {
			title: "",
			titleUnicode: "",
			artist: "",
			artistUnicode: "",
			creator: "",
			version: "",
			beatmapId: 0,
			beatmapSetId: 0,
		},
		difficulty: {
			hpDrainRate: 5,
			circleSize: 5,
			overallDifficulty: 5,
			approachRate: Number.NaN, // resolved to OD below if the file omits it
			sliderMultiplier: 1.4,
			sliderTickRate: 1,
		},
		timingPoints: [],
		hitObjects: [],
	};

	let section = "";

	for (const rawLine of text.split("\n")) {
		const line = rawLine.trim();
		if (line === "" || line.startsWith("//")) continue;

		if (line.startsWith("[") && line.endsWith("]")) {
			section = line.slice(1, -1);
			continue;
		}

		switch (section) {
			case "General":
			case "Metadata":
			case "Difficulty":
				applyKeyValue(beatmap, section, line);
				break;
			case "TimingPoints":
				beatmap.timingPoints.push(parseTimingPoint(line));
				break;
			case "HitObjects": {
				const object = parseHitObject(line);
				if (object) beatmap.hitObjects.push(object);
				break;
			}
			default:
				break; // [Events], [Colours], [Editor] are irrelevant to gameplay
		}
	}

	if (!Number.isFinite(beatmap.difficulty.approachRate)) {
		beatmap.difficulty.approachRate = beatmap.difficulty.overallDifficulty;
	}

	if (beatmap.hitObjects.length === 0) {
		throw new Error("Beatmap contains no hit objects");
	}

	beatmap.timingPoints.sort((a, b) => a.time - b.time);
	beatmap.hitObjects.sort((a, b) => a.time - b.time);

	return beatmap;
}

function applyKeyValue(beatmap: Beatmap, section: string, line: string): void {
	const split = line.indexOf(":");
	if (split === -1) return;
	const key = line.slice(0, split).trim();
	const value = line.slice(split + 1).trim();

	if (section === "General") {
		const general = beatmap.general;
		if (key === "AudioFilename") general.audioFilename = value;
		else if (key === "AudioLeadIn") general.audioLeadIn = num(value);
		else if (key === "PreviewTime") general.previewTime = num(value, -1);
		else if (key === "Mode") general.mode = num(value);
		return;
	}

	if (section === "Metadata") {
		const metadata = beatmap.metadata;
		if (key === "Title") metadata.title = value;
		else if (key === "TitleUnicode") metadata.titleUnicode = value;
		else if (key === "Artist") metadata.artist = value;
		else if (key === "ArtistUnicode") metadata.artistUnicode = value;
		else if (key === "Creator") metadata.creator = value;
		else if (key === "Version") metadata.version = value;
		else if (key === "BeatmapID") metadata.beatmapId = num(value);
		else if (key === "BeatmapSetID") metadata.beatmapSetId = num(value);
		return;
	}

	const difficulty = beatmap.difficulty;
	if (key === "HPDrainRate") difficulty.hpDrainRate = num(value, 5);
	else if (key === "CircleSize") difficulty.circleSize = num(value, 5);
	else if (key === "OverallDifficulty")
		difficulty.overallDifficulty = num(value, 5);
	else if (key === "ApproachRate") difficulty.approachRate = num(value, 5);
	else if (key === "SliderMultiplier")
		difficulty.sliderMultiplier = num(value, 1.4);
	else if (key === "SliderTickRate") difficulty.sliderTickRate = num(value, 1);
}

function parseTimingPoint(line: string): TimingPoint {
	const parts = line.split(",");
	const beatLength = num(parts[1], 500);
	// Pre-v5 files omit the uninherited column; those points are all uninherited.
	const uninherited = parts[6] === undefined ? true : num(parts[6], 1) !== 0;

	return {
		time: num(parts[0]),
		// An inherited point stores negative inverse velocity here, not a beat length.
		beatLength: uninherited ? beatLength : 0,
		sliderVelocity: uninherited ? 1 : clampVelocity(-100 / beatLength),
		meter: num(parts[2], 4),
		uninherited,
		kiai: (num(parts[7]) & 1) !== 0,
	};
}

function clampVelocity(velocity: number): number {
	if (!Number.isFinite(velocity) || velocity <= 0) return 1;
	return Math.min(10, Math.max(0.1, velocity));
}

function parseHitObject(line: string): HitObject | null {
	const parts = line.split(",");
	if (parts.length < 4) return null;

	const x = num(parts[0]);
	const y = num(parts[1]);
	const time = num(parts[2]);
	const type = num(parts[3]);
	const newCombo = (type & NEW_COMBO_FLAG) !== 0;

	if (type & TYPE_SLIDER) {
		const curve = parts[5] ?? "";
		const segments = curve.split("|");
		const curveType = (segments[0] || "B").toUpperCase() as CurveType;

		const points: Vec2[] = [{ x, y }];
		for (const segment of segments.slice(1)) {
			const [px, py] = segment.split(":");
			points.push({ x: num(px), y: num(py) });
		}

		return {
			type: "slider",
			x,
			y,
			time,
			newCombo,
			curveType,
			points,
			slides: Math.max(1, Math.round(num(parts[6], 1))),
			pixelLength: Math.max(0, num(parts[7])),
		};
	}

	if (type & TYPE_SPINNER) {
		return {
			type: "spinner",
			x,
			y,
			time,
			newCombo,
			endTime: Math.max(time, num(parts[5], time)),
		};
	}

	if (type & TYPE_CIRCLE) {
		return { type: "circle", x, y, time, newCombo };
	}

	return null; // mania hold notes and anything else we do not play
}
