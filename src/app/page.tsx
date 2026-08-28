"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { disposeMenuMusic, playMenuTrack, stopMenuTrack } from "@/game/audio/menu-music";
import type { RunResult } from "@/game/engine";
import { type BeatmapEntry, loadManifest, type Tier } from "@/game/library";
import { fetchBoard, flushPending, submitScore } from "@/scores/client";
import type { ScoreEntry } from "@/scores/repository";
import { Board } from "@/ui/Board";
import { GameCanvas } from "@/ui/GameCanvas";
import { NameEntry } from "@/ui/NameEntry";
import { SoundControls } from "@/ui/SoundControls";
import { useWipe, Wipe } from "@/ui/Wipe";

type Phase =
	| { name: "loading" }
	| { name: "title" }
	| { name: "settings" }
	| { name: "songs" }
	| { name: "song"; entry: BeatmapEntry; tier: Tier }
	| { name: "playing"; entry: BeatmapEntry; tier: Tier }
	| { name: "results"; entry: BeatmapEntry; result: RunResult }
	| { name: "error"; message: string };

export default function Home() {
	const [library, setLibrary] = useState<BeatmapEntry[]>([]);
	const [phase, setPhase] = useState<Phase>({ name: "loading" });
	const [audioUnlocked, setAudioUnlocked] = useState(false);
	const { wipeLabel, wipeTo } = useWipe();

	useEffect(() => {
		// Deliver anything the last session could not send before doing anything else.
		void flushPending();

		loadManifest()
			.then((entries) => {
				setLibrary(entries);
				setPhase({ name: "title" });
			})
			.catch((error: Error) => setPhase({ name: "error", message: error.message }));
	}, []);

	// Browsers refuse audio until the player has interacted, so the menu track
	// waits for the first click or keypress rather than failing silently.
	useEffect(() => {
		const unlock = () => setAudioUnlocked(true);
		window.addEventListener("pointerdown", unlock, { once: true });
		window.addEventListener("keydown", unlock, { once: true });
		return () => {
			window.removeEventListener("pointerdown", unlock);
			window.removeEventListener("keydown", unlock);
		};
	}, []);

	useEffect(() => () => disposeMenuMusic(), []);

	/**
	 * Which song the menus are playing. It follows the selection the way osu!'s
	 * song select does, and goes quiet for a run, which brings its own audio.
	 */
	const menuTrack =
		phase.name === "playing"
			? null
			: phase.name === "song" || phase.name === "results"
				? phase.entry
				: (library.find((entry) => entry.tournament) ?? library[0] ?? null);

	useEffect(() => {
		if (!audioUnlocked || !menuTrack) {
			stopMenuTrack();
			return;
		}
		void playMenuTrack(menuTrack.audio, menuTrack.previewMs);
	}, [audioUnlocked, menuTrack]);

	if (phase.name === "playing") {
		return (
			<>
				<GameCanvas
					entry={phase.entry}
					tier={phase.tier}
					onEnd={(result) =>
						wipeTo("RESULTS", () => setPhase({ name: "results", entry: phase.entry, result }))
					}
					onQuit={() =>
						wipeTo("LIST", () => setPhase({ name: "song", entry: phase.entry, tier: phase.tier }))
					}
					onError={(message) => setPhase({ name: "error", message })}
				/>
				{wipeLabel && <Wipe label={wipeLabel} />}
			</>
		);
	}

	return (
		<div className="relative min-h-dvh overflow-hidden">
			<div className="grid-bg" aria-hidden="true" />
			<div className="scanlines pointer-events-none fixed inset-0 z-40" aria-hidden="true" />

			<main className="relative z-10 mx-auto flex min-h-dvh max-w-3xl flex-col justify-center px-6 py-16">
				<Header compact={phase.name !== "title" && phase.name !== "loading"} />

				{phase.name === "loading" && (
					<p className="mt-10 cursor text-[color:var(--text-dim)]">LOADING BEATMAPS... </p>
				)}

				{phase.name === "error" && (
					<div className="panel mt-10 p-6">
						<p className="text-[color:var(--destructive)]">?{phase.message.toUpperCase()}</p>
						<p className="mt-2 cursor text-[color:var(--text-dim)]">READY. </p>
					</div>
				)}

				{phase.name === "title" && (
					<TitleScreen
						onPlay={() => setPhase({ name: "songs" })}
						onSettings={() => setPhase({ name: "settings" })}
					/>
				)}

				{phase.name === "settings" && <SettingsScreen onBack={() => setPhase({ name: "title" })} />}

				{phase.name === "songs" && (
					<SongList
						library={library}
						onSelect={(entry) =>
							setPhase({ name: "song", entry, tier: entry.difficulties[0]?.tier ?? "EASY" })
						}
						onBack={() => setPhase({ name: "title" })}
					/>
				)}

				{phase.name === "song" && (
					<SongDetail
						entry={phase.entry}
						tier={phase.tier}
						onTier={(tier) => setPhase({ name: "song", entry: phase.entry, tier })}
						onPlay={() =>
							wipeTo("LOADING", () =>
								setPhase({ name: "playing", entry: phase.entry, tier: phase.tier }),
							)
						}
						onBack={() => setPhase({ name: "songs" })}
					/>
				)}

				{phase.name === "results" && (
					<Results
						result={phase.result}
						entry={phase.entry}
						onAgain={() =>
							wipeTo("LOADING", () =>
								setPhase({
									name: "playing",
									entry: phase.entry,
									tier: phase.result.tier as Tier,
								}),
							)
						}
						onSong={() =>
							setPhase({ name: "song", entry: phase.entry, tier: phase.result.tier as Tier })
						}
					/>
				)}
			</main>

			{wipeLabel && <Wipe label={wipeLabel} />}
		</div>
	);
}

function Header({ compact }: { compact: boolean }) {
	return (
		<header className="border-[color:var(--border)] border-b pb-6">
			<p className="section-label">The Next Craft &middot; Arcade</p>
			<h1
				className={`pixel-heading mt-3 ${compact ? "text-2xl sm:text-3xl" : "text-3xl sm:text-5xl"}`}
			>
				Catch the Craft
			</h1>
			{!compact && (
				<p className="mt-4 text-[color:var(--text-dim)] text-sm leading-relaxed">
					**** THE NEXT CRAFT BASIC V2 ****
					<br />
					64K RAM SYSTEM &nbsp;38911 SPONSOR BYTES FREE
				</p>
			)}
		</header>
	);
}

function TitleScreen({ onPlay, onSettings }: { onPlay: () => void; onSettings: () => void }) {
	return (
		<section className="mt-12">
			<p className="rise text-[color:var(--text-dim)] text-sm">10 RUN</p>

			<div className="rise rise-1 mt-6 flex w-full max-w-xs flex-col gap-3">
				<button type="button" onClick={onPlay} className="keycap py-4 font-semibold text-lg">
					PLAY
				</button>
				<button type="button" onClick={onSettings} className="keycap-ghost py-4">
					SETTINGS
				</button>
				<Link href="/leaderboard" className="keycap-ghost py-4 text-center">
					HIGH SCORES
				</Link>
			</div>

			<p className="rise rise-2 section-label mt-10">
				Arrows or A/D to move &middot; Shift or Space to dash &middot; Mouse to aim
			</p>
		</section>
	);
}

function SettingsScreen({ onBack }: { onBack: () => void }) {
	return (
		<section className="mt-10">
			<p className="rise section-label">Settings</p>

			<div className="rise rise-1 mt-6 max-w-md">
				<SoundControls preview />
			</div>

			<p className="rise rise-2 mt-6 text-[color:var(--text-dim)] text-xs">
				Levels are stored on this device only. ESC opens them mid-run too.
			</p>

			<button type="button" onClick={onBack} className="keycap-ghost mt-8 px-5 py-2.5">
				BACK
			</button>
		</section>
	);
}

function SongList({
	library,
	onSelect,
	onBack,
}: {
	library: BeatmapEntry[];
	onSelect: (entry: BeatmapEntry) => void;
	onBack: () => void;
}) {
	return (
		<section className="mt-10">
			<p className="rise text-[color:var(--text-dim)] text-sm">20 LOAD &quot;BEATMAP&quot;,8,1</p>

			<ul className="mt-6 space-y-3">
				{library.map((entry, index) => (
					<li key={entry.slug} className={`rise rise-${Math.min(3, index + 1)}`}>
						<button
							type="button"
							onClick={() => onSelect(entry)}
							className="panel block w-full p-5 text-left transition-colors hover:bg-[color:var(--screen)]"
						>
							<div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
								<span className="text-[color:var(--text-dim)] text-sm tabular-nums">
									{String((index + 1) * 10).padStart(3, "0")}
								</span>
								<h2 className="pixel-heading text-base sm:text-lg">{entry.title}</h2>
								{entry.tournament && (
									<span className="rounded bg-[color:var(--bone)] px-2 py-0.5 font-semibold text-[10px] text-[color:var(--void)] tracking-[0.12em]">
										FEATURED
									</span>
								)}
							</div>
							<p className="mt-1 text-[color:var(--text-dim)] text-sm">{entry.artist}</p>
						</button>
					</li>
				))}
			</ul>

			<button type="button" onClick={onBack} className="keycap-ghost mt-8 px-5 py-2.5">
				BACK
			</button>
		</section>
	);
}

/**
 * Song detail: pick a difficulty, see who is ahead of you on it, then play.
 *
 * The board sits between choosing and playing on purpose — a target you read
 * ten seconds before a run is worth more than one you read after it.
 */
function SongDetail({
	entry,
	tier,
	onTier,
	onPlay,
	onBack,
}: {
	entry: BeatmapEntry;
	tier: Tier;
	onTier: (tier: Tier) => void;
	onPlay: () => void;
	onBack: () => void;
}) {
	const [scores, setScores] = useState<ScoreEntry[] | null>(null);

	useEffect(() => {
		let cancelled = false;
		setScores(null);

		fetchBoard(entry.slug, tier)
			.then((board) => {
				if (!cancelled) setScores(board);
			})
			.catch(() => {
				if (!cancelled) setScores([]);
			});

		return () => {
			cancelled = true;
		};
	}, [entry.slug, tier]);

	const difficulty = entry.difficulties.find((d) => d.tier === tier);

	return (
		<section className="mt-10">
			<div className="rise">
				<h2 className="pixel-heading text-xl sm:text-2xl">{entry.title}</h2>
				<p className="mt-1 text-[color:var(--text-dim)] text-sm">{entry.artist}</p>
			</div>

			<div className="rise rise-1 mt-6 flex flex-wrap gap-2">
				{entry.difficulties.map((option) => (
					<button
						key={option.tier}
						type="button"
						onClick={() => onTier(option.tier)}
						aria-pressed={option.tier === tier}
						className={`${option.tier === tier ? "keycap" : "keycap-ghost"} px-4 py-2 text-sm`}
					>
						{option.tier}
						<span
							className={
								option.tier === tier ? "ml-2 opacity-60" : "ml-2 text-[color:var(--text-dim)]"
							}
						>
							CS{option.circleSize}
						</span>
					</button>
				))}
			</div>

			{difficulty && (
				<p className="rise rise-1 mt-3 text-[color:var(--text-dim)] text-xs">
					{difficulty.name} &middot; {difficulty.objectCount} objects &middot; AR
					{difficulty.approachRate}
				</p>
			)}

			<div className="rise rise-2 mt-8">
				<p className="section-label">High scores &mdash; {tier}</p>
				{scores === null ? (
					<p className="mt-4 cursor text-[color:var(--text-dim)] text-sm">LOADING BOARD... </p>
				) : (
					<Board scores={scores} />
				)}
			</div>

			<div className="rise rise-3 mt-10 flex flex-wrap gap-3">
				<button type="button" onClick={onPlay} className="keycap px-8 py-3 font-semibold">
					PLAY
				</button>
				<button type="button" onClick={onBack} className="keycap-ghost px-5 py-3">
					BACK
				</button>
			</div>
		</section>
	);
}

function Results({
	result,
	entry,
	onAgain,
	onSong,
}: {
	result: RunResult;
	entry: BeatmapEntry;
	onAgain: () => void;
	onSong: () => void;
}) {
	const [saved, setSaved] = useState<{ name: string; queued: boolean } | null>(null);
	const [board, setBoard] = useState<ScoreEntry[] | null>(null);

	const rows: Array<[string, string]> = [
		["SCORE", String(result.score).padStart(8, "0")],
		["ACCURACY", `${(result.accuracy * 100).toFixed(2)}%`],
		["MAX COMBO", `${result.maxCombo}x`],
		["CAUGHT", String(result.caught)],
		["MISSED", String(result.missed)],
	];

	async function save(name: string) {
		const outcome = await submitScore(result, name);
		setSaved({ name, queued: outcome === "queued" });
		try {
			setBoard(await fetchBoard(result.slug, result.tier));
		} catch {
			setBoard([]);
		}
	}

	return (
		<section className="mt-10">
			<div className="rise">
				<h2 className="pixel-heading text-2xl">Run complete</h2>
				<p className="mt-2 text-[color:var(--text-dim)] text-sm">
					{entry.artist} — {entry.title} [{result.tier}]
				</p>
			</div>

			<dl className="rise rise-1 panel mt-6 max-w-sm p-5">
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

			{!saved && (
				<div className="rise rise-2">
					<NameEntry onSubmit={save} />
				</div>
			)}

			{saved && (
				<div className="rise mt-8">
					<p
						className={
							saved.queued ? "text-[color:var(--destructive)]" : "text-[color:var(--bright)]"
						}
					>
						{saved.queued ? "SCORE SAVED LOCALLY — SYNC PENDING" : "SCORE SAVED"}
					</p>
					{board && <Board scores={board} highlight={saved.name} />}
				</div>
			)}

			<div className="rise rise-3 mt-10 flex flex-wrap gap-3">
				<button type="button" onClick={onAgain} className="keycap px-5 py-2.5 font-semibold">
					RETRY
				</button>
				<button type="button" onClick={onSong} className="keycap-ghost px-5 py-2.5">
					SONG
				</button>
				<Link href="/leaderboard" className="keycap-ghost px-5 py-2.5">
					BOARD
				</Link>
			</div>
		</section>
	);
}
