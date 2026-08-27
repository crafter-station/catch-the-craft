"use client";

import { useEffect, useRef, useState } from "react";

interface Props {
	onSubmit: (initials: string) => void;
}

/**
 * Three-letter arcade initials, entered into three keycaps.
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
			<label htmlFor="initials" className="section-label block">
				Enter initials
			</label>

			{/* Clicking anywhere on the slots refocuses the real input behind them. */}
			<button
				type="button"
				className="mt-3 flex items-center gap-3"
				onClick={() => inputRef.current?.focus()}
			>
				{[0, 1, 2].map((slot) => (
					<span
						key={slot}
						className={`flex h-20 w-16 items-center justify-center font-[family-name:var(--font-pixel)] font-bold text-3xl ${
							slot === initials.length ? "keycap cursor" : "keycap-ghost"
						}`}
					>
						{initials[slot] ?? ""}
					</span>
				))}
			</button>

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

			<button type="submit" disabled={!complete} className="keycap mt-6 px-5 py-2.5 font-semibold">
				SAVE SCORE
			</button>
		</form>
	);
}
