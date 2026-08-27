"use client";

import type { ScoreEntry } from "@/scores/repository";

interface Props {
	scores: ScoreEntry[];
	highlight?: string;
	/** Larger type for the standalone second-screen board. */
	size?: "compact" | "display";
}

export function Board({ scores, highlight, size = "compact" }: Props) {
	if (scores.length === 0) {
		return <p className="mt-6 text-[color:var(--text-dim)]">NO SCORES YET. BE FIRST.</p>;
	}

	const display = size === "display";

	return (
		<ol className="mt-6">
			{scores.map((entry, index) => {
				const isPlayer = highlight !== undefined && entry.initials === highlight;
				return (
					<li
						key={`${entry.initials}-${entry.createdAt}`}
						className={`flex items-baseline gap-4 border-[color:var(--border)] border-b py-3 ${
							isPlayer ? "bg-[color:var(--screen-dim)]" : ""
						}`}
					>
						<span
							className={`w-10 text-[color:var(--text-dim)] tabular-nums ${display ? "text-lg" : "text-sm"}`}
						>
							{String(index + 1).padStart(2, "0")}
						</span>
						<span
							className={`w-24 font-[family-name:var(--font-pixel)] font-bold ${
								display ? "text-3xl" : "text-lg"
							} ${isPlayer ? "text-[color:var(--bright)]" : "text-[color:var(--text)]"}`}
						>
							{entry.initials}
						</span>
						<span className={`flex-1 tabular-nums ${display ? "text-2xl" : "text-base"}`}>
							{String(entry.score).padStart(8, "0")}
						</span>
						<span
							className={`w-24 text-right text-[color:var(--text-dim)] tabular-nums ${
								display ? "text-xl" : "text-sm"
							}`}
						>
							{(entry.accuracy * 100).toFixed(1)}%
						</span>
						<span
							className={`w-20 text-right text-[color:var(--text-dim)] tabular-nums ${
								display ? "text-xl" : "text-sm"
							}`}
						>
							{entry.maxCombo}x
						</span>
					</li>
				);
			})}
		</ol>
	);
}
