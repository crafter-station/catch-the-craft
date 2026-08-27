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

const PHOSPHOR = "#33FF66";
const PHOSPHOR_DIM = "rgba(51, 255, 102, 0.28)";
const BACKGROUND = "#070B07";

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

	/** Where the 512-unit playfield lands in CSS pixels. Also used to map pointer input. */
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

		ctx.fillStyle = BACKGROUND;
		ctx.fillRect(0, 0, width, height);

		this.drawField(field, lineY);

		for (const object of frame.objects) {
			const remaining = object.time - frame.chartTimeMs;
			if (remaining < 0) continue;
			const y = lineY - (remaining / frame.fallDuration) * lineY;
			const x = field.x + object.x * scale;
			this.drawObject(object, x, y, scale);
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
		if (
			this.canvas.width !== targetWidth ||
			this.canvas.height !== targetHeight
		) {
			this.canvas.width = targetWidth;
			this.canvas.height = targetHeight;
		}

		this.ctx.setTransform(ratio, 0, 0, ratio, 0, 0);
		return { width, height };
	}

	private drawField(field: Rect, lineY: number): void {
		const ctx = this.ctx;

		ctx.strokeStyle = "rgba(51, 255, 102, 0.10)";
		ctx.lineWidth = 1;
		for (let i = 1; i < 8; i++) {
			const x = field.x + (field.width / 8) * i;
			ctx.beginPath();
			ctx.moveTo(x, 0);
			ctx.lineTo(x, lineY);
			ctx.stroke();
		}

		ctx.strokeStyle = PHOSPHOR_DIM;
		ctx.lineWidth = 2;
		ctx.beginPath();
		ctx.moveTo(field.x, lineY);
		ctx.lineTo(field.x + field.width, lineY);
		ctx.stroke();
	}

	private drawObject(
		object: CatchObject,
		x: number,
		y: number,
		scale: number,
	): void {
		const ctx = this.ctx;

		if (object.kind === "fruit") {
			const size = FRUIT_DIAMETER * scale;
			const token = this.atlas?.forCombo(object.comboIndex);
			if (token) {
				ctx.drawImage(token, x - size / 2, y - size / 2, size, size);
			}
			return;
		}

		if (object.kind === "droplet") {
			ctx.fillStyle = PHOSPHOR;
			ctx.beginPath();
			ctx.arc(x, y, DROPLET_RADIUS * scale, 0, Math.PI * 2);
			ctx.fill();
			return;
		}

		// Banana: a diamond, so a bonus object never reads as a fruit you must catch.
		const r = BANANA_RADIUS * scale;
		ctx.fillStyle = "#FFD23F";
		ctx.beginPath();
		ctx.moveTo(x, y - r);
		ctx.lineTo(x + r, y);
		ctx.lineTo(x, y + r);
		ctx.lineTo(x - r, y);
		ctx.closePath();
		ctx.fill();
	}

	private drawEffects(
		frame: Frame,
		field: Rect,
		scale: number,
		lineY: number,
	): void {
		const ctx = this.ctx;

		for (const effect of frame.effects) {
			const age = (frame.chartTimeMs - effect.bornAtMs) / 400;
			if (age < 0 || age > 1) continue;

			const x = field.x + effect.x * scale;
			ctx.globalAlpha = 1 - age;

			if (effect.missed) {
				ctx.strokeStyle = "#FF4D4D";
				ctx.lineWidth = 2;
				const r = 10 + age * 26;
				ctx.beginPath();
				ctx.moveTo(x - r, lineY - r);
				ctx.lineTo(x + r, lineY + r);
				ctx.moveTo(x + r, lineY - r);
				ctx.lineTo(x - r, lineY + r);
				ctx.stroke();
			} else {
				const sponsor = this.atlas?.sponsorForCombo(effect.comboIndex);
				ctx.strokeStyle = sponsor?.color ?? PHOSPHOR;
				ctx.lineWidth = 3 * (1 - age);
				ctx.beginPath();
				ctx.arc(x, lineY, 12 + age * 44, 0, Math.PI * 2);
				ctx.stroke();
			}
		}

		ctx.globalAlpha = 1;
	}

	private drawCatcher(
		catcher: Catcher,
		field: Rect,
		scale: number,
		lineY: number,
	): void {
		const ctx = this.ctx;
		const width = catcher.width * scale;
		const x = field.x + catcher.x * scale;
		const height = 14;

		ctx.save();
		ctx.shadowColor = PHOSPHOR;
		ctx.shadowBlur = catcher.dashing ? 26 : 12;
		ctx.fillStyle = catcher.dashing ? "#B6FFD0" : PHOSPHOR;

		// A shallow bowl: wider at the top so the catch range reads honestly.
		ctx.beginPath();
		ctx.moveTo(x - width / 2, lineY - height);
		ctx.lineTo(x + width / 2, lineY - height);
		ctx.lineTo(x + width / 2.4, lineY + height / 2);
		ctx.lineTo(x - width / 2.4, lineY + height / 2);
		ctx.closePath();
		ctx.fill();
		ctx.restore();
	}

	private drawHud(frame: Frame, width: number, height: number): void {
		const ctx = this.ctx;
		const { snapshot } = frame;

		ctx.fillStyle = "rgba(51, 255, 102, 0.18)";
		ctx.fillRect(0, 0, width, 4);
		ctx.fillStyle = PHOSPHOR;
		ctx.fillRect(0, 0, width * frame.progress, 4);

		ctx.font = '600 28px "Silkscreen", ui-monospace, monospace';
		ctx.fillStyle = PHOSPHOR;
		ctx.textBaseline = "top";

		ctx.textAlign = "right";
		ctx.fillText(String(snapshot.score).padStart(8, "0"), width - 20, 22);

		ctx.font = '400 15px "IBM Plex Mono", ui-monospace, monospace';
		ctx.fillText(`${(snapshot.accuracy * 100).toFixed(2)}%`, width - 20, 58);

		ctx.textAlign = "left";
		ctx.font = '600 30px "Silkscreen", ui-monospace, monospace';
		ctx.fillText(`${snapshot.combo}x`, 20, 22);

		if (snapshot.multiplier > 1) {
			ctx.font = '400 15px "IBM Plex Mono", ui-monospace, monospace';
			ctx.fillStyle = "#FFD23F";
			ctx.fillText(`COMBO BONUS ${snapshot.multiplier}x`, 20, 58);
		}

		ctx.textAlign = "center";
		ctx.font = '400 12px "IBM Plex Mono", ui-monospace, monospace';
		ctx.fillStyle = "rgba(51, 255, 102, 0.45)";
		ctx.fillText(
			"< > MOVE   SHIFT DASH   MOUSE TO AIM",
			width / 2,
			height - 24,
		);
	}
}
