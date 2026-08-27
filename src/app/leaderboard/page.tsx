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
 * The board, on its own route, sized for a TV next to the booth. It polls
 * rather than holding a socket open: five seconds is well inside the time it
 * takes someone to walk over and look, and a dropped poll costs nothing.
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
		<main className="crt mx-auto flex min-h-dvh max-w-5xl flex-col justify-center px-8 py-12">
			<header className="border-[color:var(--color-phosphor-dim)] border-b pb-4">
				<h1 className="glow font-[family-name:var(--font-silkscreen)] text-3xl sm:text-5xl">
					HIGH SCORES
				</h1>
				<p className="mt-2 text-sm opacity-70">
					{entry
						? `${entry.artist.toUpperCase()} - ${entry.title.toUpperCase()} [${RANKED_TIER}]`
						: "LOADING..."}
				</p>
			</header>

			{offline && (
				<p className="mt-6 text-[color:var(--color-amber)]">
					?BOARD OFFLINE - RETRYING
				</p>
			)}

			<Board scores={scores} />

			<Link href="/" className="mt-10 text-sm opacity-50 hover:opacity-100">
				&lt; BACK TO GAME
			</Link>
		</main>
	);
}
