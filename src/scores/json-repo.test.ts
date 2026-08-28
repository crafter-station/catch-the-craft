import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterAll, describe, expect, it } from "bun:test";
import { JsonFileScoreRepository } from "./json-repo";

const directory = mkdtempSync(join(tmpdir(), "ctb-scores-"));
afterAll(() => rmSync(directory, { recursive: true, force: true }));

const run = (over: Partial<Parameters<JsonFileScoreRepository["add"]>[0]> = {}) => ({
	name: "PLAYER",
	score: 1000,
	maxCombo: 10,
	accuracy: 0.5,
	slug: "attitude",
	tier: "EASY",
	...over,
});

describe("signed-in scores", () => {
	const repo = new JsonFileScoreRepository(join(directory, "signed-in.json"));

	it("keeps only the best run per song and difficulty", async () => {
		await repo.add(run({ userId: "user_1", score: 1000 }));
		await repo.add(run({ userId: "user_1", score: 2500 }));

		const board = await repo.top("attitude", "EASY", 10);
		expect(board).toHaveLength(1);
		expect(board[0].score).toBe(2500);
	});

	it("leaves the better score alone when a worse run comes in", async () => {
		const result = await repo.add(run({ userId: "user_1", score: 400 }));

		expect(result.score).toBe(2500);
		const board = await repo.top("attitude", "EASY", 10);
		expect(board).toHaveLength(1);
		expect(board[0].score).toBe(2500);
	});

	it("keeps a separate best for each difficulty", async () => {
		await repo.add(run({ userId: "user_1", score: 900, tier: "HARD" }));

		expect(await repo.top("attitude", "EASY", 10)).toHaveLength(1);
		expect(await repo.top("attitude", "HARD", 10)).toHaveLength(1);
	});

	it("does not merge different players", async () => {
		await repo.add(run({ userId: "user_2", score: 50 }));

		const board = await repo.top("attitude", "EASY", 10);
		expect(board).toHaveLength(2);
	});

	it("totals a player by user id, not by the name they used", async () => {
		await repo.add(run({ userId: "user_1", name: "RENAMED", score: 3000 }));

		const totals = await repo.totals(10);
		const player = totals.find((entry) => entry.name === "RENAMED");
		// EASY 3000 + HARD 900, as one player rather than two.
		expect(player?.score).toBe(3900);
		expect(player?.runs).toBe(2);
	});
});

describe("anonymous scores", () => {
	const repo = new JsonFileScoreRepository(join(directory, "anonymous.json"));

	it("appends every run rather than replacing", async () => {
		await repo.add(run({ name: "AAA", score: 1000 }));
		await repo.add(run({ name: "AAA", score: 200 }));

		const board = await repo.top("attitude", "EASY", 10);
		expect(board).toHaveLength(2);
		expect(board[0].score).toBe(1000);
	});
});
