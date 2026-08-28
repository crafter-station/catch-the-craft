"use client";

import { useEffect, useState } from "react";

/** Simultaneous prefetches. Low enough to stay out of the way of gameplay assets. */
const CONCURRENCY = 4;

const thumbnail = (id: number) => `/api/participants/${String(id).padStart(3, "0")}`;

/**
 * The wall of hackathon badges.
 *
 * The roster size comes from the server rather than being hardcoded — people are
 * still registering, and a fixed count would be stale by the time the doors
 * open. Every thumbnail is then pulled in the background through our resizing
 * route, which serves them immutable, so scrolling the wall never waits on the
 * network and a reload costs nothing.
 */
export function ParticipantGallery() {
	const [ids, setIds] = useState<number[]>([]);

	useEffect(() => {
		let cancelled = false;

		(async () => {
			let count = 0;
			try {
				const response = await fetch("/api/participants");
				if (!response.ok) return;
				count = (await response.json()).count ?? 0;
			} catch {
				return; // No roster, no gallery. The menu works without it.
			}

			if (cancelled || count === 0) return;
			setIds(Array.from({ length: count }, (_, index) => index + 1));

			// Warm every thumbnail into the HTTP cache so the <img> tags below never
			// have to wait. One retry each, because dropping a person from the wall
			// over a single flaky response would be worse than the extra request.
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

	return (
		<aside className="hidden lg:block" aria-label="Hackathon participants">
			<p className="section-label">
				Hackers <span className="text-[color:var(--text-dim)]">{ids.length || ""}</span>
			</p>

			<div className="gallery-mask gallery-scroll mt-4 max-h-[68vh] overflow-y-auto pr-2">
				<div className="grid grid-cols-3 gap-2">
					{ids.map((id) => (
						<img
							key={id}
							src={thumbnail(id)}
							alt=""
							loading="lazy"
							decoding="async"
							width={320}
							height={400}
							// Participant numbers are not contiguous — a few in the middle have
							// no published badge — so drop the ones that turn out not to exist.
							onError={() => setIds((current) => current.filter((other) => other !== id))}
							className="aspect-4/5 w-full rounded-sm border border-[color:var(--border)] object-cover opacity-80 transition-opacity hover:opacity-100"
						/>
					))}
				</div>
			</div>

			{ids.length === 0 && (
				<p className="mt-4 cursor text-[color:var(--text-dim)] text-xs">LOADING BADGES... </p>
			)}
		</aside>
	);
}
