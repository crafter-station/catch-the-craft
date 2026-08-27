import { JsonFileScoreRepository } from "./json-repo";
import { PostgresScoreRepository } from "./pg-repo";
import type { ScoreRepository } from "./repository";

let repository: ScoreRepository | null = null;

/**
 * Postgres when `DATABASE_URL` is set, a JSON file otherwise.
 *
 * Deployed runs always have the database; a laptop running `bun dev` never
 * needs one. Nothing else in the app knows which of the two it is talking to.
 */
export function scoreRepository(): ScoreRepository {
	if (repository) return repository;

	const url = process.env.DATABASE_URL;
	repository = url
		? new PostgresScoreRepository(url)
		: new JsonFileScoreRepository(
				process.env.SCORES_FILE ?? "data/scores.json",
			);

	return repository;
}
