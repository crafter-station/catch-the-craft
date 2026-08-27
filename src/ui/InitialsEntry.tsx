"use client";

import { useEffect, useRef, useState } from "react";

interface Props {
	onSubmit: (initials: string) => void;
}

/**
 * Three-letter arcade initials.
 *
 * Chosen over a free-text name because there is a queue of people behind the
 * player: three keystrokes and you are done, no length limits to enforce and no
 * moderation queue to run at a live event.
 */
export function InitialsEntry({ onSubmit }: Props) {
	const [initials, setInitials] = useState("");
	const inputRef = useRef<HTMLInputElement>(null);

	useEffect(() => {
		inputRef.current?.focus();
	}, []);

	const complete = initials.length === 3;

	return (
		<form
			className="mt-8"
			onSubmit={(event) => {
				event.preventDefault();
				if (complete) onSubmit(initials);
			}}
		>
			<label htmlFor="initials" className="block opacity-70">
				ENTER INITIALS
			</label>

			<div className="mt-3 flex items-center gap-3">
				{[0, 1, 2].map((slot) => (
					<span
						key={slot}
						className="glow flex h-16 w-14 items-center justify-center border border-[color:var(--color-phosphor-dim)] font-[family-name:var(--font-silkscreen)] text-3xl"
					>
						{initials[slot] ?? (slot === initials.length ? "_" : "")}
					</span>
				))}
			</div>

			<input
				ref={inputRef}
				id="initials"
				value={initials}
				onChange={(event) =>
					setInitials(
						event.target.value
							.toUpperCase()
							.replace(/[^A-Z0-9]/g, "")
							.slice(0, 3),
					)
				}
				className="sr-only"
				autoComplete="off"
				aria-label="Three letter initials"
			/>

			<button
				type="submit"
				disabled={!complete}
				className="mt-6 border border-[color:var(--color-phosphor)] px-4 py-2 disabled:opacity-30 enabled:hover:bg-[color:var(--color-phosphor)] enabled:hover:text-[color:var(--color-void)]"
			>
				SAVE SCORE
			</button>
		</form>
	);
}
