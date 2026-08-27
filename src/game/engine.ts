import type { CatchBeatmap, CatchObject } from "@/osu/toCatch";
import { PLAYFIELD_WIDTH } from "@/osu/types";
import { Catcher, type MoveDirection } from "./catcher";
import { SampleBank } from "./audio/samples";
import { AudioClock } from "./clock";
import { CanvasRenderer } from "./render/canvas";
import { type ScoreSnapshot, ScoreTracker } from "./scoring";

/** Silence before the music starts, so the first objects are already falling. */
const LEAD_IN_MS = 1500;

/** Baseline latency compensation, nudged at the booth with `[` and `]`. */
const DEFAULT_OFFSET_MS = 0;

export type InputMode = "keyboard" | "pointer";

export interface RunResult extends ScoreSnapshot {
	slug: string;
	tier: string;
}

export interface EngineOptions {
	canvas: HTMLCanvasElement;
	beatmap: CatchBeatmap;
	audioUrl: string;
	slug: string;
	tier: string;
	/** Window of the track that is played, in ms. */
	startMs: number;
	durationMs: number;
	onUpdate?: (snapshot: ScoreSnapshot, progress: number) => void;
	onEnd?: (result: RunResult) => void;
}

export interface HitEffect {
	x: number;
	bornAtMs: number;
	missed: boolean;
	comboIndex: number;
}

/**
 * Owns the run: the clock, the plate, the score, and the frame loop.
 *
 * Deliberately plain — no React state and no observables. Every frame reads the
 * audio clock and writes to a canvas, so a React re-render can never stall a
 * frame or desync the chart.
 */
export class GameEngine {
	private readonly options: EngineOptions;
	private readonly renderer: CanvasRenderer;
	private readonly catcher: Catcher;
	private readonly score = new ScoreTracker();

	private clock: AudioClock | null = null;
	private context: AudioContext | null = null;
	private samples: SampleBank | null = null;
	private frame = 0;
	private lastFrameMs = 0;

	/** Index of the earliest object that has not yet reached the plate. */
	private nextIndex = 0;
	private effects: HitEffect[] = [];

	private readonly held = new Set<string>();
	private inputMode: InputMode = "keyboard";
	private disposed = false;
	private ended = false;

	constructor(options: EngineOptions) {
		this.options = options;
		this.catcher = new Catcher(options.beatmap.catcherWidth);
		this.renderer = new CanvasRenderer(options.canvas);
	}

	get offsetMs(): number {
		return this.clock?.offsetMs ?? DEFAULT_OFFSET_MS;
	}

	async start(): Promise<void> {
		// One context for the music and the hitsounds. Two would drift apart.
		this.context = new AudioContext();
		if (this.context.state === "suspended") await this.context.resume();

		const [clock, samples] = await Promise.all([
			AudioClock.load(this.options.audioUrl, this.context),
			SampleBank.load(this.context),
			this.renderer.ready(),
		]);

		this.clock = clock;
		this.clock.offsetMs = DEFAULT_OFFSET_MS;
		this.samples = samples;

		this.attachInput();
		// Rewind by the lead-in so objects fall into an empty plate before the music.
		this.clock.start(this.options.startMs, LEAD_IN_MS);
		this.lastFrameMs = performance.now();
		this.frame = requestAnimationFrame(this.tick);
	}

	private readonly tick = (): void => {
		if (this.disposed) return;

		const wallNow = performance.now();
		const deltaMs = Math.min(50, wallNow - this.lastFrameMs);
		this.lastFrameMs = wallNow;

		const chartTime = (this.clock?.timeMs ?? 0) - LEAD_IN_MS;

		this.catcher.dashing =
			this.held.has("ShiftLeft") || this.held.has("ShiftRight");
		this.catcher.update(deltaMs, this.direction());

		this.resolveReachedObjects(chartTime);

		const { startMs, durationMs, beatmap } = this.options;
		const endMs = startMs + durationMs;
		const progress = Math.min(
			1,
			Math.max(0, (chartTime - startMs) / durationMs),
		);

		this.renderer.draw({
			objects: this.visibleObjects(chartTime),
			effects: this.effects,
			catcher: this.catcher,
			chartTimeMs: chartTime,
			fallDuration: beatmap.fallDuration,
			snapshot: this.score.snapshot(),
			progress,
		});

		this.effects = this.effects.filter((e) => chartTime - e.bornAtMs < 400);
		this.options.onUpdate?.(this.score.snapshot(), progress);

		const outOfObjects = this.nextIndex >= beatmap.objects.length;
		if (!this.ended && (chartTime >= endMs || outOfObjects)) {
			this.finish();
			return;
		}

		this.frame = requestAnimationFrame(this.tick);
	};

	/**
	 * osu!catch has no timing window: an object is caught if the plate covers its
	 * x at the exact moment it reaches the plate line. So resolution is a single
	 * pass over every object whose time has elapsed since the last frame.
	 */
	private resolveReachedObjects(chartTime: number): void {
		const { objects } = this.options.beatmap;

		while (
			this.nextIndex < objects.length &&
			objects[this.nextIndex].time <= chartTime
		) {
			const object = objects[this.nextIndex++];
			if (object.time < this.options.startMs) continue; // before the played window

			const before = this.score.snapshot();
			const caught = this.catcher.catches(object.x);
			if (caught) this.score.hit(object.kind);
			else this.score.miss(object.kind);
			const after = this.score.snapshot();

			if (caught) {
				this.samples?.play(object.kind);
				// Announce the multiplier stepping up, not every catch inside a tier.
				if (after.multiplier > before.multiplier) this.samples?.play("comboUp");
			} else if (object.kind !== "banana" && before.combo > 0) {
				// Only an actual break is worth a sound; missing from zero combo is not news.
				this.samples?.play("comboBreak");
			}

			if (object.kind !== "droplet" || !caught) {
				this.effects.push({
					x: caught ? this.catcher.x : object.x,
					bornAtMs: chartTime,
					missed: !caught,
					comboIndex: object.comboIndex,
				});
			}
		}
	}

	private visibleObjects(chartTime: number): CatchObject[] {
		const { objects, fallDuration } = this.options.beatmap;
		const horizon = chartTime + fallDuration;
		const visible: CatchObject[] = [];

		for (let i = this.nextIndex; i < objects.length; i++) {
			if (objects[i].time > horizon) break;
			visible.push(objects[i]);
		}
		return visible;
	}

	private direction(): MoveDirection {
		if (this.inputMode === "pointer") return 0;
		const left = this.held.has("ArrowLeft") || this.held.has("KeyA");
		const right = this.held.has("ArrowRight") || this.held.has("KeyD");
		if (left === right) return 0;
		return left ? -1 : 1;
	}

	private finish(): void {
		this.ended = true;
		this.clock?.stop();
		cancelAnimationFrame(this.frame);
		this.options.onEnd?.({
			...this.score.snapshot(),
			slug: this.options.slug,
			tier: this.options.tier,
		});
	}

	private attachInput(): void {
		window.addEventListener("keydown", this.onKeyDown);
		window.addEventListener("keyup", this.onKeyUp);
		this.options.canvas.addEventListener("pointermove", this.onPointerMove);
		this.options.canvas.addEventListener("pointerdown", this.onPointerMove);
	}

	private readonly onKeyDown = (event: KeyboardEvent): void => {
		if (event.code === "BracketLeft" || event.code === "BracketRight") {
			if (this.clock) {
				this.clock.offsetMs += event.code === "BracketLeft" ? -5 : 5;
			}
			return;
		}

		if (MOVEMENT_KEYS.has(event.code)) {
			event.preventDefault();
			this.inputMode = "keyboard";
			this.catcher.setPointerTarget(null);
			this.held.add(event.code);
		}
	};

	private readonly onKeyUp = (event: KeyboardEvent): void => {
		this.held.delete(event.code);
	};

	private readonly onPointerMove = (event: PointerEvent): void => {
		const rect = this.options.canvas.getBoundingClientRect();
		const playfield = this.renderer.playfieldRect(rect.width, rect.height);
		const x =
			((event.clientX - rect.left - playfield.x) / playfield.width) *
			PLAYFIELD_WIDTH;

		this.inputMode = "pointer";
		this.held.clear();
		this.catcher.setPointerTarget(x);
	};

	dispose(): void {
		this.disposed = true;
		cancelAnimationFrame(this.frame);
		this.clock?.dispose();
		this.samples?.dispose();
		void this.context?.close();
		window.removeEventListener("keydown", this.onKeyDown);
		window.removeEventListener("keyup", this.onKeyUp);
		this.options.canvas.removeEventListener("pointermove", this.onPointerMove);
		this.options.canvas.removeEventListener("pointerdown", this.onPointerMove);
	}
}

const MOVEMENT_KEYS = new Set([
	"ArrowLeft",
	"ArrowRight",
	"KeyA",
	"KeyD",
	"ShiftLeft",
	"ShiftRight",
]);
