"use client";

import { useStrings } from "@/i18n/strings";
import { LanguageToggle } from "./LanguageToggle";
import { MadeBy } from "./MadeBy";
import { ShakyText } from "./ShakyText";

/**
 * What a phone gets instead of the game.
 *
 * The chart is built around a keyboard or a mouse across a 512-unit playfield,
 * and squeezed onto a phone it plays badly enough that letting someone try is
 * worse than telling them not to. The theme still plays — the QR is on a poster
 * at a booth, and hearing it is most of why someone scanned the code.
 */
export function MobileNotice() {
	const { t } = useStrings();

	return (
		<div className="relative min-h-dvh overflow-hidden">
			<div className="grid-bg" aria-hidden="true" />
			<div className="scanlines pointer-events-none fixed inset-0 z-40" aria-hidden="true" />

			<main className="relative z-10 mx-auto flex min-h-dvh max-w-xl flex-col justify-center gap-8 px-6 py-12 text-center">
				<div className="flex items-center justify-center gap-3">
					<img
						src="/brand/crafter-station-icon.svg"
						alt=""
						width={24}
						height={24}
						className="h-6 w-6"
					/>
					<span className="section-label text-[color:var(--text-dim)]">{t.arcade}</span>
				</div>

				<h1 className="pixel-heading text-3xl">
					<ShakyText>Catch the Craft</ShakyText>
				</h1>

				<div className="panel p-6">
					<p className="section-label">{t.desktopOnly}</p>
					<p className="mt-3 text-[color:var(--text-dim)] text-sm leading-relaxed">
						{t.desktopBody}
					</p>
				</div>

				<p className="cursor text-[color:var(--text-dim)] text-xs">{t.tapForSound} </p>

				<div className="flex justify-center">
					<LanguageToggle />
				</div>

				<MadeBy />
			</main>
		</div>
	);
}
