import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { type NextRequest, NextResponse } from "next/server";
import type { BeatmapEntry } from "@/game/library";
import { scoreRepository } from "@/scores";
import { MAX_NAME_LENGTH, NAME_PATTERN, type ScoreSubmission } from "@/scores/repository";

export const dynamic = "force-dynamic";

const BOARD_LIMIT = 20;

export async function GET(request: NextRequest): Promise<NextResponse> {
	const params = request.nextUrl.searchParams;
	const slug = params.get("slug");
	const tier = params.get("tier");

	if (!slug || !tier) {
		return NextResponse.json(
			{ error: "slug and tier are required" },
			{ status: 400 },
		);
	}

	const limit = Math.min(
		BOARD_LIMIT,
		Math.max(1, Number(params.get("limit")) || BOARD_LIMIT),
	);
	return NextResponse.json({
		scores: await scoreRepository().top(slug, tier, limit),
	});
}

export async function POST(request: NextRequest): Promise<NextResponse> {
	if (isRateLimited(clientKey(request))) {
		return NextResponse.json(
			{ error: "Too many submissions" },
			{ status: 429 },
		);
	}

	let body: unknown;
	try {
		body = await request.json();
	} catch {
		return NextResponse.json({ error: "Malformed body" }, { status: 400 });
	}

	const validation = await validate(body);
	if ("error" in validation) {
		return NextResponse.json({ error: validation.error }, { status: 400 });
	}

	return NextResponse.json(
		{ entry: await scoreRepository().add(validation.submission) },
		{ status: 201 },
	);
}

/**
 * Rejects scores that no real run could have produced.
 *
 * This is a deterrent, not proof: the honest defence against a forged score is
 * that it cannot exceed the chart's own ceiling, which is computed at bundle
 * time and shipped in the manifest.
 */
async function validate(
	body: unknown,
): Promise<{ submission: ScoreSubmission } | { error: string }> {
	if (typeof body !== "object" || body === null)
		return { error: "Malformed body" };
	const input = body as Record<string, unknown>;

	const name = String(input.name ?? "")
		.toUpperCase()
		.trim()
		.slice(0, MAX_NAME_LENGTH);
	if (!NAME_PATTERN.test(name)) {
		return { error: `Name must be 1-${MAX_NAME_LENGTH} letters, digits, spaces or dashes` };
	}

	const slug = String(input.slug ?? "");
	const tier = String(input.tier ?? "");
	const difficulty = (await manifest())
		.find((entry) => entry.slug === slug)
		?.difficulties.find((d) => d.tier === tier);

	if (!difficulty) return { error: "Unknown beatmap or difficulty" };

	const score = Number(input.score);
	if (!Number.isInteger(score) || score < 0 || score > difficulty.maxScore) {
		return { error: "Score is outside the possible range for this chart" };
	}

	const maxCombo = Number(input.maxCombo);
	if (
		!Number.isInteger(maxCombo) ||
		maxCombo < 0 ||
		maxCombo > difficulty.objectCount * 4
	) {
		return { error: "Combo is outside the possible range for this chart" };
	}

	const accuracy = Number(input.accuracy);
	if (!Number.isFinite(accuracy) || accuracy < 0 || accuracy > 1) {
		return { error: "Accuracy must be between 0 and 1" };
	}

	return { submission: { name, score, maxCombo, accuracy, slug, tier } };
}

let cachedManifest: BeatmapEntry[] | null = null;

async function manifest(): Promise<BeatmapEntry[]> {
	cachedManifest ??= JSON.parse(
		await readFile(
			join(process.cwd(), "public", "beatmaps", "manifest.json"),
			"utf8",
		),
	) as BeatmapEntry[];
	return cachedManifest;
}

/**
 * Per-IP sliding window, held in memory. The booth runs a single container, so
 * a shared store would be machinery without a purpose.
 */
const RATE_WINDOW_MS = 60_000;
const RATE_LIMIT = 12;
const submissions = new Map<string, number[]>();

function isRateLimited(key: string): boolean {
	const now = Date.now();
	const recent = (submissions.get(key) ?? []).filter(
		(at) => now - at < RATE_WINDOW_MS,
	);

	if (recent.length >= RATE_LIMIT) {
		submissions.set(key, recent);
		return true;
	}

	recent.push(now);
	submissions.set(key, recent);
	return false;
}

function clientKey(request: NextRequest): string {
	const forwarded = request.headers.get("x-forwarded-for");
	return forwarded?.split(",")[0]?.trim() || "local";
}
