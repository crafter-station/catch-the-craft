"use client";

import { useEffect, useRef, useState } from "react";
import { useStrings } from "@/i18n/strings";
import type { BeatmapEntry } from "@/game/library";
import { Icon } from "./Icon";

export interface PlayerTrack {
	url: string;
	previewMs: number;
}

interface Props {
	library: BeatmapEntry[];
	/** The opening themes for the current language. */
	themes: string[];
	/** What the menus are actually playing right now. */
	currentUrl: string | null;
	/** `null` hands control back to the screen you are on. */
	onSelect: (track: PlayerTrack | null) => void;
	/** True while a track was chosen by hand rather than by the current screen. */
	pinned: boolean;
}

/**
 * A playlist for the menu music.
 *
 * The menus already pick a track for you — an opening theme, or the beatmap
 * whose screen you are on. This lets someone at the booth override that and sit
 * on a particular song, which is mostly what people want from music they can
 * hear across a room. Choosing Auto hands it back.
 */
export function MusicPlayer({ library, themes, currentUrl, onSelect, pinned }: Props) {
	const { t } = useStrings();
	const [open, setOpen] = useState(false);
	const container = useRef<HTMLDivElement>(null);

	// Click-away, so the panel does not have to be dismissed by the same button.
	useEffect(() => {
		if (!open) return;

		const onPointerDown = (event: PointerEvent) => {
			if (!container.current?.contains(event.target as Node)) setOpen(false);
		};
		document.addEventListener("pointerdown", onPointerDown);
		return () => document.removeEventListener("pointerdown", onPointerDown);
	}, [open]);

	const choose = (track: PlayerTrack | null) => {
		onSelect(track);
		setOpen(false);
	};

	return (
		<div ref={container} className="relative">
			<button
				type="button"
				onClick={() => setOpen((value) => !value)}
				aria-expanded={open}
				aria-label={t.playlist}
				className={`${pinned ? "keycap" : "keycap-ghost"} inline-flex items-center gap-2 px-3 py-1.5 text-xs`}
			>
				<Icon name="note" size={0.9} />
				<span className="hidden sm:inline">{t.playlist}</span>
			</button>

			{open && (
				<div className="panel absolute right-0 z-50 mt-2 max-h-[60vh] w-72 overflow-y-auto gallery-scroll p-3 text-left">
					<Row
						label={t.auto}
						hint={t.nowPlaying}
						active={!pinned}
						onClick={() => choose(null)}
					/>

					<p className="section-label mt-4 mb-1 text-[color:var(--text-dim)]">{t.opening}</p>
					{themes.map((url, index) => (
						<Row
							key={url}
							label={`${t.opening} ${index + 1}`}
							active={currentUrl === url}
							onClick={() => choose({ url, previewMs: 0 })}
						/>
					))}

					<p className="section-label mt-4 mb-1 text-[color:var(--text-dim)]">{t.beatmaps}</p>
					{library.map((entry) => (
						<Row
							key={entry.slug}
							label={entry.title}
							hint={entry.artist}
							active={currentUrl === entry.audio}
							onClick={() => choose({ url: entry.audio, previewMs: entry.previewMs })}
						/>
					))}
				</div>
			)}
		</div>
	);
}

function Row({
	label,
	hint,
	active,
	onClick,
}: {
	label: string;
	hint?: string;
	active: boolean;
	onClick: () => void;
}) {
	return (
		<button
			type="button"
			onClick={onClick}
			className={`flex w-full items-center gap-2 rounded px-2 py-1.5 text-left transition-colors hover:bg-[color:var(--screen)] ${
				active ? "text-[color:var(--bright)]" : "text-[color:var(--text-dim)]"
			}`}
		>
			<span className="w-3 shrink-0">{active ? "▸" : ""}</span>
			<span className="min-w-0 flex-1 truncate text-sm">{label}</span>
			{hint && <span className="shrink-0 truncate text-[10px] opacity-60">{hint}</span>}
		</button>
	);
}
