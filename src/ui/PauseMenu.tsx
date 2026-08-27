"use client";

import { SoundControls } from "./SoundControls";

interface Props {
	onContinue: () => void;
	onRetry: () => void;
	onQuit: () => void;
}

/**
 * osu!'s pause menu: the run is frozen behind a dim, with continue / retry /
 * quit stacked in the middle. Escape reopens and closes it, which is why
 * Continue is listed first — it is what the key you just pressed already does.
 */
export function PauseMenu({ onContinue, onRetry, onQuit }: Props) {
	return (
		<div className="fixed inset-0 z-50 flex items-center justify-center bg-[rgba(26,26,23,0.86)]">
			<div className="scanlines pointer-events-none absolute inset-0" aria-hidden="true" />

			<div className="relative flex w-80 flex-col items-center gap-3">
				<p className="section-label mb-2">Paused</p>

				<button type="button" onClick={onContinue} className="keycap w-full py-3 font-semibold">
					CONTINUE
				</button>
				<button type="button" onClick={onRetry} className="keycap-ghost w-full py-3">
					RETRY
				</button>
				<button type="button" onClick={onQuit} className="keycap-ghost w-full py-3">
					QUIT
				</button>

				<div className="mt-6 w-full border-[color:var(--border)] border-t pt-5">
					{/* No preview here — a preview would need a second AudioContext beside
					    the one already driving the chart. */}
					<SoundControls compact />
				</div>

				<p className="mt-4 text-[color:var(--text-dim)] text-xs">ESC TO RESUME</p>
			</div>
		</div>
	);
}
