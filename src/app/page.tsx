"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import type { RunResult } from "@/game/engine";
import { type BeatmapEntry, loadManifest, type Tier } from "@/game/library";
import { fetchBoard, flushPending, isRanked, submitScore } from "@/scores/client";
import type { ScoreEntry } from "@/scores/repository";
import { Board } from "@/ui/Board";
import { GameCanvas } from "@/ui/GameCanvas";
import { InitialsEntry } from "@/ui/InitialsEntry";

type Phase =
	| { name: "loading" }
	| { name: "select" }
	| { name: "playing"; entry: BeatmapEntry; tier: Tier }
	| { name: "results"; entry: BeatmapEntry; result: RunResult }
	| { name: "error"; message: string };

export default function Home() {
	const [library, setLibrary] = useState<BeatmapEntry[]>([]);
	const [phase, setPhase] = useState<Phase>({ name: "loading" });

	useEffect(() => {
		// Deliver anything the last session could not send before doing anything else.
		void flushPending();

		loadManifest()
			.then((entries) => {
				setLibrary(entries);
				setPhase({ name: "select" });
			})
			.catch((error: Error) => setPhase({ name: "error", message: error.message }));
	}, []);

	if (phase.name === "playing") {
		return (
			<GameCanvas
				entry={phase.entry}
				tier={phase.tier}
				onEnd={(result) => setPhase({ name: "results", entry: phase.entry, result })}
				onQuit={() => setPhase({ name: "select" })}
				onError={(message) => setPhase({ name: "error", message })}
			/>
		);
	}

	return (
		<div className="relative min-h-dvh overflow-hidden">
			<div className="grid-bg" aria-hidden="true" />
			<div className="scanlines pointer-events-none fixed inset-0 z-40" aria-hidden="true" />

			<main className="relative z-10 mx-auto flex min-h-dvh max-w-3xl flex-col justify-center px-6 py-16">
				<Header />

				{phase.name === "loading" && (
					<p className="mt-10 cursor text-[color:var(--text-dim)]">LOADING BEATMAPS... </p>
				)}

				{phase.name === "error" && (
					<div className="panel mt-10 p-6">
						<p className="text-[color:var(--destructive)]">?{phase.message.toUpperCase()}</p>
						<p className="mt-2 cursor text-[color:var(--text-dim)]">READY. </p>
					</div>
				)}

				{phase.name === "select" && (
					<SongSelect
						library={library}
						onPlay={(entry, tier) => setPhase({ name: "playing", entry, tier })}
					/>
				)}

				{phase.name === "results" && (
					<Results
						result={phase.result}
						entry={phase.entry}
						onAgain={() =>
							setPhase({ name: "playing", entry: phase.entry, tier: phase.result.tier as Tier })
						}
						onMenu={() => setPhase({ name: "select" })}
					/>
				)}
			</main>
		</div>
	);
}

function Header() {
	return (
		<header className="border-[color:var(--border)] border-b pb-6">
			<p className="section-label">The Next Craft &middot; Arcade</p>
			<h1 className="pixel-heading mt-3 text-3xl sm:text-5xl">Catch the Craft</h1>
			<p className="mt-4 text-[color:var(--text-dim)] text-sm leading-relaxed">
				**** THE NEXT CRAFT BASIC V2 ****
				<br />
				64K RAM SYSTEM &nbsp;38911 SPONSOR BYTES FREE
			</p>
		</header>
	);
}

function SongSelect({
	library,
	onPlay,
}: {
	library: BeatmapEntry[];
	onPlay: (entry: BeatmapEntry, tier: Tier) => void;
}) {
	return (
		<section className="mt-10">
			<p className="text-[color:var(--text-dim)] text-sm">10 LOAD &quot;BEATMAP&quot;,8,1</p>

			<ul className="mt-6 space-y-3">
				{library.map((entry, index) => (
					<li key={entry.slug} className="panel p-5">
						<div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
							<span className="text-[color:var(--text-dim)] text-sm tabular-nums">
								{String((index + 1) * 10).padStart(3, "0")}
							</span>
							<h2 className="pixel-heading text-base sm:text-lg">{entry.title}</h2>
							{entry.tournament && (
								<span className="rounded bg-[color:var(--bone)] px-2 py-0.5 font-semibold text-[10px] text-[color:var(--void)] tracking-[0.12em]">
									RANKED
								</span>
							)}
						</div>

						<p className="mt-1 text-[color:var(--text-dim)] text-sm">{entry.artist}</p>

						<div className="mt-4 flex flex-wrap gap-2">
							{entry.difficulties.map((difficulty) => (
								<button
									key={difficulty.tier}
									type="button"
									onClick={() => onPlay(entry, difficulty.tier)}
									className="keycap-ghost px-4 py-2 text-sm"
								>
									{difficulty.tier}
									<span className="ml-2 text-[color:var(--text-dim)]">
										CS{difficulty.circleSize}
									</span>
								</button>
							))}
						</div>
					</li>
				))}
			</ul>

			<p className="section-label mt-10">
				Arrows or A/D to move &middot; Shift or Space to dash &middot; Mouse to aim
			</p>
			<p className="mt-2 text-[color:var(--text-dim)] text-xs">ESC opens the menu mid-run.</p>
		</section>
	);
}

function Results({
	result,
	entry,
	onAgain,
	onMenu,
}: {
	result: RunResult;
	entry: BeatmapEntry;
	onAgain: () => void;
	onMenu: () => void;
}) {
	const ranked = isRanked(entry.tournament, result.tier);
	const [saved, setSaved] = useState<{ initials: string; queued: boolean } | null>(null);
	const [board, setBoard] = useState<ScoreEntry[] | null>(null);

	const rows: Array<[string, string]> = [
		["SCORE", String(result.score).padStart(8, "0")],
		["ACCURACY", `${(result.accuracy * 100).toFixed(2)}%`],
		["MAX COMBO", `${result.maxCombo}x`],
		["CAUGHT", String(result.caught)],
		["MISSED", String(result.missed)],
	];

	async function save(initials: string) {
		const outcome = await submitScore(result, initials);
		setSaved({ initials, queued: outcome === "queued" });
		try {
			setBoard(await fetchBoard(result.slug, result.tier));
		} catch {
			setBoard([]);
		}
	}

	return (
		<section className="mt-10">
			<h2 className="pixel-heading text-2xl">Run complete</h2>
			<p className="mt-2 text-[color:var(--text-dim)] text-sm">
				{entry.artist} — {entry.title} [{result.tier}]
			</p>

			<dl className="panel mt-6 max-w-sm p-5">
				{rows.map(([label, value], index) => (
					<div
						key={label}
						className={`flex justify-between py-2 ${
							index > 0 ? "border-[color:var(--border)] border-t" : ""
						}`}
					>
						<dt className="text-[color:var(--text-dim)] text-sm">{label}</dt>
						<dd className="font-[family-name:var(--font-pixel)] tabular-nums">{value}</dd>
					</div>
				))}
			</dl>

			{ranked && !saved && <InitialsEntry onSubmit={save} />}

			{saved && (
				<div className="mt-8">
					<p
						className={
							saved.queued ? "text-[color:var(--destructive)]" : "text-[color:var(--bright)]"
						}
					>
						{saved.queued ? "SCORE SAVED LOCALLY — SYNC PENDING" : "SCORE SAVED"}
					</p>
					{board && <Board scores={board} highlight={saved.initials} />}
				</div>
			)}

			{!ranked && (
				<p className="mt-6 text-[color:var(--text-dim)] text-sm">
					FREE PLAY — only {entry.title} on EASY is ranked.
				</p>
			)}

			<div className="mt-10 flex flex-wrap gap-3">
				<button type="button" onClick={onAgain} className="keycap px-5 py-2.5 font-semibold">
					RUN
				</button>
				<button type="button" onClick={onMenu} className="keycap-ghost px-5 py-2.5">
					LIST
				</button>
				<Link href="/leaderboard" className="keycap-ghost px-5 py-2.5">
					BOARD
				</Link>
			</div>
		</section>
	);
}
