"use client";

interface Props {
	children: string;
	className?: string;
}

/**
 * Splits a heading into per-letter spans so each character can twitch on its own
 * offset. Rendered as one accessible label with the letters hidden from the
 * accessibility tree, or a screen reader would announce the word letter by letter.
 */
export function ShakyText({ children, className = "" }: Props) {
	return (
		<span className={`shaky ${className}`} aria-label={children}>
			{[...children].map((character, index) => (
				<span
					// Letters repeat within a word, so the index is the only stable key.
					key={`${character}-${index}`}
					aria-hidden="true"
					style={{ "--letter": index } as React.CSSProperties}
				>
					{character === " " ? " " : character}
				</span>
			))}
		</span>
	);
}
