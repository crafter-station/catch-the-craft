"use client";

import { useEffect, useState } from "react";
import { useStrings } from "@/i18n/strings";

/** How long each badge stays up. */
const ROTATE_MS = 1500;

/** Simultaneous prefetches. Low enough to stay out of the way of gameplay assets. */
const CONCURRENCY = 4;

const thumbnail = (id: number) => `/api/participants/${String(id).padStart(3, "0")}`;

/**
 * One hackathon badge at a time, cross-fading to the next.
 *
 * Every badge is still pulled down up front, so the rotation never waits on the
 * network — at 900ms a single uncached image would be a visible stall. The
 * roster size comes from the server rather than being hardcoded, since people
 * are still registering, and numbers that turn out to have no published badge
 * drop out rather than showing a broken frame.
 */
export function ParticipantCarousel({ className = "" }: { className?: string }) {
	const { t } = useStrings();
	const [ids, setIds] = useState<number[]>([]);
	const [index, setIndex] = useState(0);
	const [paused, setPaused] = useState(false);

	useEffect(() => {
		let cancelled = false;

		(async () => {
			let count = 0;
			try {
				const response = await fetch("/api/participants");
				if (!response.ok) return;
				count = (await response.json()).count ?? 0;
			} catch {
				return; // No roster, no carousel. The menu works without it.
			}

			if (cancelled || count === 0) return;
			setIds(Array.from({ length: count }, (_, position) => position + 1));

			let next = 0;
			const warm = async () => {
				while (!cancelled && next < count) {
					const id = next++ + 1;
					for (let attempt = 0; attempt < 2; attempt++) {
						try {
							const response = await fetch(thumbnail(id));
							if (response.ok) {
								await response.arrayBuffer();
								break;
							}
							if (response.status === 404) break;
						} catch {
							// Retry once, then move on.
						}
					}
				}
			};

			await Promise.all(Array.from({ length: CONCURRENCY }, warm));
		})();

		return () => {
			cancelled = true;
		};
	}, []);

	useEffect(() => {
		if (ids.length < 2 || paused) return;
		const timer = window.setInterval(() => setIndex((value) => value + 1), ROTATE_MS);
		return () => window.clearInterval(timer);
	}, [ids.length, paused]);

	if (ids.length === 0) {
		return (
			<aside className={`hidden lg:block ${className}`} aria-label="Hackathon participants">
				<p className="section-label">{t.hackers}</p>
				<p className="mt-4 cursor text-[color:var(--text-dim)] text-xs">{t.loadingBadges} </p>
			</aside>
		);
	}

	const current = ids[index % ids.length];
	const previous = ids[(index - 1 + ids.length) % ids.length];

	const drop = (id: number) =>
		setIds((existing) => existing.filter((other) => other !== id));

	return (
		<aside
			className={`hidden lg:block ${className}`}
			aria-label="Hackathon participants"
			onMouseEnter={() => setPaused(true)}
			onMouseLeave={() => setPaused(false)}
		>
			<div className="flex items-baseline justify-between">
				<p className="section-label">{t.hackers}</p>
				<p className="text-[color:var(--text-dim)] text-xs tabular-nums">
					{String(current).padStart(3, "0")} / {ids.length}
				</p>
			</div>

			{/* The outgoing badge stays underneath while the incoming one fades in,
			    so the frame is never empty between them. */}
			{/* Height-led rather than width-led: the title screen does not scroll, so the
			    badge has to give way on short viewports instead of pushing past them. */}
			<div className="shaky-box relative mx-auto mt-4 aspect-4/5 h-[min(32vh,300px)] overflow-hidden rounded-sm border border-[color:var(--border)]">
				{previous !== current && (
					<img
						key={`under-${previous}`}
						src={thumbnail(previous)}
						alt=""
						aria-hidden="true"
						className="absolute inset-0 h-full w-full object-cover"
					/>
				)}
				<img
					key={`over-${current}`}
					src={thumbnail(current)}
					alt={`Participant ${String(current).padStart(3, "0")}`}
					onError={() => drop(current)}
					className="rise absolute inset-0 h-full w-full object-cover"
				/>
			</div>

			<p className="mt-3 text-[color:var(--text-dim)] text-xs">
				{paused ? t.paused.toUpperCase() : t.roster}
			</p>
		</aside>
	);
}
