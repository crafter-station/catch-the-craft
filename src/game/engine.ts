import type { CatchBeatmap, CatchObject } from "@/osu/toCatch";
import { PLAYFIELD_WIDTH } from "@/osu/types";
import { SampleBank } from "./audio/samples";
import { VoiceBank } from "./audio/voice";
import {
	audioSettings,
	effectsVolume,
	musicVolume,
	subscribeAudioSettings,
} from "./audio/settings";
import { Catcher, type MoveDirection } from "./catcher";
import { AudioClock } from "./clock";
import { ParticleField } from "./particles";
import { CanvasRenderer } from "./render/canvas";
import { SPONSORS } from "./render/tokens";
import { type ScoreSnapshot, ScoreTracker } from "./scoring";

/** Silence before the music starts, so the first objects are already falling. */
const LEAD_IN_MS = 1500;

/** Shorter run-up after unpausing — the player is already oriented. */
const RESUME_LEAD_IN_MS = 1200;

/** Baseline latency compensation, nudged at the booth with `[` and `]`. */
const DEFAULT_OFFSET_MS = 0;

/** Combo values that fire a sponsor burst, then every 50 after the last one. */
const BURST_MILESTONES = [10, 25, 50, 100];
const BURST_INTERVAL = 50;

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
	onPauseChange?: (paused: boolean) => void;
}

export interface HitEffect {
	x: number;
	bornAtMs: number;
	missed: boolean;
	comboIndex: number;
}

/** An osu!-style combo burst: a sponsor sliding in at a combo milestone. */
export interface ComboBurst {
	sponsorIndex: number;
	combo: number;
	bornAtMs: number;
	side: "left" | "right";
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
	private readonly particles = new ParticleField();

	private clock: AudioClock | null = null;
	private context: AudioContext | null = null;
	private samples: SampleBank | null = null;
	private voice: VoiceBank | null = null;
	private frame = 0;
	private lastFrameMs = 0;

	/** Index of the earliest object that has not yet reached the plate. */
	private nextIndex = 0;
	private effects: HitEffect[] = [];
	private bursts: ComboBurst[] = [];
	private burstCount = 0;
	private nextBurstCombo = BURST_MILESTONES[0];

	/** Chart time of the most recent catch, for the plate impact flash. */
	private lastCatchAtMs = Number.NEGATIVE_INFINITY;

	/** Chart time of the most recent break, for the screen shake. */
	private lastMissAtMs = Number.NEGATIVE_INFINITY;

	private readonly held = new Set<string>();
	private inputMode: InputMode = "keyboard";
	private disposed = false;
	private unsubscribeAudio: (() => void) | null = null;
	private ended = false;
	private paused = false;
	private pausedAtMs = 0;

	constructor(options: EngineOptions) {
		this.options = options;
		this.catcher = new Catcher(options.beatmap.catcherWidth);
		this.renderer = new CanvasRenderer(options.canvas);
	}

	get offsetMs(): number {
		return this.clock?.offsetMs ?? DEFAULT_OFFSET_MS;
	}

	get isPaused(): boolean {
		return this.paused;
	}

	private applyAudioSettings(): void {
		const settings = audioSettings();
		this.clock?.setVolume(musicVolume(settings));
		this.samples?.setVolume(effectsVolume(settings));
		this.voice?.setVolume(effectsVolume(settings));
	}

	async start(): Promise<void> {
		// One context for the music and the hitsounds. Two would drift apart.
		this.context = new AudioContext();
		if (this.context.state === "suspended") await this.context.resume();

		const [clock, samples, voice] = await Promise.all([
			AudioClock.load(this.options.audioUrl, this.context),
			SampleBank.load(this.context),
			VoiceBank.load(this.context),
			this.renderer.ready(),
		]);

		this.clock = clock;
		this.clock.offsetMs = DEFAULT_OFFSET_MS;
		this.samples = samples;
		this.voice = voice;

		// Stored levels apply immediately, and keep applying while the run is going
		// so the pause menu's sliders are audible the moment they move.
		this.applyAudioSettings();
		this.unsubscribeAudio = subscribeAudioSettings(() => this.applyAudioSettings());

		this.attachInput();
		this.clock.start(this.options.startMs, LEAD_IN_MS);
		this.lastFrameMs = performance.now();
		this.frame = requestAnimationFrame(this.tick);
	}

	/**
	 * Chart time is the audio playback position, full stop.
	 *
	 * The clock already counts through the lead-in — it reports negative time
	 * until playback actually begins — so nothing here may subtract it again.
	 * Doing so silently lands every object a lead-in behind the music, which
	 * looks completely correct on screen and is obvious the moment you listen.
	 */
	private chartTime(): number {
		return this.clock?.timeMs ?? 0;
	}

	private readonly tick = (): void => {
		if (this.disposed || this.paused) return;

		const wallNow = performance.now();
		const deltaMs = Math.min(50, wallNow - this.lastFrameMs);
		this.lastFrameMs = wallNow;

		const chartTime = this.chartTime();

		this.catcher.dashing = this.isDashing();
		this.catcher.update(deltaMs, this.direction());

		this.resolveReachedObjects(chartTime);
		this.particles.update(deltaMs);

		const { startMs, durationMs, beatmap } = this.options;
		const endMs = startMs + durationMs;
		const progress = Math.min(1, Math.max(0, (chartTime - startMs) / durationMs));

		this.renderer.draw({
			objects: this.visibleObjects(chartTime),
			effects: this.effects,
			particles: this.particles.all,
			bursts: this.bursts,
			catcher: this.catcher,
			chartTimeMs: chartTime,
			fallDuration: beatmap.fallDuration,
			snapshot: this.score.snapshot(),
			progress,
			catchFlash: Math.max(0, 1 - (chartTime - this.lastCatchAtMs) / 140),
			missShake: Math.max(0, 1 - (chartTime - this.lastMissAtMs) / MISS_SHAKE_MS),
		});

		this.effects = this.effects.filter((e) => chartTime - e.bornAtMs < 400);
		this.bursts = this.bursts.filter((b) => chartTime - b.bornAtMs < BURST_DURATION_MS);
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

		while (this.nextIndex < objects.length && objects[this.nextIndex].time <= chartTime) {
			const object = objects[this.nextIndex++];
			if (object.time < this.options.startMs) continue; // before the played window

			const before = this.score.snapshot();
			const caught = this.catcher.catches(object.x);
			if (caught) this.score.hit(object.kind);
			else this.score.miss(object.kind);
			const after = this.score.snapshot();

			if (caught) {
				this.samples?.play(object.kind);
				if (after.multiplier > before.multiplier) this.samples?.play("comboUp");
				this.onCaught(object, chartTime, after);
			} else if (object.kind !== "banana") {
				// Dropping something shakes the screen whether or not a combo was
				// running — the jolt is feedback that you missed, not that you lost a streak.
				this.lastMissAtMs = chartTime;
				if (before.combo > 0) {
					// Only an actual break is worth a sound; missing from zero is not news.
					this.samples?.play("comboBreak");
					this.nextBurstCombo = BURST_MILESTONES[0];
				}
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

	private onCaught(object: CatchObject, chartTime: number, after: ScoreSnapshot): void {
		this.lastCatchAtMs = chartTime;

		const sponsor = SPONSORS[object.comboIndex % SPONSORS.length];
		const colour =
			object.kind === "fruit" ? sponsor.color : object.kind === "banana" ? "#e9e7de" : "#a2a096";
		const count = object.kind === "fruit" ? 12 : object.kind === "banana" ? 8 : 4;

		this.particles.emit(
			this.catcher.x,
			0,
			colour,
			count,
			object.kind === "fruit" ? 1 : 0.7,
		);

		if (after.combo >= this.nextBurstCombo) this.pushBurst(after.combo, chartTime);
	}

	/** Cycles sponsors so every one of them gets screen time across a session. */
	private pushBurst(combo: number, chartTime: number): void {
		const sponsorIndex = this.burstCount % SPONSORS.length;

		this.bursts.push({
			sponsorIndex,
			combo,
			bornAtMs: chartTime,
			side: this.burstCount % 2 === 0 ? "right" : "left",
		});
		this.burstCount++;

		// The announcer names whichever sponsor the burst is showing.
		this.voice?.play(SPONSORS[sponsorIndex].slug);

		const next = BURST_MILESTONES.find((m) => m > combo);
		this.nextBurstCombo = next ?? combo + BURST_INTERVAL;
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

	private isDashing(): boolean {
		return (
			this.held.has("ShiftLeft") || this.held.has("ShiftRight") || this.held.has("Space")
		);
	}

	private direction(): MoveDirection {
		if (this.inputMode === "pointer") return 0;
		const left = this.held.has("ArrowLeft") || this.held.has("KeyA");
		const right = this.held.has("ArrowRight") || this.held.has("KeyD");
		if (left === right) return 0;
		return left ? -1 : 1;
	}

	// ─── Pause ────────────────────────────────────────────────────────────

	pause(): void {
		if (this.paused || this.ended || !this.clock) return;

		this.pausedAtMs = this.chartTime();
		this.clock.stop();
		cancelAnimationFrame(this.frame);
		this.paused = true;
		this.held.clear();
		this.options.onPauseChange?.(true);
	}

	/**
	 * Resumes a little before where the player left off, so objects are already
	 * falling again when control returns rather than landing the instant it does.
	 */
	resume(): void {
		if (!this.paused || this.ended || !this.clock) return;

		this.paused = false;
		this.clock.start(this.pausedAtMs, RESUME_LEAD_IN_MS);
		this.lastFrameMs = performance.now();
		this.frame = requestAnimationFrame(this.tick);
		this.options.onPauseChange?.(false);
	}

	togglePause(): void {
		if (this.paused) this.resume();
		else this.pause();
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

	// ─── Input ────────────────────────────────────────────────────────────

	private attachInput(): void {
		window.addEventListener("keydown", this.onKeyDown);
		window.addEventListener("keyup", this.onKeyUp);
		this.options.canvas.addEventListener("pointermove", this.onPointerMove);
		this.options.canvas.addEventListener("pointerdown", this.onPointerMove);
	}

	private readonly onKeyDown = (event: KeyboardEvent): void => {
		if (event.code === "Escape") {
			event.preventDefault();
			this.togglePause();
			return;
		}

		if (event.code === "BracketLeft" || event.code === "BracketRight") {
			if (this.clock) {
				this.clock.offsetMs += event.code === "BracketLeft" ? -5 : 5;
			}
			return;
		}

		if (MOVEMENT_KEYS.has(event.code)) {
			// Space scrolls the page and re-triggers focused buttons if left alone.
			event.preventDefault();
			if (this.paused) return;
			this.inputMode = "keyboard";
			this.catcher.setPointerTarget(null);
			this.held.add(event.code);
		}
	};

	private readonly onKeyUp = (event: KeyboardEvent): void => {
		this.held.delete(event.code);
	};

	private readonly onPointerMove = (event: PointerEvent): void => {
		if (this.paused) return;

		const rect = this.options.canvas.getBoundingClientRect();
		const playfield = this.renderer.playfieldRect(rect.width, rect.height);
		const x = ((event.clientX - rect.left - playfield.x) / playfield.width) * PLAYFIELD_WIDTH;

		this.inputMode = "pointer";
		this.held.clear();
		this.catcher.setPointerTarget(x);
	};

	dispose(): void {
		this.disposed = true;
		this.unsubscribeAudio?.();
		cancelAnimationFrame(this.frame);
		this.clock?.dispose();
		this.samples?.dispose();
		this.voice?.dispose();
		void this.context?.close();
		window.removeEventListener("keydown", this.onKeyDown);
		window.removeEventListener("keyup", this.onKeyUp);
		this.options.canvas.removeEventListener("pointermove", this.onPointerMove);
		this.options.canvas.removeEventListener("pointerdown", this.onPointerMove);
	}
}

/** How long a combo burst stays on screen, in ms. */
export const BURST_DURATION_MS = 1500;

/** How long the screen keeps shaking after a drop. */
export const MISS_SHAKE_MS = 260;

const MOVEMENT_KEYS = new Set([
	"ArrowLeft",
	"ArrowRight",
	"KeyA",
	"KeyD",
	"ShiftLeft",
	"ShiftRight",
	"Space",
]);
