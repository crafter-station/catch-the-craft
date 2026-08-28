import { type CatchObject, catcherWidthFor } from "@/osu/toCatch";
import { PLAYFIELD_WIDTH } from "@/osu/types";
import { menuContext } from "./audio/menu-audio";
import { SampleBank } from "./audio/samples";
import { audioSettings, effectsVolume, subscribeAudioSettings } from "./audio/settings";
import { Catcher, type MoveDirection } from "./catcher";
import { type HitEffect, MISS_SHAKE_MS } from "./engine";
import { ParticleField } from "./particles";
import { CanvasRenderer } from "./render/canvas";
import { SPONSORS } from "./render/tokens";
import { ScoreTracker } from "./scoring";

/**
 * The guided first run.
 *
 * Deliberately a separate engine rather than a mode inside `GameEngine`. A real
 * run is driven by an audio clock and cannot be held still for a prompt; a
 * tutorial is the opposite — it waits for the player and spawns the next thing
 * only once they have done the last one. Bolting that onto the run loop would
 * have meant threading "am I teaching right now" through timing code that was
 * already hard enough to get right. The renderer, plate, hitsounds and particles
 * are shared, so what a beginner learns here looks and feels exactly like the
 * game they are about to play.
 */

export type TutorialStepId = "move" | "catch" | "dash" | "combo" | "done";

export interface TutorialState {
	step: TutorialStepId;
	/** How much of the current step is done, and how much it asks for. */
	done: number;
	goal: number;
}

/** Wide, forgiving plate — easier than any difficulty we ship. */
const TUTORIAL_CIRCLE_SIZE = 2.5;

/** Playfield units the plate must travel before "move" is considered learned. */
const MOVE_GOAL_UNITS = 700;

const STEPS: Record<Exclude<TutorialStepId, "done">, { goal: number; fallMs: number }> = {
	// Slower than any real chart. A first-timer needs time to see a thing fall,
	// work out where it will land, and get there.
	move: { goal: MOVE_GOAL_UNITS, fallMs: 1700 },
	catch: { goal: 5, fallMs: 1700 },
	dash: { goal: 3, fallMs: 1500 },
	combo: { goal: 8, fallMs: 1400 },
};

const ORDER: TutorialStepId[] = ["move", "catch", "dash", "combo", "done"];

/** Gap between fruit once they come as a stream rather than one at a time. */
const COMBO_SPAWN_INTERVAL_MS = 700;

/** Beat after a fruit resolves before the next appears, in the solo steps. */
const RESPAWN_DELAY_MS = 260;

const TUTORIAL_DONE_KEY = "ctb.tutorial.done";

const MOVEMENT_KEYS = new Set([
	"ArrowLeft",
	"ArrowRight",
	"KeyA",
	"KeyD",
	"ShiftLeft",
	"ShiftRight",
	"Space",
]);

const DASH_KEYS = new Set(["Space", "ShiftLeft", "ShiftRight"]);

export interface TutorialOptions {
	canvas: HTMLCanvasElement;
	onState: (state: TutorialState) => void;
	onExit: () => void;
}

export class TutorialEngine {
	private readonly options: TutorialOptions;
	private readonly renderer: CanvasRenderer;
	private readonly catcher: Catcher;
	private readonly particles = new ParticleField();
	private readonly score = new ScoreTracker();

	private samples: SampleBank | null = null;
	private unsubscribeAudio: (() => void) | null = null;

	private frame = 0;
	private lastFrameMs = 0;
	private nowMs = 0;
	private disposed = false;

	private stepIndex = 0;
	private progressInStep = 0;
	private objects: CatchObject[] = [];
	private effects: HitEffect[] = [];
	private spawnCount = 0;
	private nextSpawnAtMs = 0;

	private lastCatchAtMs = Number.NEGATIVE_INFINITY;
	private lastMissAtMs = Number.NEGATIVE_INFINITY;
	private lastPlateX: number;

	private readonly held = new Set<string>();
	private pointerDriven = false;

	constructor(options: TutorialOptions) {
		this.options = options;
		this.renderer = new CanvasRenderer(options.canvas);
		this.catcher = new Catcher(catcherWidthFor(TUTORIAL_CIRCLE_SIZE));
		this.lastPlateX = this.catcher.x;
	}

	async start(): Promise<void> {
		// The menus' context, not a new one: the theme keeps playing under the
		// tutorial, and a second context would be one more thing to keep alive.
		const context = await menuContext();

		const [samples] = await Promise.all([SampleBank.load(context), this.renderer.ready()]);
		if (this.disposed) return;

		this.samples = samples;
		this.applyAudioSettings();
		this.unsubscribeAudio = subscribeAudioSettings(() => this.applyAudioSettings());

		this.attachInput();
		this.lastFrameMs = performance.now();
		this.emit();
		this.frame = requestAnimationFrame(this.tick);
	}

	private applyAudioSettings(): void {
		this.samples?.setVolume(effectsVolume(audioSettings()));
	}

	private get step(): TutorialStepId {
		return ORDER[this.stepIndex];
	}

	private get fallDuration(): number {
		const step = this.step;
		return step === "done" ? STEPS.combo.fallMs : STEPS[step].fallMs;
	}

	private emit(): void {
		const step = this.step;
		this.options.onState({
			step,
			done: Math.floor(this.progressInStep),
			goal: step === "done" ? 0 : STEPS[step].goal,
		});
	}

	/** Moves to the next step. Also what SKIP calls, so there is one path. */
	advance(): void {
		this.stepIndex = Math.min(this.stepIndex + 1, ORDER.length - 1);
		this.progressInStep = 0;
		this.objects = [];
		this.score.reset();
		this.nextSpawnAtMs = this.nowMs + 700;
		this.emit();

		if (this.step !== "done") return;

		try {
			localStorage.setItem(TUTORIAL_DONE_KEY, "1");
		} catch {
			// Private browsing. The tutorial still ran; only the flag is lost.
		}
	}

	private readonly tick = (): void => {
		if (this.disposed) return;

		const wallNow = performance.now();
		const deltaMs = Math.min(50, wallNow - this.lastFrameMs);
		this.lastFrameMs = wallNow;
		this.nowMs += deltaMs;

		this.catcher.dashing = this.isDashing();
		this.catcher.update(deltaMs, this.direction());

		this.trackMovement();
		this.spawnIfDue();
		this.resolveReached();
		this.particles.update(deltaMs);

		this.renderer.draw({
			objects: this.objects,
			effects: this.effects,
			particles: this.particles.all,
			// No sponsor bursts: a card sliding across the playfield while someone
			// is still finding the plate competes with the one instruction they are
			// supposed to be reading.
			bursts: [],
			catcher: this.catcher,
			chartTimeMs: this.nowMs,
			fallDuration: this.fallDuration,
			snapshot: this.score.snapshot(),
			progress: this.stepIndex / (ORDER.length - 1),
			catchFlash: Math.max(0, 1 - (this.nowMs - this.lastCatchAtMs) / 140),
			missShake: Math.max(0, 1 - (this.nowMs - this.lastMissAtMs) / MISS_SHAKE_MS),
			partnerIndex: 0,
		});

		this.effects = this.effects.filter((e) => this.nowMs - e.bornAtMs < 400);
		this.frame = requestAnimationFrame(this.tick);
	};

	/** The "move" step is done once the plate has covered enough ground. */
	private trackMovement(): void {
		const travelled = Math.abs(this.catcher.x - this.lastPlateX);
		this.lastPlateX = this.catcher.x;
		if (this.step !== "move") return;

		this.progressInStep = Math.min(MOVE_GOAL_UNITS, this.progressInStep + travelled);
		this.emit();
		if (this.progressInStep >= MOVE_GOAL_UNITS) this.advance();
	}

	private spawnIfDue(): void {
		const step = this.step;
		if (step === "move" || step === "done") return;
		if (this.nowMs < this.nextSpawnAtMs) return;

		// One at a time while a skill is being learned, so a second fruit never
		// steals attention from the one being explained. Combo is the exception:
		// a streak needs a stream to build on.
		if (step !== "combo" && this.objects.length > 0) return;

		this.objects.push({
			id: this.spawnCount + 1,
			kind: "fruit",
			x: this.spawnX(step),
			time: this.nowMs + STEPS[step].fallMs,
			comboIndex: this.spawnCount,
		});
		this.spawnCount++;
		this.nextSpawnAtMs =
			step === "combo" ? this.nowMs + COMBO_SPAWN_INTERVAL_MS : Number.POSITIVE_INFINITY;
	}

	private spawnX(step: Exclude<TutorialStepId, "done">): number {
		const plate = this.catcher.x;

		// Close to where they already are: the lesson is "it lands where it lands",
		// not "sprint across the screen".
		if (step === "catch") return clamp(plate + (Math.random() * 2 - 1) * 110);

		// Deliberately across the field, so holding dash is the obvious way to
		// arrive in time on a keyboard.
		if (step === "dash") {
			return plate < PLAYFIELD_WIDTH / 2
				? clamp(PLAYFIELD_WIDTH - 60 - Math.random() * 90)
				: clamp(60 + Math.random() * 90);
		}

		return clamp(plate + (Math.random() * 2 - 1) * 190);
	}

	private resolveReached(): void {
		const remaining: CatchObject[] = [];

		for (const object of this.objects) {
			if (object.time > this.nowMs) {
				remaining.push(object);
				continue;
			}

			if (this.catcher.catches(object.x)) this.onCaught(object);
			else this.onMissed(object);
		}

		this.objects = remaining;
	}

	private onCaught(object: CatchObject): void {
		this.score.hit("fruit");
		this.samples?.play("fruit");
		this.lastCatchAtMs = this.nowMs;

		const sponsor = SPONSORS[object.comboIndex % SPONSORS.length];
		this.particles.emit(this.catcher.x, 0, sponsor.color, 12, 1);
		this.effects.push({
			x: this.catcher.x,
			bornAtMs: this.nowMs,
			missed: false,
			comboIndex: object.comboIndex,
		});

		const step = this.step;
		if (step === "done" || step === "move") return;

		// Dash counts only when it was actually held. Both input modes can satisfy
		// that — a mouse reaches anywhere on its own, so requiring the key is what
		// teaches it, where requiring a distance would be trivial with a mouse.
		if (step === "dash" && !this.catcher.dashing) {
			this.nextSpawnAtMs = this.nowMs + RESPAWN_DELAY_MS;
			return;
		}

		this.progressInStep += 1;
		this.emit();

		if (this.progressInStep >= STEPS[step].goal) this.advance();
		else if (step !== "combo") this.nextSpawnAtMs = this.nowMs + RESPAWN_DELAY_MS;
	}

	private onMissed(object: CatchObject): void {
		this.score.miss("fruit");
		this.samples?.play("comboBreak");
		this.lastMissAtMs = this.nowMs;
		this.effects.push({
			x: object.x,
			bornAtMs: this.nowMs,
			missed: true,
			comboIndex: object.comboIndex,
		});

		// Nothing is ever taken away for missing — the step simply asks again,
		// which is the whole difference between a tutorial and a run. Combo is the
		// one place a drop has to bite, because that is the lesson.
		if (this.step === "combo") this.progressInStep = 0;
		else this.nextSpawnAtMs = this.nowMs + RESPAWN_DELAY_MS;
		this.emit();
	}

	private isDashing(): boolean {
		return this.held.has("ShiftLeft") || this.held.has("ShiftRight") || this.held.has("Space");
	}

	private direction(): MoveDirection {
		if (this.pointerDriven) return 0;
		const left = this.held.has("ArrowLeft") || this.held.has("KeyA");
		const right = this.held.has("ArrowRight") || this.held.has("KeyD");
		if (left === right) return 0;
		return left ? -1 : 1;
	}

	private attachInput(): void {
		window.addEventListener("keydown", this.onKeyDown);
		window.addEventListener("keyup", this.onKeyUp);
		this.options.canvas.addEventListener("pointermove", this.onPointerMove);
		this.options.canvas.addEventListener("pointerdown", this.onPointerMove);
	}

	private readonly onKeyDown = (event: KeyboardEvent): void => {
		if (event.code === "Escape") {
			event.preventDefault();
			this.options.onExit();
			return;
		}

		if (!MOVEMENT_KEYS.has(event.code)) return;
		// Space scrolls the page and re-triggers focused buttons if left alone.
		event.preventDefault();

		// Dash is held on the keyboard but has to keep working for someone
		// steering with the mouse, so it alone does not seize control from them.
		if (!DASH_KEYS.has(event.code)) {
			this.pointerDriven = false;
			this.catcher.setPointerTarget(null);
		}
		this.held.add(event.code);
	};

	private readonly onKeyUp = (event: KeyboardEvent): void => {
		this.held.delete(event.code);
	};

	private readonly onPointerMove = (event: PointerEvent): void => {
		const rect = this.options.canvas.getBoundingClientRect();
		const playfield = this.renderer.playfieldRect(rect.width, rect.height);
		const x = ((event.clientX - rect.left - playfield.x) / playfield.width) * PLAYFIELD_WIDTH;

		this.pointerDriven = true;
		this.catcher.setPointerTarget(x);
	};

	dispose(): void {
		this.disposed = true;
		this.unsubscribeAudio?.();
		cancelAnimationFrame(this.frame);
		this.samples?.dispose();
		window.removeEventListener("keydown", this.onKeyDown);
		window.removeEventListener("keyup", this.onKeyUp);
		this.options.canvas.removeEventListener("pointermove", this.onPointerMove);
		this.options.canvas.removeEventListener("pointerdown", this.onPointerMove);
	}
}

function clamp(x: number): number {
	return Math.min(PLAYFIELD_WIDTH - 12, Math.max(12, x));
}

/** Drives the "new here?" nudge on the title screen. */
export function hasDoneTutorial(): boolean {
	try {
		return localStorage.getItem(TUTORIAL_DONE_KEY) === "1";
	} catch {
		return true; // Cannot tell, so do not nag.
	}
}
