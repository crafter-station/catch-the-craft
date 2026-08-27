import { PLAYFIELD_WIDTH } from "@/osu/types";

/** osu!'s catcher movement speeds, in playfield units per millisecond. */
const WALK_SPEED = 0.5;
const DASH_SPEED = 1.0;

export type MoveDirection = -1 | 0 | 1;

/**
 * The plate the player moves along the bottom of the playfield.
 *
 * Keyboard input integrates velocity over time; pointer input sets the position
 * directly, which is how osu!'s own "relative/absolute" modes differ. Both write
 * to the same `x` so the rest of the engine never has to care which is active.
 */
export class Catcher {
	x = PLAYFIELD_WIDTH / 2;
	dashing = false;

	/** Full plate width in playfield units. Catch range is ±width/2. */
	readonly width: number;

	/** Set when the plate is driven by mouse or touch rather than keys. */
	private pointerTarget: number | null = null;

	constructor(width: number) {
		this.width = width;
	}

	get halfWidth(): number {
		return this.width / 2;
	}

	/** Direction of travel last frame, for leaning the sprite. */
	facing: MoveDirection = 0;

	setPointerTarget(x: number | null): void {
		this.pointerTarget = x === null ? null : clamp(x);
	}

	update(deltaMs: number, direction: MoveDirection): void {
		if (this.pointerTarget !== null) {
			this.facing = Math.sign(this.pointerTarget - this.x) as MoveDirection;
			this.x = this.pointerTarget;
			return;
		}

		this.facing = direction;
		if (direction === 0) return;

		const speed = this.dashing ? DASH_SPEED : WALK_SPEED;
		this.x = clamp(this.x + direction * speed * deltaMs);
	}

	/** True when an object at `x` lands within the plate. */
	catches(x: number): boolean {
		return Math.abs(x - this.x) <= this.halfWidth;
	}

	reset(): void {
		this.x = PLAYFIELD_WIDTH / 2;
		this.pointerTarget = null;
		this.dashing = false;
		this.facing = 0;
	}
}

function clamp(x: number): number {
	return Math.min(PLAYFIELD_WIDTH, Math.max(0, x));
}
