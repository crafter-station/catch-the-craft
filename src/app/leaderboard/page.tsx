"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { fetchTotals } from "@/scores/client";
import type { TotalEntry } from "@/scores/repository";
import { Board } from "@/ui/Board";
import { UiSounds } from "@/ui/UiSounds";

/** How often the second-screen board refreshes itself. */
const POLL_MS = 5000;

/**
 * The overall standing, sized for a TV next to the booth.
 *
 * Every run a player saves adds to their total, across all songs and
 * difficulties — being good at one chart puts you on that chart's board, but
 * getting to the top here means playing. It polls rather than holding a socket
 * open: five seconds is well inside the time it takes someone to walk over and
 * look, and a dropped poll costs nothing.
 */
export default function Leaderboard() {
	const [scores, setScores] = useState<TotalEntry[]>([]);
	const [offline, setOffline] = useState(false);

	const refresh = useCallback(async () => {
		try {
			setScores(await fetchTotals());
			setOffline(false);
		} catch {
			setOffline(true);
		}
	}, []);

	useEffect(() => {
		void refresh();
		const timer = setInterval(() => void refresh(), POLL_MS);
		return () => clearInterval(timer);
	}, [refresh]);

	return (
		<div className="relative h-dvh overflow-hidden">
			<UiSounds />
			<div className="grid-bg" aria-hidden="true" />
			<div className="scanlines pointer-events-none fixed inset-0 z-40" aria-hidden="true" />

			<main className="relative z-10 mx-auto flex h-dvh max-w-5xl flex-col px-8 py-10">
				<header className="border-[color:var(--border)] border-b pb-5">
					<p className="section-label">The Next Craft &middot; Arcade</p>
					<h1 className="pixel-heading mt-3 text-4xl sm:text-6xl">High scores</h1>
					<p className="mt-3 text-[color:var(--text-dim)] text-sm">
						Total across every song played
					</p>
				</header>

				{offline && (
					<p className="mt-4 text-[color:var(--destructive)]">?BOARD OFFLINE — RETRYING</p>
				)}

				<div className="gallery-mask gallery-scroll min-h-0 flex-1 overflow-y-auto pr-2">
					<Board scores={scores} size="display" />
				</div>

				<Link
					href="/"
					className="section-label mt-6 text-[color:var(--text-dim)] hover:text-[color:var(--bright)]"
				>
					&lt; Back to game
				</Link>
			</main>
		</div>
	);
}
