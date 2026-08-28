import Link from "next/link";

/** Author credit, shown on the start screen and in the title screen's brand bar. */
export function MadeBy({ className = "" }: { className?: string }) {
	return (
		<Link
			href="https://jibaru.dev"
			target="_blank"
			rel="noreferrer"
			className={`section-label text-[color:var(--text-dim)] transition-colors hover:text-[color:var(--bright)] ${className}`}
		>
			Made by Jibaru.dev
		</Link>
	);
}
