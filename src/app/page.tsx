"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import type { RunResult } from "@/game/engine";
import { type BeatmapEntry, loadManifest, type Tier } from "@/game/library";
import {
	fetchBoard,
	flushPending,
	isRanked,
	submitScore,
} from "@/scores/client";
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
		void flushPending();
		loadManifest()
			.then((entries) => {
				setLibrary(entries);
				setPhase({ name: "select" });
			})
			.catch((error: Error) =>
				setPhase({ name: "error", message: error.message }),
			);
	}, []);

	if (phase.name === "playing") {
		return (
			<GameCanvas
				entry={phase.entry}
				tier={phase.tier}
				onEnd={(result) =>
					setPhase({ name: "results", entry: phase.entry, result })
				}
				onError={(message) => setPhase({ name: "error", message })}
			/>
		);
	}

	return (
		<main className="crt mx-auto flex min-h-dvh max-w-4xl flex-col justify-center px-6 py-12">
			<Header />

			{phase.name === "loading" && <Line>LOADING BEATMAPS...</Line>}

			{phase.name === "error" && (
				<div className="mt-8">
					<p className="text-[color:var(--color-alert)]">
						?{phase.message.toUpperCase()}
					</p>
					<p className="mt-2 opacity-60">READY.</p>
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
						setPhase({
							name: "playing",
							entry: phase.entry,
							tier: phase.result.tier as Tier,
						})
					}
					onMenu={() => setPhase({ name: "select" })}
				/>
			)}
		</main>
	);
}

function Header() {
	return (
		<header className="border-[color:var(--color-phosphor-dim)] border-b pb-4">
			<pre className="glow font-[family-name:var(--font-silkscreen)] text-2xl leading-tight sm:text-4xl">
				CATCH THE CRAFT
			</pre>
			<p className="mt-2 text-sm opacity-70">
				**** THE NEXT CRAFT BASIC V2 ****
				<br />
				64K RAM SYSTEM &nbsp;38911 SPONSOR BYTES FREE
			</p>
		</header>
	);
}

function Line({ children }: { children: React.ReactNode }) {
	return <p className="mt-8 cursor opacity-80">{children} </p>;
}

function SongSelect({
	library,
	onPlay,
}: {
	library: BeatmapEntry[];
	onPlay: (entry: BeatmapEntry, tier: Tier) => void;
}) {
	return (
		<section className="mt-8">
			<p className="opacity-60">10 LOAD "BEATMAP",8,1</p>

			<ul className="mt-6 space-y-5">
				{library.map((entry, index) => (
					<li key={entry.slug}>
						<div className="flex flex-wrap items-baseline gap-x-3">
							<span className="opacity-50">
								{String((index + 1) * 10).padStart(3, "0")}
							</span>
							<span className="glow font-[family-name:var(--font-silkscreen)] text-lg">
								{entry.title.toUpperCase()}
							</span>
							<span className="text-sm opacity-60">{entry.artist}</span>
							{entry.tournament && (
								<span className="border border-[color:var(--color-amber)] px-2 py-0.5 text-[10px] text-[color:var(--color-amber)]">
									RANKED
								</span>
							)}
						</div>

						<div className="mt-2 flex flex-wrap gap-2 pl-10">
							{entry.difficulties.map((difficulty) => (
								<button
									key={difficulty.tier}
									type="button"
									onClick={() => onPlay(entry, difficulty.tier)}
									className="border border-[color:var(--color-phosphor-dim)] px-3 py-1 text-sm transition-colors hover:bg-[color:var(--color-phosphor)] hover:text-[color:var(--color-void)]"
								>
									{difficulty.tier}
									<span className="ml-2 opacity-50">
										CS{difficulty.circleSize}
									</span>
								</button>
							))}
						</div>
					</li>
				))}
			</ul>

			<p className="mt-10 text-sm opacity-50">
				ARROWS OR A/D TO MOVE &middot; SHIFT TO DASH &middot; MOUSE TO AIM
			</p>
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
	const [saved, setSaved] = useState<{
		initials: string;
		queued: boolean;
	} | null>(null);
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
		<section className="mt-8">
			<p className="glow font-[family-name:var(--font-silkscreen)] text-xl">
				RUN COMPLETE
			</p>
			<p className="mt-1 text-sm opacity-60">
				{entry.artist} - {entry.title} [{result.tier}]
			</p>

			<dl className="mt-6 max-w-sm">
				{rows.map(([label, value]) => (
					<div
						key={label}
						className="flex justify-between border-[color:var(--color-phosphor-dim)] border-b border-dotted py-2"
					>
						<dt className="opacity-60">{label}</dt>
						<dd className="glow">{value}</dd>
					</div>
				))}
			</dl>

			{ranked && !saved && <InitialsEntry onSubmit={save} />}

			{saved && (
				<div className="mt-8">
					<p
						className={
							saved.queued ? "text-[color:var(--color-amber)]" : "opacity-70"
						}
					>
						{saved.queued
							? "SCORE SAVED LOCALLY - SYNC PENDING"
							: "SCORE SAVED"}
					</p>
					{board && <Board scores={board} highlight={saved.initials} />}
				</div>
			)}

			{!ranked && (
				<p className="mt-6 text-sm opacity-50">
					FREE PLAY - ONLY {entry.title.toUpperCase()} ON EASY IS RANKED
				</p>
			)}

			<div className="mt-8 flex flex-wrap gap-3">
				<button
					type="button"
					onClick={onAgain}
					className="border border-[color:var(--color-phosphor)] px-4 py-2 hover:bg-[color:var(--color-phosphor)] hover:text-[color:var(--color-void)]"
				>
					RUN
				</button>
				<button
					type="button"
					onClick={onMenu}
					className="border border-[color:var(--color-phosphor-dim)] px-4 py-2 opacity-70 hover:opacity-100"
				>
					LIST
				</button>
				<Link
					href="/leaderboard"
					className="border border-[color:var(--color-phosphor-dim)] px-4 py-2 opacity-70 hover:opacity-100"
				>
					BOARD
				</Link>
			</div>
		</section>
	);
}
