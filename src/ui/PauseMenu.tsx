"use client";

import { useStrings } from "@/i18n/strings";
import { Icon } from "./Icon";
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
	const { t } = useStrings();

	return (
		<div className="fixed inset-0 z-50 flex items-center justify-center bg-[rgba(26,26,23,0.86)]">
			<div className="scanlines pointer-events-none absolute inset-0" aria-hidden="true" />

			<div className="relative flex w-80 flex-col items-center gap-3">
				<p className="section-label mb-2">{t.paused}</p>

				<button
					type="button"
					onClick={onContinue}
					className="keycap inline-flex w-full items-center justify-center gap-2 py-3 font-semibold"
				>
					<Icon name="play" size={0.85} />
					{t.continue}
				</button>
				<button
					type="button"
					onClick={onRetry}
					className="keycap-ghost inline-flex w-full items-center justify-center gap-2 py-3"
				>
					<Icon name="retry" size={0.85} />
					{t.retry}
				</button>
				<button
					type="button"
					onClick={onQuit}
					className="keycap-ghost inline-flex w-full items-center justify-center gap-2 py-3"
				>
					<Icon name="quit" size={0.85} />
					{t.quit}
				</button>

				<div className="mt-6 w-full border-[color:var(--border)] border-t pt-5">
					{/* No preview here — a preview would need a second AudioContext beside
					    the one already driving the chart. */}
					<SoundControls compact />
				</div>

				<p className="mt-4 text-[color:var(--text-dim)] text-xs">{t.escToResume}</p>
			</div>
		</div>
	);
}
