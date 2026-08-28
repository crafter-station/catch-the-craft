import { NextResponse } from "next/server";

/**
 * How many participant badges exist.
 *
 * The gallery used to find this by walking ids until they 404'd, which meant a
 * few hundred requests per visitor, a console full of 404s, and workers racing
 * past the end of the roster. Discovering it once here — and caching it — costs
 * about a dozen upstream requests per deploy instead.
 */
const UPSTREAM = "https://thenextcraft.crafter.run/api/badge/image";

/** Nobody is running a hackathon bigger than this. */
const CEILING = 1024;

/** Consecutive missing numbers that mean the roster really has ended. */
const GAP_TOLERANCE = 8;

let cached: number | null = null;
let inFlight: Promise<number> | null = null;

export async function GET(): Promise<NextResponse> {
	cached ??= await (inFlight ??= discover());

	return NextResponse.json(
		{ count: cached },
		// Short cache: people are still registering right up to the doors opening.
		{ headers: { "cache-control": "public, max-age=300" } },
	);
}

/**
 * Finds the highest published badge number.
 *
 * The roster is not contiguous — some numbers in the middle have no published
 * badge — so every probe tolerates a short gap rather than treating one miss as
 * the end. Doubling and bisecting gets close in about a dozen requests, then a
 * short walk upward catches anyone sitting past a gap at the very top.
 */
async function discover(): Promise<number> {
	let high = 1;
	while (high < CEILING && (await existsNear(high))) high *= 2;

	let low = Math.floor(high / 2);
	while (low + 1 < high) {
		const middle = Math.floor((low + high) / 2);
		if (await existsNear(middle)) low = middle;
		else high = middle;
	}

	let top = 0;
	let misses = 0;
	for (let id = low; id < CEILING && misses < GAP_TOLERANCE; id++) {
		if (await exists(id)) {
			top = id;
			misses = 0;
		} else {
			misses++;
		}
	}

	return top;
}

/** True if this id or one just after it exists, so a gap does not read as the end. */
async function existsNear(id: number): Promise<boolean> {
	for (let offset = 0; offset < GAP_TOLERANCE; offset++) {
		if (await exists(id + offset)) return true;
	}
	return false;
}

async function exists(id: number): Promise<boolean> {
	try {
		const response = await fetch(`${UPSTREAM}/${String(id).padStart(3, "0")}`, {
			method: "HEAD",
		});
		return response.ok;
	} catch {
		return false;
	}
}
