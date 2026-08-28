import { type NextRequest, NextResponse } from "next/server";
import { scoreRepository } from "@/scores";

export const dynamic = "force-dynamic";

const BOARD_LIMIT = 20;

/**
 * The overall standing: every run a player has saved, added together.
 *
 * Per-song boards reward being good at one chart; this rewards turning up and
 * playing, which is the thing a booth actually wants to encourage.
 */
export async function GET(request: NextRequest): Promise<NextResponse> {
	const requested = Number(request.nextUrl.searchParams.get("limit"));
	const limit = Math.min(BOARD_LIMIT, Math.max(1, requested || BOARD_LIMIT));

	return NextResponse.json({ scores: await scoreRepository().totals(limit) });
}
