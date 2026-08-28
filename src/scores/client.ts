"use client";

import type { RunResult } from "@/game/engine";
import type { ScoreEntry, ScoreSubmission, TotalEntry } from "./repository";

const PENDING_KEY = "ctb.pending-scores";

/**
 * The tier the second-screen board shows for the featured map. Every song and
 * difficulty keeps its own board — this only decides what goes on the big screen.
 */
export const RANKED_TIER = "EASY";

export async function fetchBoard(
	slug: string,
	tier: string,
): Promise<ScoreEntry[]> {
	const response = await fetch(
		`/api/scores?slug=${encodeURIComponent(slug)}&tier=${encodeURIComponent(tier)}`,
		{ cache: "no-store" },
	);
	if (!response.ok) throw new Error("Leaderboard unavailable");
	return (await response.json()).scores as ScoreEntry[];
}

/** The overall standing across every song, for the big board. */
export async function fetchTotals(): Promise<TotalEntry[]> {
	const response = await fetch("/api/scores/totals", { cache: "no-store" });
	if (!response.ok) throw new Error("Leaderboard unavailable");
	return (await response.json()).scores as TotalEntry[];
}

export type SubmitOutcome = "saved" | "queued";

/**
 * Submits a run, falling back to a local queue when the network is not there.
 *
 * The venue's wifi is the least reliable component in this whole system, and a
 * player who just set a personal best should never be told their score
 * evaporated. Anything queued is flushed on the next successful submission.
 */
export async function submitScore(result: RunResult, name: string): Promise<SubmitOutcome> {
	const submission: ScoreSubmission = {
		name: name.toUpperCase().trim(),
		score: result.score,
		maxCombo: result.maxCombo,
		accuracy: result.accuracy,
		slug: result.slug,
		tier: result.tier,
	};

	try {
		await post(submission);
		void flushPending();
		return "saved";
	} catch {
		enqueue(submission);
		return "queued";
	}
}

async function post(submission: ScoreSubmission): Promise<void> {
	const response = await fetch("/api/scores", {
		method: "POST",
		headers: { "content-type": "application/json" },
		body: JSON.stringify(submission),
	});

	// A rejected score is invalid, not undelivered — queueing it would retry forever.
	if (response.status >= 400 && response.status < 500) return;
	if (!response.ok) throw new Error(`Submission failed: ${response.status}`);
}

export async function flushPending(): Promise<void> {
	const pending = readPending();
	if (pending.length === 0) return;

	const remaining: ScoreSubmission[] = [];
	for (const submission of pending) {
		try {
			await post(submission);
		} catch {
			remaining.push(submission);
		}
	}
	writePending(remaining);
}

export function pendingCount(): number {
	return readPending().length;
}

function enqueue(submission: ScoreSubmission): void {
	writePending([...readPending(), submission]);
}

function readPending(): ScoreSubmission[] {
	try {
		return JSON.parse(
			localStorage.getItem(PENDING_KEY) ?? "[]",
		) as ScoreSubmission[];
	} catch {
		return [];
	}
}

function writePending(entries: ScoreSubmission[]): void {
	try {
		localStorage.setItem(PENDING_KEY, JSON.stringify(entries));
	} catch {
		// Private browsing and full quotas both throw here. A lost queue is bad;
		// a crash on the results screen in front of a queue of people is worse.
	}
}
