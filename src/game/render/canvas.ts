import type { CatchObject } from "@/osu/toCatch";
import { PLAYFIELD_WIDTH } from "@/osu/types";
import type { Catcher } from "../catcher";
import { BURST_DURATION_MS, type ComboBurst, type HitEffect } from "../engine";
import type { Particle } from "../particles";
import type { ScoreSnapshot } from "../scoring";
import { TokenAtlas } from "./tokens";

/** Fraction of the playfield height at which the plate sits. */
const CATCHER_LINE = 0.86;

/** Object sizes in playfield units (0..512 across). */
const FRUIT_DIAMETER = 38;
const DROPLET_RADIUS = 7;
const BANANA_RADIUS = 13;

/*
 * the-next-craft's palette. There is no accent hue in it on purpose: the sponsor
 * tokens are the only colour on screen, which is what makes them read as the
 * subject of the game rather than as decoration on it.
 */
const VOID = "#1a1a17";
const LINE = "#8c8a82";
const BRIGHT = "#e9e7de";
const TEXT = "#f2f0e9";
const TEXT_DIM = "#a2a096";
const BONE = "#e6e3d8";
const KEY_SHADOW = "#8c8a82";
const DESTRUCTIVE = "#f87171";

const GRID_SIZE = 46;

/** Peak displacement of the shake, in pixels. */
const MAX_SHAKE_PX = 9;
const PIXEL_FONT = '"Silkscreen", ui-monospace, monospace';
const MONO_FONT = '"IBM Plex Mono", ui-monospace, monospace';

/** Combo burst timing, in ms within BURST_DURATION_MS. */
const BURST_SLIDE_MS = 260;
const BURST_FADE_AT_MS = 1100;

export interface Frame {
	objects: CatchObject[];
	effects: HitEffect[];
	particles: readonly Particle[];
	bursts: ComboBurst[];
	catcher: Catcher;
	chartTimeMs: number;
	fallDuration: number;
	snapshot: ScoreSnapshot;
	/** 0..1 through the played window. */
	progress: number;
	/** 1 immediately after a catch, decaying to 0. Drives the plate impact. */
	catchFlash: number;
	/** 1 immediately after a drop, decaying to 0. Drives the screen shake. */
	missShake: number;
}

export interface Rect {
	x: number;
	y: number;
	width: number;
	height: number;
}

export class CanvasRenderer {
	private readonly canvas: HTMLCanvasElement;
	private readonly ctx: CanvasRenderingContext2D;
	private atlas: TokenAtlas | null = null;

	constructor(canvas: HTMLCanvasElement) {
		this.canvas = canvas;
		const ctx = canvas.getContext("2d", { alpha: false });
		if (!ctx) throw new Error("Canvas 2D is unavailable");
		this.ctx = ctx;
	}

	async ready(): Promise<void> {
		this.atlas = await TokenAtlas.load();
	}

	/** Where the 512-unit playfield lands in CSS pixels. Also maps pointer input. */
	playfieldRect(cssWidth: number, cssHeight: number): Rect {
		// Capped against height and centred. Letting the 512-unit field stretch the
		// full width of a wide monitor does not change difficulty — catcher speed is
		// in playfield units — but it flattens the fall into an unreadable smear.
		const margin = Math.min(cssWidth * 0.04, 48);
		const width = Math.min(cssWidth - margin * 2, cssHeight * 1.15);
		return { x: (cssWidth - width) / 2, y: 0, width, height: cssHeight };
	}

	draw(frame: Frame): void {
		const { width, height } = this.resize();
		const field = this.playfieldRect(width, height);
		const scale = field.width / PLAYFIELD_WIDTH;
		const lineY = field.height * CATCHER_LINE;
		const ctx = this.ctx;

		// Painted before the shake so the displaced playfield never exposes an edge.
		ctx.fillStyle = VOID;
		ctx.fillRect(0, 0, width, height);

		ctx.save();
		if (frame.missShake > 0) {
			// Squared so the jolt is sharp and settles quickly rather than wobbling out.
			const amount = frame.missShake ** 2 * MAX_SHAKE_PX;
			ctx.translate((Math.random() * 2 - 1) * amount, (Math.random() * 2 - 1) * amount);
		}

		this.drawField(field, lineY);

		for (const object of frame.objects) {
			const remaining = object.time - frame.chartTimeMs;
			if (remaining < 0) continue;
			const y = lineY - (remaining / frame.fallDuration) * lineY;
			this.drawObject(object, field.x + object.x * scale, y, scale);
		}

		this.drawParticles(frame, field, scale, lineY);
		this.drawEffects(frame, field, scale, lineY);
		this.drawCatcher(frame, field, scale, lineY);
		ctx.restore();

		// Bursts and the HUD stay still — a score that jitters is just hard to read.
		this.drawBursts(frame, width, height);
		this.drawHud(frame, width, height);
	}

	/** Keeps the backing store matched to CSS size and device pixel ratio. */
	private resize(): { width: number; height: number } {
		const ratio = Math.min(2, window.devicePixelRatio || 1);
		const width = this.canvas.clientWidth;
		const height = this.canvas.clientHeight;

		const targetWidth = Math.round(width * ratio);
		const targetHeight = Math.round(height * ratio);
		if (this.canvas.width !== targetWidth || this.canvas.height !== targetHeight) {
			this.canvas.width = targetWidth;
			this.canvas.height = targetHeight;
		}

		this.ctx.setTransform(ratio, 0, 0, ratio, 0, 0);
		return { width, height };
	}

	/** The same 46px blueprint grid the landing page uses as its background. */
	private drawField(field: Rect, lineY: number): void {
		const ctx = this.ctx;

		ctx.strokeStyle = "rgba(140, 138, 130, 0.09)";
		ctx.lineWidth = 1;
		ctx.beginPath();
		for (let x = field.x; x <= field.x + field.width; x += GRID_SIZE) {
			ctx.moveTo(Math.round(x) + 0.5, 0);
			ctx.lineTo(Math.round(x) + 0.5, lineY);
		}
		for (let y = lineY; y >= 0; y -= GRID_SIZE) {
			ctx.moveTo(field.x, Math.round(y) + 0.5);
			ctx.lineTo(field.x + field.width, Math.round(y) + 0.5);
		}
		ctx.stroke();

		ctx.strokeStyle = "rgba(140, 138, 130, 0.55)";
		ctx.lineWidth = 1;
		ctx.beginPath();
		ctx.moveTo(field.x, Math.round(lineY) + 0.5);
		ctx.lineTo(field.x + field.width, Math.round(lineY) + 0.5);
		ctx.stroke();
	}

	private drawObject(object: CatchObject, x: number, y: number, scale: number): void {
		const ctx = this.ctx;

		if (object.kind === "fruit") {
			const size = FRUIT_DIAMETER * scale;
			const token = this.atlas?.forCombo(object.comboIndex);
			if (token) ctx.drawImage(token, x - size / 2, y - size / 2, size, size);
			return;
		}

		if (object.kind === "droplet") {
			ctx.fillStyle = TEXT_DIM;
			ctx.beginPath();
			ctx.arc(x, y, DROPLET_RADIUS * scale, 0, Math.PI * 2);
			ctx.fill();
			return;
		}

		// Banana: a hollow diamond. Distinct from a filled droplet at a glance, so a
		// bonus object never reads as something you are being punished for missing.
		const r = BANANA_RADIUS * scale;
		ctx.strokeStyle = BRIGHT;
		ctx.lineWidth = Math.max(1.5, 2 * scale);
		ctx.beginPath();
		ctx.moveTo(x, y - r);
		ctx.lineTo(x + r, y);
		ctx.lineTo(x, y + r);
		ctx.lineTo(x - r, y);
		ctx.closePath();
		ctx.stroke();
	}

	/** Particles carry playfield coordinates; only this converts them to pixels. */
	private drawParticles(frame: Frame, field: Rect, scale: number, lineY: number): void {
		const ctx = this.ctx;

		for (const particle of frame.particles) {
			ctx.globalAlpha = Math.max(0, particle.life / particle.maxLife);
			ctx.fillStyle = particle.color;
			ctx.beginPath();
			ctx.arc(
				field.x + particle.x * scale,
				lineY + particle.y * scale,
				particle.size * scale,
				0,
				Math.PI * 2,
			);
			ctx.fill();
		}

		ctx.globalAlpha = 1;
	}

	private drawEffects(frame: Frame, field: Rect, scale: number, lineY: number): void {
		const ctx = this.ctx;

		for (const effect of frame.effects) {
			const age = (frame.chartTimeMs - effect.bornAtMs) / 400;
			if (age < 0 || age > 1) continue;

			const x = field.x + effect.x * scale;
			ctx.globalAlpha = 1 - age;

			if (effect.missed) {
				ctx.strokeStyle = DESTRUCTIVE;
				ctx.lineWidth = 2;
				const r = 10 + age * 26;
				ctx.beginPath();
				ctx.moveTo(x - r, lineY - r);
				ctx.lineTo(x + r, lineY + r);
				ctx.moveTo(x + r, lineY - r);
				ctx.lineTo(x - r, lineY + r);
				ctx.stroke();
			} else {
				// The catch ring borrows the sponsor's colour — the one place the
				// monochrome field is allowed to flash.
				const sponsor = this.atlas?.sponsorForCombo(effect.comboIndex);
				ctx.strokeStyle = sponsor?.color ?? BRIGHT;
				ctx.lineWidth = 3 * (1 - age);
				ctx.beginPath();
				ctx.arc(x, lineY, 12 + age * 44, 0, Math.PI * 2);
				ctx.stroke();
			}
		}

		ctx.globalAlpha = 1;
	}

	/**
	 * The plate is a C64 keycap: bone, hard-edged, with the same 3px extruded
	 * shadow the landing page puts under its buttons. Dashing lifts it off that
	 * shadow — their `:active` state, run in reverse — and a catch presses it down.
	 */
	private drawCatcher(frame: Frame, field: Rect, scale: number, lineY: number): void {
		const ctx = this.ctx;
		const { catcher, catchFlash } = frame;

		const width = catcher.width * scale;
		const press = catchFlash * 2.5;
		const height = 16 - press * 0.5;
		const left = field.x + catcher.x * scale - width / 2;
		const lift = (catcher.dashing ? 3 : 0) - press;
		const top = lineY - height - lift;
		const radius = 4;

		ctx.fillStyle = KEY_SHADOW;
		ctx.beginPath();
		ctx.roundRect(left, top + 3, width, height, radius);
		ctx.fill();

		ctx.fillStyle = catcher.dashing || catchFlash > 0.15 ? "#f8f6ee" : BONE;
		ctx.strokeStyle = KEY_SHADOW;
		ctx.lineWidth = 1;
		ctx.beginPath();
		ctx.roundRect(left, top, width, height, radius);
		ctx.fill();
		ctx.stroke();

		// A brief halo so a catch registers even when the plate is off in the corner.
		if (catchFlash > 0) {
			ctx.globalAlpha = catchFlash * 0.5;
			ctx.strokeStyle = BRIGHT;
			ctx.lineWidth = 2;
			ctx.beginPath();
			ctx.roundRect(left - 4, top - 4, width + 8, height + 8, radius + 3);
			ctx.stroke();
			ctx.globalAlpha = 1;
		}
	}

	/**
	 * osu!'s combo bursts, with sponsors in place of anime characters: at each
	 * milestone one slides in from the edge, holds, and fades. They cycle through
	 * the roster rather than following the fruit, so every sponsor gets airtime
	 * over a session regardless of which logos happened to spawn.
	 */
	private drawBursts(frame: Frame, width: number, height: number): void {
		const ctx = this.ctx;
		const size = Math.min(190, width * 0.17);

		for (const burst of frame.bursts) {
			const age = frame.chartTimeMs - burst.bornAtMs;
			if (age < 0 || age > BURST_DURATION_MS) continue;

			const slide = easeOut(Math.min(1, age / BURST_SLIDE_MS));
			const alpha =
				age > BURST_FADE_AT_MS
					? 1 - (age - BURST_FADE_AT_MS) / (BURST_DURATION_MS - BURST_FADE_AT_MS)
					: 1;

			const token = this.atlas?.forCombo(burst.sponsorIndex);
			const sponsor = this.atlas?.sponsorForCombo(burst.sponsorIndex);
			if (!token || !sponsor) continue;

			const edge = 28;
			const hidden = size + edge + 40;
			const x =
				burst.side === "left"
					? edge - hidden * (1 - slide)
					: width - edge - size + hidden * (1 - slide);
			const y = height * 0.34;

			ctx.globalAlpha = alpha;
			ctx.drawImage(token, x, y, size, size);

			ctx.textAlign = burst.side === "left" ? "left" : "right";
			const textX = burst.side === "left" ? x : x + size;

			ctx.font = `700 ${Math.round(size * 0.2)}px ${PIXEL_FONT}`;
			ctx.fillStyle = TEXT;
			ctx.textBaseline = "top";
			ctx.fillText(`${burst.combo}x`, textX, y + size + 14);

			ctx.font = `600 12px ${MONO_FONT}`;
			ctx.fillStyle = sponsor.color;
			ctx.letterSpacing = "0.12em";
			ctx.fillText(sponsor.name.toUpperCase(), textX, y + size + 14 + size * 0.26);
			ctx.letterSpacing = "0px";

			ctx.globalAlpha = 1;
		}
	}

	private drawHud(frame: Frame, width: number, height: number): void {
		const ctx = this.ctx;
		const { snapshot } = frame;

		ctx.fillStyle = "rgba(140, 138, 130, 0.25)";
		ctx.fillRect(0, 0, width, 3);
		ctx.fillStyle = BRIGHT;
		ctx.fillRect(0, 0, width * frame.progress, 3);

		ctx.textBaseline = "top";

		ctx.font = `700 26px ${PIXEL_FONT}`;
		ctx.fillStyle = TEXT;
		ctx.textAlign = "right";
		ctx.fillText(String(snapshot.score).padStart(8, "0"), width - 24, 24);

		ctx.font = `500 13px ${MONO_FONT}`;
		ctx.fillStyle = TEXT_DIM;
		ctx.fillText(`${(snapshot.accuracy * 100).toFixed(2)}%`, width - 24, 58);

		ctx.textAlign = "left";
		ctx.font = `700 28px ${PIXEL_FONT}`;
		ctx.fillStyle = TEXT;
		ctx.fillText(`${snapshot.combo}x`, 24, 24);

		if (snapshot.multiplier > 1) {
			ctx.font = `600 12px ${MONO_FONT}`;
			ctx.fillStyle = BRIGHT;
			ctx.letterSpacing = "0.12em";
			ctx.fillText(`COMBO ${snapshot.multiplier}X`, 24, 58);
			ctx.letterSpacing = "0px";
		}

		ctx.textAlign = "center";
		ctx.font = `500 11px ${MONO_FONT}`;
		ctx.fillStyle = LINE;
		ctx.letterSpacing = "0.12em";
		ctx.fillText(
			"LEFT / RIGHT MOVE    SHIFT OR SPACE DASH    ESC MENU",
			width / 2,
			height - 26,
		);
		ctx.letterSpacing = "0px";
	}
}

function easeOut(t: number): number {
	return 1 - (1 - t) ** 3;
}
