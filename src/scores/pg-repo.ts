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
        -- characters now; renaming it would mean migrating the live board for
        -- nothing, so the queries below alias it to name instead.
        initials    TEXT        NOT NULL,
        score       INTEGER     NOT NULL,
        max_combo   INTEGER     NOT NULL,
        accuracy    REAL        NOT NULL,
        slug        TEXT        NOT NULL,
        tier        TEXT        NOT NULL,
        created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
      )
    `.then(async () => {
			await this.sql`
        CREATE INDEX IF NOT EXISTS scores_board_idx ON scores (slug, tier, score DESC)
      `;
		});

		return this.ready;
	}

	async top(slug: string, tier: string, limit: number): Promise<ScoreEntry[]> {
		await this.ensureSchema();
		const rows = await this.sql<Row[]>`
      SELECT initials AS name, score, max_combo, accuracy, slug, tier, created_at
      FROM scores
      WHERE slug = ${slug} AND tier = ${tier}
      ORDER BY score DESC, created_at ASC
      LIMIT ${limit}
    `;
		return rows.map(toEntry);
	}

	/** Grouped by name: a player's standing is the sum of everything they played. */
	async totals(limit: number): Promise<TotalEntry[]> {
		await this.ensureSchema();
		const rows = await this.sql<TotalRow[]>`
      SELECT initials AS name,
             SUM(score)::int      AS score,
             COUNT(*)::int        AS runs,
             AVG(accuracy)::real  AS accuracy,
             MAX(max_combo)::int  AS max_combo
      FROM scores
      GROUP BY initials
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

	async add(submission: ScoreSubmission): Promise<ScoreEntry> {
		await this.ensureSchema();
		const [row] = await this.sql<Row[]>`
      INSERT INTO scores (initials, score, max_combo, accuracy, slug, tier)
      VALUES (
        ${submission.name}, ${submission.score}, ${submission.maxCombo},
        ${submission.accuracy}, ${submission.slug}, ${submission.tier}
      )
      RETURNING initials AS name, score, max_combo, accuracy, slug, tier, created_at
    `;
		return toEntry(row);
	}
}

interface TotalRow {
	name: string;
	score: number;
	runs: number;
	accuracy: number;
	max_combo: number;
}

interface Row {
	name: string;
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
		score: row.score,
		maxCombo: row.max_combo,
		accuracy: row.accuracy,
		slug: row.slug,
		tier: row.tier,
		createdAt: row.created_at.toISOString(),
	};
}
