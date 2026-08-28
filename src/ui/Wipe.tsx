"use client";

import { useCallback, useEffect, useRef, useState } from "react";

/** Total length of the wipe animation, matching `wipe-through` in globals.css. */
const WIPE_MS = 1100;

/** Point at which the panel fully covers the screen, so the swap is unseen. */
const SWAP_AT_MS = 550;

/**
 * Screen wipe.
 *
 * The phase change happens while the panel covers the screen rather than before
 * it, so the incoming screen is never caught mid-mount — which matters most on
 * the way into a run, where the canvas is still sizing itself and decoding audio.
 */
export function useWipe() {
	const [label, setLabel] = useState<string | null>(null);
	const timers = useRef<number[]>([]);

	useEffect(
		() => () => {
			for (const id of timers.current) window.clearTimeout(id);
		},
		[],
	);

	const wipeTo = useCallback((text: string, action: () => void) => {
		setLabel(text);
		timers.current.push(
			window.setTimeout(action, SWAP_AT_MS),
			window.setTimeout(() => setLabel(null), WIPE_MS),
		);
	}, []);

	return { wipeLabel: label, wipeTo };
}

export function Wipe({ label }: { label: string }) {
	return (
		<div className="wipe" aria-hidden="true">
			<div className="scanlines pointer-events-none absolute inset-0" />
			<p className="wipe-label cursor section-label">{label} </p>
		</div>
	);
}
