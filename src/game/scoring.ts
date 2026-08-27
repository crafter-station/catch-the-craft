import type { CatchObjectKind } from "@/osu/toCatch";

/**
 * Arcade scoring rather than osu!'s formula: a combo multiplier that steps at
 * legible thresholds, so a leaderboard number is something a bystander can
 * reason about. Accuracy is tracked separately and is the honest measure.
 */
const BASE_VALUE: Record<CatchObjectKind, number> = {
	fruit: 300,
	droplet: 100,
	banana: 50,
};

/** Combo thresholds, highest first. */
const MULTIPLIER_TIERS: ReadonlyArray<{ combo: number; multiplier: number }> = [
	{ combo: 50, multiplier: 8 },
	{ combo: 25, multiplier: 4 },
	{ combo: 10, multiplier: 2 },
	{ combo: 0, multiplier: 1 },
];

export function multiplierFor(combo: number): number {
	for (const tier of MULTIPLIER_TIERS) {
		if (combo >= tier.combo) return tier.multiplier;
	}
	return 1;
}

export interface ScoreSnapshot {
	score: number;
	combo: number;
	maxCombo: number;
	multiplier: number;
	caught: number;
	missed: number;
	/** Fraction in 0..1 over catchable objects. Bananas do not count. */
	accuracy: number;
}

export class ScoreTracker {
	private score = 0;
	private combo = 0;
	private maxCombo = 0;
	private caught = 0;
	private missed = 0;

	/**
	 * Bananas are optional bonus: catching one scores, missing one costs nothing.
	 * This matches osu! and matters at a booth — a banana shower should never be
	 * the thing that ends someone's combo.
	 */
	hit(kind: CatchObjectKind): number {
		const gained = BASE_VALUE[kind] * multiplierFor(this.combo);
		this.score += gained;

		if (kind !== "banana") {
			this.combo++;
			this.maxCombo = Math.max(this.maxCombo, this.combo);
			this.caught++;
		}

		return gained;
	}

	miss(kind: CatchObjectKind): void {
		if (kind === "banana") return;
		this.combo = 0;
		this.missed++;
	}

	snapshot(): ScoreSnapshot {
		const total = this.caught + this.missed;
		return {
			score: this.score,
			combo: this.combo,
			maxCombo: this.maxCombo,
			multiplier: multiplierFor(this.combo),
			caught: this.caught,
			missed: this.missed,
			accuracy: total === 0 ? 1 : this.caught / total,
		};
	}

	reset(): void {
		this.score = 0;
		this.combo = 0;
		this.maxCombo = 0;
		this.caught = 0;
		this.missed = 0;
	}
}

/**
 * Score a flawless run would produce over the played window.
 *
 * Used as the server-side ceiling for submitted scores. A public URL means
 * anyone can POST whatever number they like, and one bored attendee putting
 * 999999999 on the board ruins it for everyone else.
 */
export function maximumScore(
  objects: ReadonlyArray<{ kind: CatchObjectKind; time: number }>,
  startMs: number,
  endMs: number,
): number {
  let total = 0;
  let combo = 0;

  for (const object of objects) {
    if (object.time < startMs || object.time > endMs) continue;
    total += BASE_VALUE[object.kind] * multiplierFor(combo);
    if (object.kind !== "banana") combo++;
  }

  return total;
}
