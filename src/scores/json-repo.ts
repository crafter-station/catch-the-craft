import { mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname } from "node:path";
import type {
	ScoreEntry,
	ScoreRepository,
	ScoreSubmission,
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
			return JSON.parse(await readFile(this.path, "utf8")) as ScoreEntry[];
		} catch {
			return [];
		}
	}
}
