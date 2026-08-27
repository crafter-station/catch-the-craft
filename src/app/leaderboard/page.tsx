"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { type BeatmapEntry, loadManifest } from "@/game/library";
import { fetchBoard, RANKED_TIER } from "@/scores/client";
import type { ScoreEntry } from "@/scores/repository";
import { Board } from "@/ui/Board";

/** How often the second-screen board refreshes itself. */
const POLL_MS = 5000;

/**
 * The board on its own route, sized for a TV next to the booth. It polls rather
 * than holding a socket open: five seconds is well inside the time it takes
 * someone to walk over and look, and a dropped poll costs nothing.
 */
export default function Leaderboard() {
	const [entry, setEntry] = useState<BeatmapEntry | null>(null);
	const [scores, setScores] = useState<ScoreEntry[]>([]);
	const [offline, setOffline] = useState(false);

	const refresh = useCallback(async (slug: string) => {
		try {
			setScores(await fetchBoard(slug, RANKED_TIER));
			setOffline(false);
		} catch {
			setOffline(true);
		}
	}, []);

	useEffect(() => {
		let timer: ReturnType<typeof setInterval> | null = null;

		loadManifest().then((library) => {
			const ranked = library.find((map) => map.tournament) ?? library[0];
			if (!ranked) return;
			setEntry(ranked);
			void refresh(ranked.slug);
			timer = setInterval(() => void refresh(ranked.slug), POLL_MS);
		});

		return () => {
			if (timer) clearInterval(timer);
		};
	}, [refresh]);

	return (
		<div className="relative min-h-dvh overflow-hidden">
			<div className="grid-bg" aria-hidden="true" />
			<div className="scanlines pointer-events-none fixed inset-0 z-40" aria-hidden="true" />

			<main className="relative z-10 mx-auto flex min-h-dvh max-w-5xl flex-col justify-center px-8 py-16">
				<header className="border-[color:var(--border)] border-b pb-6">
					<p className="section-label">The Next Craft &middot; Arcade</p>
					<h1 className="pixel-heading mt-3 text-4xl sm:text-6xl">High scores</h1>
					<p className="mt-4 text-[color:var(--text-dim)] text-sm">
						{entry ? `${entry.artist} — ${entry.title} [${RANKED_TIER}]` : "LOADING..."}
					</p>
				</header>

				{offline && (
					<p className="mt-6 text-[color:var(--destructive)]">?BOARD OFFLINE — RETRYING</p>
				)}

				<Board scores={scores} size="display" />

				<Link
					href="/"
					className="section-label mt-12 text-[color:var(--text-dim)] hover:text-[color:var(--bright)]"
				>
					&lt; Back to game
				</Link>
			</main>
		</div>
	);
}
