export interface ScoreEntry {
	/** Three-letter arcade initials. */
	initials: string;
	score: number;
	maxCombo: number;
	/** Fraction in 0..1. */
	accuracy: number;
	slug: string;
	tier: string;
	createdAt: string;
}

export type ScoreSubmission = Omit<ScoreEntry, "createdAt">;

/**
 * Storage seam for the leaderboard.
 *
 * Local development writes a JSON file; production talks to the Postgres that
 * ships in the same compose stack. Keeping both behind one interface is what
 * lets `bun dev` work with no database running at all — which matters when the
 * thing being built has to be demonstrable on a laptop at a venue.
 */
export interface ScoreRepository {
	/** Highest scores first. */
	top(slug: string, tier: string, limit: number): Promise<ScoreEntry[]>;
	add(entry: ScoreSubmission): Promise<ScoreEntry>;
}

export const INITIALS_PATTERN = /^[A-Z0-9]{3}$/;
