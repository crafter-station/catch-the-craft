export interface ScoreEntry {
	/** Display name: a typed arcade name, or the signed-in player's email. */
	name: string;
	/**
	 * Clerk user id, when the run was played signed in. Absent for anonymous
	 * play, which the booth still allows — signing in changes how a score is
	 * attributed, not whether you can set one.
	 */
	userId?: string;
	score: number;
	maxCombo: number;
	/** Fraction in 0..1. */
	accuracy: number;
	slug: string;
	tier: string;
	createdAt: string;
}

export type ScoreSubmission = Omit<ScoreEntry, "createdAt">;

/** One player's standing across every song they have played. */
export interface TotalEntry {
	name: string;
	/** Sum of every run they have saved. */
	score: number;
	runs: number;
	/** Mean accuracy across those runs. */
	accuracy: number;
	/** Best combo they have reached on any song. */
	maxCombo: number;
}

/**
 * Storage seam for the leaderboard.
 *
 * Local development writes a JSON file; production talks to the Postgres that
 * ships in the same compose stack. Keeping both behind one interface is what
 * lets `bun dev` work with no database running at all — which matters when the
 * thing being built has to be demonstrable on a laptop at a venue.
 */
export interface ScoreRepository {
	/** Highest scores first, for one song and difficulty. */
	top(slug: string, tier: string, limit: number): Promise<ScoreEntry[]>;
	/** Highest cumulative scores first, across every song. */
	totals(limit: number): Promise<TotalEntry[]>;
	add(entry: ScoreSubmission): Promise<ScoreEntry>;
}

/**
  * Uppercase letters, digits, and separators, one to ten characters, starting on
  * something alphanumeric. Wide enough for a team name and still narrow enough to
  * line up in a fixed-width board.
  */
export const NAME_PATTERN = /^[A-Z0-9][A-Z0-9 _-]{0,9}$/;

export const MAX_NAME_LENGTH = 10;
