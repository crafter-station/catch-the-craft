import Link from "next/link";
import { AuthControls } from "./AuthControls";
import { MadeBy } from "./MadeBy";

/** This project's source. */
const REPOSITORY = "https://github.com/crafter-station/catch-the-craft";

/**
 * Crafter Station's mark, the author credit, and a way back to the code.
 *
 * Sits above everything else on the menu screens so the game reads as part of
 * the event rather than something detached from it.
 */
export function BrandBar({
	className = "",
	children,
}: {
	className?: string;
	children?: React.ReactNode;
}) {
	// Positioned and lifted deliberately: the reveal animation on this element
	// gives it a stacking context of its own, which would otherwise trap the
	// playlist panel's z-index inside it and paint the panel under the screen
	// content below.
	return (
		<div className={`relative z-30 flex items-center justify-between gap-4 ${className}`}>
			<Link
				href="https://crafterstation.com"
				target="_blank"
				rel="noreferrer"
				className="flex items-center gap-3"
				aria-label="Crafter Station"
			>
				<img
					src="/brand/crafter-station-icon.svg"
					alt=""
					width={28}
					height={28}
					className="h-7 w-7"
				/>
				<span className="section-label hidden text-[color:var(--text-dim)] sm:inline">
					Crafter Station
				</span>
			</Link>

			<div className="flex items-center gap-4">
				<MadeBy className="hidden lg:inline" />
				{children}
				<AuthControls />

				<Link
					href={REPOSITORY}
					target="_blank"
					rel="noreferrer"
					className="section-label flex items-center gap-2 text-[color:var(--text-dim)] transition-colors hover:text-[color:var(--bright)]"
				>
					<svg viewBox="0 0 16 16" width="16" height="16" fill="currentColor" aria-hidden="true">
						<title>GitHub</title>
						<path d="M8 0C3.58 0 0 3.58 0 8c0 3.54 2.29 6.53 5.47 7.59.4.07.55-.17.55-.38 0-.19-.01-.82-.01-1.49-2.01.37-2.53-.49-2.69-.94-.09-.23-.48-.94-.82-1.13-.28-.15-.68-.52-.01-.53.63-.01 1.08.58 1.23.82.72 1.21 1.87.87 2.33.66.07-.52.28-.87.51-1.07-1.78-.2-3.64-.89-3.64-3.95 0-.87.31-1.59.82-2.15-.08-.2-.36-1.02.08-2.12 0 0 .67-.21 2.2.82.64-.18 1.32-.27 2-.27s1.36.09 2 .27c1.53-1.04 2.2-.82 2.2-.82.44 1.1.16 1.92.08 2.12.51.56.82 1.27.82 2.15 0 3.07-1.87 3.75-3.65 3.95.29.25.54.73.54 1.48 0 1.07-.01 1.93-.01 2.2 0 .21.15.46.55.38A8.01 8.01 0 0 0 16 8c0-4.42-3.58-8-8-8Z" />
					</svg>
					Source
				</Link>
			</div>
		</div>
	);
}
