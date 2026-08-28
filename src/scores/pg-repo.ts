import postgres from "postgres";
import type {
	ScoreEntry,
	ScoreRepository,
	ScoreSubmission,
	TotalEntry,
} from "./repository";

/**
 * Production leaderboard.
 *
 * The schema is created on first use rather than through a migration tool: one
 * table with no history to migrate does not justify the machinery, and it means
 * a fresh compose stack is playable the moment it boots.
 */
export class PostgresScoreRepository implements ScoreRepository {
	private readonly sql: postgres.Sql;
	private ready: Promise<void> | null = null;

	constructor(connectionString: string) {
		this.sql = postgres(connectionString, { max: 4, idle_timeout: 20 });
	}

	private ensureSchema(): Promise<void> {
		this.ready ??= this.sql`
      CREATE TABLE IF NOT EXISTS scores (
        id          BIGSERIAL PRIMARY KEY,
        -- Named when scores were three-letter initials. It holds names up to ten
        -- characters now, and an email for signed-in players; renaming it would
        -- mean migrating the live board for nothing, so the queries below alias
        -- it to name instead.
        initials    TEXT        NOT NULL,
        score       INTEGER     NOT NULL,
        max_combo   INTEGER     NOT NULL,
        accuracy    REAL        NOT NULL,
        slug        TEXT        NOT NULL,
        tier        TEXT        NOT NULL,
        created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
      )
    `.then(async () => {
			// Added after the fact, so it has to be applied to a live table.
			await this.sql`ALTER TABLE scores ADD COLUMN IF NOT EXISTS user_id TEXT`;
			await this.sql`
        CREATE INDEX IF NOT EXISTS scores_board_idx ON scores (slug, tier, score DESC)
      `;
			// Partial: signed-in players keep one row per chart, anonymous rows are
			// left alone and can pile up as they always did.
			await this.sql`
        CREATE UNIQUE INDEX IF NOT EXISTS scores_user_board_idx
        ON scores (user_id, slug, tier) WHERE user_id IS NOT NULL
      `;
		});

		return this.ready;
	}

	async top(slug: string, tier: string, limit: number): Promise<ScoreEntry[]> {
		await this.ensureSchema();
		const rows = await this.sql<Row[]>`
      SELECT initials AS name, user_id, score, max_combo, accuracy, slug, tier, created_at
      FROM scores
      WHERE slug = ${slug} AND tier = ${tier}
      ORDER BY score DESC, created_at ASC
      LIMIT ${limit}
    `;
		return rows.map(toEntry);
	}

	/**
	 * Grouped per player: a standing is the sum of their best on each chart.
	 * Signed-in players group by their Clerk id, so renaming themselves does not
	 * split their history; anonymous ones group by the name they typed.
	 */
	async totals(limit: number): Promise<TotalEntry[]> {
		await this.ensureSchema();
		const rows = await this.sql<TotalRow[]>`
      SELECT COALESCE(user_id, initials) AS grouping_key,
             MIN(initials)        AS name,
             SUM(score)::int      AS score,
             COUNT(*)::int        AS runs,
             AVG(accuracy)::real  AS accuracy,
             MAX(max_combo)::int  AS max_combo
      FROM scores
      GROUP BY COALESCE(user_id, initials)
      ORDER BY score DESC
      LIMIT ${limit}
    `;
		return rows.map((row) => ({
			name: row.name,
			score: row.score,
			runs: row.runs,
			accuracy: row.accuracy,
			maxCombo: row.max_combo,
		}));
	}

	/**
	 * Anonymous runs are appended. A signed-in run replaces that player's row for
	 * the chart, but only when it beats it — the conditional update is what makes
	 * the board a record of your best rather than your latest.
	 */
	async add(submission: ScoreSubmission): Promise<ScoreEntry> {
		await this.ensureSchema();

		if (!submission.userId) {
			const [row] = await this.sql<Row[]>`
        INSERT INTO scores (initials, score, max_combo, accuracy, slug, tier)
        VALUES (
          ${submission.name}, ${submission.score}, ${submission.maxCombo},
          ${submission.accuracy}, ${submission.slug}, ${submission.tier}
        )
        RETURNING initials AS name, user_id, score, max_combo, accuracy, slug, tier, created_at
      `;
			return toEntry(row);
		}

		const [improved] = await this.sql<Row[]>`
      INSERT INTO scores (initials, user_id, score, max_combo, accuracy, slug, tier)
      VALUES (
        ${submission.name}, ${submission.userId}, ${submission.score},
        ${submission.maxCombo}, ${submission.accuracy}, ${submission.slug}, ${submission.tier}
      )
      ON CONFLICT (user_id, slug, tier) WHERE user_id IS NOT NULL
      DO UPDATE SET
        initials   = EXCLUDED.initials,
        score      = EXCLUDED.score,
        max_combo  = EXCLUDED.max_combo,
        accuracy   = EXCLUDED.accuracy,
        created_at = now()
      WHERE EXCLUDED.score > scores.score
      RETURNING initials AS name, user_id, score, max_combo, accuracy, slug, tier, created_at
    `;

		if (improved) return toEntry(improved);

		// The conditional update matched nothing, so their existing score stands.
		const [existing] = await this.sql<Row[]>`
      SELECT initials AS name, user_id, score, max_combo, accuracy, slug, tier, created_at
      FROM scores
      WHERE user_id = ${submission.userId} AND slug = ${submission.slug} AND tier = ${submission.tier}
    `;
		return toEntry(existing);
	}
}

interface TotalRow {
	grouping_key: string;
	name: string;
	score: number;
	runs: number;
	accuracy: number;
	max_combo: number;
}

interface Row {
	name: string;
	user_id: string | null;
	score: number;
	max_combo: number;
	accuracy: number;
	slug: string;
	tier: string;
	created_at: Date;
}

function toEntry(row: Row): ScoreEntry {
	return {
		name: row.name,
		userId: row.user_id ?? undefined,
		score: row.score,
		maxCombo: row.max_combo,
		accuracy: row.accuracy,
		slug: row.slug,
		tier: row.tier,
		createdAt: row.created_at.toISOString(),
	};
}
