"use client";

import { useEffect, useRef, useState } from "react";
import { MAX_NAME_LENGTH, NAME_PATTERN } from "@/scores/repository";

interface Props {
	onSubmit: (name: string) => void;
}

/**
 * Name entry for the board, up to ten characters.
 *
 * Still typed in an arcade cabinet's register — uppercase, fixed width, one
 * keycap-styled field — but wide enough for a team name rather than three
 * initials, which is what people actually want to see next to their score.
 */
export function NameEntry({ onSubmit }: Props) {
	const [name, setName] = useState("");
	const inputRef = useRef<HTMLInputElement>(null);

	useEffect(() => {
		inputRef.current?.focus();
	}, []);

	const trimmed = name.trim();
	const valid = NAME_PATTERN.test(trimmed);

	return (
		<form
			className="mt-8"
			onSubmit={(event) => {
				event.preventDefault();
				if (valid) onSubmit(trimmed);
			}}
		>
			<label htmlFor="player-name" className="section-label block">
				Enter name
			</label>

			<div className="mt-3 flex flex-wrap items-center gap-3">
				<input
					ref={inputRef}
					id="player-name"
					value={name}
					onChange={(event) =>
						setName(
							event.target.value
								.toUpperCase()
								.replace(/[^A-Z0-9 _-]/g, "")
								.slice(0, MAX_NAME_LENGTH),
						)
					}
					placeholder="PLAYER"
					autoComplete="off"
					spellCheck={false}
					maxLength={MAX_NAME_LENGTH}
					aria-label={`Name, up to ${MAX_NAME_LENGTH} characters`}
					className="keycap w-64 px-4 py-3 text-center font-[family-name:var(--font-pixel)] text-xl tracking-widest placeholder:text-[color:var(--key-shadow)] focus:outline-none"
				/>
				<span className="text-[color:var(--text-dim)] text-xs tabular-nums">
					{name.length}/{MAX_NAME_LENGTH}
				</span>
			</div>

			<button type="submit" disabled={!valid} className="keycap mt-6 px-5 py-2.5 font-semibold">
				SAVE SCORE
			</button>
		</form>
	);
}
