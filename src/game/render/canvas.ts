import type { CatchObject } from "@/osu/toCatch";
import { PLAYFIELD_WIDTH } from "@/osu/types";
import type { Catcher } from "../catcher";
import type { HitEffect } from "../engine";
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
const PIXEL_FONT = '"Silkscreen", ui-monospace, monospace';
const MONO_FONT = '"IBM Plex Mono", ui-monospace, monospace';

export interface Frame {
	objects: CatchObject[];
	effects: HitEffect[];
	catcher: Catcher;
	chartTimeMs: number;
	fallDuration: number;
	snapshot: ScoreSnapshot;
	/** 0..1 through the played window. */
	progress: number;
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

		ctx.fillStyle = VOID;
		ctx.fillRect(0, 0, width, height);

		this.drawField(field, lineY);

		for (const object of frame.objects) {
			const remaining = object.time - frame.chartTimeMs;
			if (remaining < 0) continue;
			const y = lineY - (remaining / frame.fallDuration) * lineY;
			this.drawObject(object, field.x + object.x * scale, y, scale);
		}

		this.drawEffects(frame, field, scale, lineY);
		this.drawCatcher(frame.catcher, field, scale, lineY);
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
	 * shadow — their `:active` state, run in reverse.
	 */
	private drawCatcher(catcher: Catcher, field: Rect, scale: number, lineY: number): void {
		const ctx = this.ctx;
		const width = catcher.width * scale;
		const height = 16;
		const left = field.x + catcher.x * scale - width / 2;
		const top = lineY - height;
		const radius = 4;
		const lift = catcher.dashing ? 3 : 0;

		ctx.fillStyle = KEY_SHADOW;
		ctx.beginPath();
		ctx.roundRect(left, top - lift + 3, width, height, radius);
		ctx.fill();

		ctx.fillStyle = catcher.dashing ? "#f4f2ea" : BONE;
		ctx.strokeStyle = KEY_SHADOW;
		ctx.lineWidth = 1;
		ctx.beginPath();
		ctx.roundRect(left, top - lift, width, height, radius);
		ctx.fill();
		ctx.stroke();
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
		ctx.fillText("LEFT / RIGHT MOVE    SHIFT DASH    MOUSE TO AIM", width / 2, height - 26);
		ctx.letterSpacing = "0px";
	}
}
