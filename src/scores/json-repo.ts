import { mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname } from "node:path";
import type {
	ScoreEntry,
	ScoreRepository,
	ScoreSubmission,
	TotalEntry,
} from "./repository";

/**
 * Development-only leaderboard backed by a JSON file.
 *
 * Writes are serialised through a promise chain rather than a lock file: this
 * only ever runs in a single dev process, and two concurrent submissions
 * read-modify-writing the same file would otherwise lose one of them.
 */
export class JsonFileScoreRepository implements ScoreRepository {
	private readonly path: string;
	private queue: Promise<unknown> = Promise.resolve();

	constructor(path: string) {
		this.path = path;
	}

	async top(slug: string, tier: string, limit: number): Promise<ScoreEntry[]> {
		const all = await this.read();
		return all
			.filter((entry) => entry.slug === slug && entry.tier === tier)
			.sort((a, b) => b.score - a.score)
			.slice(0, limit);
	}

	/** Grouped by name: a player's standing is the sum of everything they played. */
	async totals(limit: number): Promise<TotalEntry[]> {
		const grouped = new Map<string, TotalEntry & { accuracySum: number }>();

		for (const entry of await this.read()) {
			const running = grouped.get(entry.name) ?? {
				name: entry.name,
				score: 0,
				runs: 0,
				accuracy: 0,
				maxCombo: 0,
				accuracySum: 0,
			};

			running.score += entry.score;
			running.runs += 1;
			running.accuracySum += entry.accuracy;
			running.maxCombo = Math.max(running.maxCombo, entry.maxCombo);
			grouped.set(entry.name, running);
		}

		return [...grouped.values()]
			.map(({ accuracySum, ...total }) => ({
				...total,
				accuracy: total.runs === 0 ? 0 : accuracySum / total.runs,
			}))
			.sort((a, b) => b.score - a.score)
			.slice(0, limit);
	}

	add(submission: ScoreSubmission): Promise<ScoreEntry> {
		const run = this.queue.then(async () => {
			const entry: ScoreEntry = {
				...submission,
				createdAt: new Date().toISOString(),
			};
			const all = await this.read();
			all.push(entry);
			await mkdir(dirname(this.path), { recursive: true });
			await writeFile(this.path, `${JSON.stringify(all, null, 2)}\n`, "utf8");
			return entry;
		});

		// Keep the chain alive even if this write fails, so one bad submission does
		// not wedge every later one.
		this.queue = run.catch(() => undefined);
		return run;
	}

	private async read(): Promise<ScoreEntry[]> {
		try {
			const raw = JSON.parse(await readFile(this.path, "utf8")) as Array<
				ScoreEntry & { initials?: string }
			>;

			// Rows written before names replaced three-letter initials still carry the
			// old field. Reading them back nameless would key a whole player as
			// `undefined` on the totals board, so they are normalised on the way in.
			return raw
				.map(({ initials, ...entry }) => ({ ...entry, name: entry.name ?? initials ?? "" }))
				.filter((entry) => entry.name !== "");
		} catch {
			return [];
		}
	}
}
