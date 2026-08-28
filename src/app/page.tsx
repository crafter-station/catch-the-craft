"use client";

import { useUser } from "@clerk/nextjs";
import type { Locale } from "@/i18n/locale";
import { tierLabel, useStrings } from "@/i18n/strings";
import Link from "next/link";
import { useCallback, useEffect, useRef, useState } from "react";
import { prefetchAudio } from "@/game/audio/cache";
import { menuContext } from "@/game/audio/menu-audio";
import { disposeMenuMusic, playMenuTrack, stopMenuTrack } from "@/game/audio/menu-music";
import type { RunResult } from "@/game/engine";
import { type BeatmapEntry, loadManifest, type Tier } from "@/game/library";
import { fetchBoard, flushPending, submitScore } from "@/scores/client";
import type { ScoreEntry } from "@/scores/repository";
import { Board } from "@/ui/Board";
import { BrandBar } from "@/ui/BrandBar";
import { GameCanvas } from "@/ui/GameCanvas";
import { Icon } from "@/ui/Icon";
import { NameEntry } from "@/ui/NameEntry";
import { ParticipantCarousel } from "@/ui/ParticipantCarousel";
import { ShakyText } from "@/ui/ShakyText";
import { SponsorStrip } from "@/ui/SponsorStrip";
import { SoundControls } from "@/ui/SoundControls";
import { LanguageToggle } from "@/ui/LanguageToggle";
import { MadeBy } from "@/ui/MadeBy";
import { MusicPlayer, type PlayerTrack } from "@/ui/MusicPlayer";
import { UiSounds } from "@/ui/UiSounds";
import { useWipe, Wipe } from "@/ui/Wipe";

/**
 * The opening themes, per language. One is chosen at random per visit, so the
 * booth is not playing the same track to everyone across twelve hours.
 *
 * Indexed rather than picked per language: switching to Spanish plays the
 * Spanish cut of the track already going, not a different song.
 */
const MENU_THEMES: Record<Locale, string[]> = {
	en: ["/music/triangles2.mp3", "/music/triangles2.2.mp3"],
	es: ["/music/triangles2.esp.mp3", "/music/triangles2.2.esp.mp3"],
};

type Phase =
	| { name: "loading" }
	| { name: "start" }
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
	const [themeIndex, setThemeIndex] = useState<number | null>(null);
	const [pinnedTrack, setPinnedTrack] = useState<PlayerTrack | null>(null);
	const { t, current: language } = useStrings();
	const { wipeLabel, wipeTo } = useWipe();

	useEffect(() => {
		// Deliver anything the last session could not send before doing anything else.
		void flushPending();

		loadManifest()
			.then((entries) => {
				setLibrary(entries);
				setPhase({ name: "start" });
			})
			.catch((error: Error) => setPhase({ name: "error", message: error.message }));
	}, []);

	// Rolled after mount: choosing during render would differ between the server
	// pass and the client one and trip hydration.
	useEffect(() => {
		setThemeIndex(Math.floor(Math.random() * MENU_THEMES.en.length));
	}, []);

	const themeUrl = themeIndex === null ? null : MENU_THEMES[language][themeIndex];

	useEffect(() => () => disposeMenuMusic(), []);

	/**
	 * The menus play the lazer theme, except on a song screen, where they switch
	 * to that beatmap from its own preview point the way osu! song select does.
	 * A run goes quiet here, because it brings its own audio.
	 *
	 * Held as primitives rather than an object so the effect does not re-fire on
	 * every render and restart the track.
	 */
	// What the current screen would play on its own, and what the player pinned
	// over it. Pinning wins until it is cleared, including across screens — the
	// point of choosing a track by hand is that it keeps going.
	const screenTrack: PlayerTrack | null =
		phase.name === "song"
			? { url: phase.entry.audio, previewMs: phase.entry.previewMs }
			: themeUrl
				? { url: themeUrl, previewMs: 0 }
				: null;
	const chosen = pinnedTrack ?? screenTrack;
	const menuUrl = phase.name === "playing" ? null : (chosen?.url ?? null);
	const menuPreviewMs = chosen?.previewMs ?? 0;

	// Scheduled straight away rather than waiting for a gesture: the context starts
	// suspended when autoplay is blocked, and resumes itself on the first
	// interaction with the track already loaded and queued.
	useEffect(() => {
		if (!menuUrl) {
			stopMenuTrack();
			return;
		}
		void playMenuTrack(menuUrl, menuPreviewMs);
	}, [menuUrl, menuPreviewMs]);

	// Pull the beatmap tracks down while someone is still reading the menu, so
	// starting a run does not wait on a few megabytes of venue wifi.
	useEffect(() => {
		if (library.length === 0) return;
		void (async () => {
			// Only the theme this visit picked; the other is pulled down on the visit
			// it comes up, rather than paying for both every time.
			if (themeUrl) await prefetchAudio(themeUrl);
			for (const entry of library) await prefetchAudio(entry.audio);
		})();
	}, [library, themeUrl]);

	/**
	 * The track is already fetched, decoded and scheduled; this click is simply the
	 * activation the browser was waiting for, so the music starts on the press
	 * rather than some way after it.
	 */
	function begin() {
		void menuContext();
		setPhase({ name: "title" });
	}

	if (phase.name === "playing") {
		return (
			<>
				<UiSounds />
				<GameCanvas
					entry={phase.entry}
					tier={phase.tier}
					onEnd={(result) =>
						wipeTo(t.wipeResults, () => setPhase({ name: "results", entry: phase.entry, result }))
					}
					onQuit={() =>
						wipeTo(t.wipeList, () => setPhase({ name: "song", entry: phase.entry, tier: phase.tier }))
					}
					onError={(message) => setPhase({ name: "error", message })}
				/>
				{wipeLabel && <Wipe label={wipeLabel} />}
			</>
		);
	}

	return (
		<div className="relative min-h-dvh overflow-hidden">
			<UiSounds />
			<div className="grid-bg" aria-hidden="true" />
			<div className="scanlines pointer-events-none fixed inset-0 z-40" aria-hidden="true" />

			<main
				// Every menu screen is pinned to the viewport; lists scroll in their own boxes.
				className={`relative z-10 mx-auto flex h-dvh flex-col overflow-hidden px-6 ${
					phase.name === "title"
						? "max-w-6xl gap-5 py-6"
						: phase.name === "results"
							? "max-w-5xl gap-4 py-8"
							: phase.name === "songs" || phase.name === "song"
								? "max-w-3xl gap-3 py-8"
								: "max-w-3xl justify-center py-12"
				}`}
			>
				{/* Held back on the start screen so it is one of the things that fades in. */}
				{phase.name !== "start" && phase.name !== "loading" && (
					<BrandBar className={phase.name === "title" ? "rise" : ""}>
						<MusicPlayer
							library={library}
							themes={MENU_THEMES[language]}
							currentUrl={menuUrl}
							onSelect={setPinnedTrack}
							pinned={pinnedTrack !== null}
						/>
					</BrandBar>
				)}

				<Header
					compact={
						phase.name !== "title" && phase.name !== "start" && phase.name !== "loading"
					}
				/>

				{phase.name === "loading" && (
					<p className="mt-10 cursor text-[color:var(--text-dim)]">{t.loadingBeatmaps}{" "}</p>
				)}

				{phase.name === "error" && (
					<div className="panel mt-10 p-6">
						<p className="text-[color:var(--destructive)]">?{phase.message.toUpperCase()}</p>
						<p className="mt-2 cursor text-[color:var(--text-dim)]">READY. </p>
					</div>
				)}

				{phase.name === "start" && <StartScreen onStart={begin} />}

				{phase.name === "title" && (
					<div className="grid min-h-0 flex-1 items-center gap-10 lg:grid-cols-[minmax(0,1fr)_17rem]">
						<TitleScreen
							onPlay={() => setPhase({ name: "songs" })}
							onSettings={() => setPhase({ name: "settings" })}
						/>
						<ParticipantCarousel className="rise rise-3" />
					</div>
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
							wipeTo(t.wipeLoading, () =>
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
							wipeTo(t.wipeLoading, () =>
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
				{phase.name === "title" && <SponsorStrip className="rise rise-5" />}
			</main>

			{wipeLabel && <Wipe label={wipeLabel} />}
		</div>
	);
}

function Header({ compact }: { compact: boolean }) {
	const { t } = useStrings();

	return (
		<header className="border-[color:var(--border)] border-b pb-6">
			<p className="section-label">{t.arcade}</p>
			<h1
				className={`pixel-heading mt-3 ${compact ? "text-2xl sm:text-3xl" : "text-3xl sm:text-5xl"}`}
			>
				<ShakyText>Catch the Craft</ShakyText>
			</h1>
		</header>
	);
}

function StartScreen({ onStart }: { onStart: () => void }) {
	const { t } = useStrings();

	return (
		<section className="mt-16 flex flex-col items-center gap-6">
			<button
				type="button"
				onClick={onStart}
				className="keycap inline-flex items-center justify-center gap-3 px-16 py-6 font-semibold text-2xl"
			>
				<Icon name="power" size={0.9} />
				<ShakyText>{t.start}</ShakyText>
			</button>
			<p className="section-label text-[color:var(--text-dim)]">{t.pressToBegin}</p>
			<LanguageToggle />
			<MadeBy className="mt-2" />
		</section>
	);
}

function TitleScreen({ onPlay, onSettings }: { onPlay: () => void; onSettings: () => void }) {
	const { t } = useStrings();

	return (
		<section>
			<p className="rise text-[color:var(--text-dim)] text-sm">10 RUN</p>

			<div className="rise rise-1 mt-6 flex w-full max-w-xs flex-col gap-3">
				<button
					type="button"
					onClick={onPlay}
					className="keycap inline-flex items-center justify-center gap-3 py-4 font-semibold text-lg"
				>
					<Icon name="play" size={0.9} />
					<ShakyText>{t.play}</ShakyText>
				</button>
				<button
					type="button"
					onClick={onSettings}
					className="keycap-ghost inline-flex items-center justify-center gap-3 py-4"
				>
					<Icon name="sliders" size={0.9} />
					<ShakyText>{t.settings}</ShakyText>
				</button>
				<Link
					href="/leaderboard"
					className="keycap-ghost inline-flex items-center justify-center gap-3 py-4"
				>
					<Icon name="trophy" size={0.9} />
					<ShakyText>{t.highScores.toUpperCase()}</ShakyText>
				</Link>
			</div>

			<LanguageToggle className="rise rise-2 mt-6" />

			<p className="rise rise-2 section-label mt-8">{t.controls}</p>
		</section>
	);
}

function SettingsScreen({ onBack }: { onBack: () => void }) {
	const { t } = useStrings();

	return (
		<section className="mt-10">
			<p className="rise section-label">{t.settings}</p>

			<div className="rise rise-1 mt-6 max-w-md">
				<SoundControls preview />
			</div>

			<div className="rise rise-1 mt-6">
				<p className="section-label">{t.language}</p>
				<LanguageToggle className="mt-3" />
			</div>

			<p className="rise rise-2 mt-6 text-[color:var(--text-dim)] text-xs">{t.levelsOnDevice}</p>

			<button type="button" onClick={onBack} className="keycap-ghost mt-8 inline-flex items-center gap-2 px-5 py-2.5">
				<Icon name="back" size={0.85} />
				{t.back}
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
	const { t } = useStrings();

	return (
		<section className="flex min-h-0 flex-1 flex-col">
			<p className="rise text-[color:var(--text-dim)] text-sm">20 LOAD &quot;BEATMAP&quot;,8,1</p>

			{/* The list scrolls inside its own box; the page itself never does. */}
			<div className="gallery-mask gallery-scroll mt-5 min-h-0 flex-1 overflow-y-auto pr-2">
				<ul className="space-y-3">
					{library.map((entry, index) => (
						<li key={entry.slug} className={`rise rise-${Math.min(3, index + 1)}`}>
							<button
								type="button"
								onClick={() => onSelect(entry)}
								className="panel block w-full p-4 text-left transition-colors hover:bg-[color:var(--screen)]"
							>
								<div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
									<span className="text-[color:var(--text-dim)] text-sm tabular-nums">
										{String((index + 1) * 10).padStart(3, "0")}
									</span>
									<h2 className="pixel-heading text-base sm:text-lg">{entry.title}</h2>
									{entry.tournament && (
										<span className="rounded bg-[color:var(--bone)] px-2 py-0.5 font-semibold text-[10px] text-[color:var(--void)] tracking-[0.12em]">
											{t.featured}
										</span>
									)}
								</div>
								<p className="mt-1 text-[color:var(--text-dim)] text-sm">{entry.artist}</p>
							</button>
						</li>
					))}
				</ul>
			</div>

			<button type="button" onClick={onBack} className="keycap-ghost mt-5 inline-flex items-center gap-2 self-start px-5 py-2.5">
				<Icon name="back" size={0.85} />
				{t.back}
			</button>
		</section>
	);
}

/**
 * Song detail: pick a difficulty, see who is ahead of you on it, then play.
 *
 * The board sits between choosing and playing on purpose — a target read ten
 * seconds before a run is worth more than one read after it.
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
	const { t } = useStrings();
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
		<section className="flex min-h-0 flex-1 flex-col">
			<div className="rise">
				<h2 className="pixel-heading text-xl sm:text-2xl">{entry.title}</h2>
				<p className="mt-1 text-[color:var(--text-dim)] text-sm">{entry.artist}</p>
			</div>

			<div className="rise rise-1 mt-5 flex flex-wrap gap-2">
				{entry.difficulties.map((option) => (
					<button
						key={option.tier}
						type="button"
						onClick={() => onTier(option.tier)}
						aria-pressed={option.tier === tier}
						className={`${option.tier === tier ? "keycap" : "keycap-ghost"} px-4 py-2 text-sm`}
					>
						{tierLabel(t, option.tier)}
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
					{difficulty.name} &middot; {difficulty.objectCount} {t.objects} &middot; AR
					{difficulty.approachRate}
				</p>
			)}

			<div className="rise rise-2 mt-6 flex min-h-0 flex-1 flex-col">
				<p className="section-label">
					{t.highScores} &mdash; {tierLabel(t, tier)}
				</p>
				{scores === null ? (
					<p className="mt-4 cursor text-[color:var(--text-dim)] text-sm">{t.loadingBoard} </p>
				) : (
					<div className="gallery-mask gallery-scroll min-h-0 flex-1 overflow-y-auto pr-2">
						<Board scores={scores} />
					</div>
				)}
			</div>

			<div className="rise rise-3 mt-5 flex flex-wrap gap-3">
				<button
					type="button"
					onClick={onPlay}
					className="keycap inline-flex items-center gap-2 px-8 py-3 font-semibold"
				>
					<Icon name="play" size={0.85} />
					{t.play}
				</button>
				<button
					type="button"
					onClick={onBack}
					className="keycap-ghost inline-flex items-center gap-2 px-5 py-3"
				>
					<Icon name="back" size={0.85} />
					{t.back}
				</button>
			</div>
		</section>
	);
}

/**
 * Results, two columns so nothing scrolls: the run on the left, the board it
 * just joined on the right. The board loads immediately rather than after
 * saving, so the space is doing something while the name is being typed.
 */
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
	const { t } = useStrings();
	const { isSignedIn, user } = useUser();
	const [saved, setSaved] = useState<{ name: string; queued: boolean } | null>(null);
	const [board, setBoard] = useState<ScoreEntry[] | null>(null);
	const autoSaved = useRef(false);

	const refreshBoard = useCallback(async () => {
		try {
			setBoard(await fetchBoard(result.slug, result.tier));
		} catch {
			setBoard([]);
		}
	}, [result.slug, result.tier]);

	useEffect(() => {
		void refreshBoard();
	}, [refreshBoard]);

	const rows: Array<[string, string]> = [
		[t.score, String(result.score).padStart(8, "0")],
		[t.accuracy, `${(result.accuracy * 100).toFixed(2)}%`],
		[t.maxCombo, `${result.maxCombo}x`],
		[t.caught, String(result.caught)],
		[t.missed, String(result.missed)],
	];

	async function save(name: string) {
		const outcome = await submitScore(result, name);
		setSaved({ name, queued: outcome === "queued" });
		await refreshBoard();
	}

	// A signed-in run saves itself. The ref guards against the effect re-running
	// and submitting the same result twice.
	useEffect(() => {
		if (!isSignedIn || autoSaved.current) return;
		autoSaved.current = true;
		void save(user?.primaryEmailAddress?.emailAddress ?? "PLAYER");
	});

	return (
		<section className="grid min-h-0 flex-1 gap-8 lg:grid-cols-2">
			<div className="flex min-h-0 flex-col overflow-y-auto pr-1">
				<div className="rise">
					<h2 className="pixel-heading text-2xl">{t.runComplete}</h2>
					<p className="mt-2 text-[color:var(--text-dim)] text-sm">
						{entry.artist} — {entry.title} [{tierLabel(t, result.tier)}]
					</p>
				</div>

				<dl className="rise rise-1 panel mt-5 p-4">
					{rows.map(([label, value], index) => (
						<div
							key={label}
							className={`flex justify-between py-1.5 ${
								index > 0 ? "border-[color:var(--border)] border-t" : ""
							}`}
						>
							<dt className="text-[color:var(--text-dim)] text-sm">{label}</dt>
							<dd className="font-[family-name:var(--font-pixel)] tabular-nums">{value}</dd>
						</div>
					))}
				</dl>

				{!saved && !isSignedIn && (
					<div className="rise rise-2">
						<NameEntry onSubmit={save} />
					</div>
				)}

				{saved && (
					<p
						className={`rise mt-6 ${
							saved.queued ? "text-[color:var(--destructive)]" : "text-[color:var(--bright)]"
						}`}
					>
						{saved.queued ? t.scoreQueued : t.scoreSaved}
					</p>
				)}

				<div className="rise rise-3 mt-6 flex flex-wrap gap-3">
					<button
						type="button"
						onClick={onAgain}
						className="keycap inline-flex items-center gap-2 px-5 py-2.5 font-semibold"
					>
						<Icon name="retry" size={0.85} />
						{t.retry}
					</button>
					<button
						type="button"
						onClick={onSong}
						className="keycap-ghost inline-flex items-center gap-2 px-5 py-2.5"
					>
						<Icon name="note" size={0.85} />
						{t.song}
					</button>
					<Link
						href="/leaderboard"
						className="keycap-ghost inline-flex items-center gap-2 px-5 py-2.5"
					>
						<Icon name="trophy" size={0.85} />
						{t.board}
					</Link>
				</div>
			</div>

			<div className="rise rise-2 flex min-h-0 flex-col">
				<p className="section-label">
					{entry.title} &mdash; {tierLabel(t, result.tier)}
				</p>
				<div className="gallery-mask gallery-scroll min-h-0 flex-1 overflow-y-auto pr-2">
					{board === null ? (
						<p className="mt-4 cursor text-[color:var(--text-dim)] text-sm">{t.loadingBoard} </p>
					) : (
						<Board scores={board} highlight={saved?.name} />
					)}
				</div>
			</div>
		</section>
	);
}
