"use client";

import type { ScoreEntry } from "@/scores/repository";

interface Props {
	scores: ScoreEntry[];
	highlight?: string;
}

export function Board({ scores, highlight }: Props) {
	if (scores.length === 0) {
		return <p className="mt-6 opacity-60">NO SCORES YET. BE FIRST.</p>;
	}

	return (
		<ol className="mt-6 space-y-1 font-[family-name:var(--font-plex-mono)]">
			{scores.map((entry, index) => {
				const isPlayer =
					highlight !== undefined && entry.initials === highlight;
				return (
					<li
						key={`${entry.initials}-${entry.createdAt}`}
						className={`flex items-baseline gap-4 border-b border-dotted border-[color:var(--color-phosphor-dim)] py-2 ${
							isPlayer ? "text-[color:var(--color-amber)]" : ""
						}`}
					>
						<span className="w-8 opacity-50">
							{String(index + 1).padStart(2, "0")}
						</span>
						<span className="glow w-16 font-[family-name:var(--font-silkscreen)] text-lg">
							{entry.initials}
						</span>
						<span className="flex-1 tabular-nums">
							{String(entry.score).padStart(8, "0")}
						</span>
						<span className="w-20 text-right opacity-70 tabular-nums">
							{(entry.accuracy * 100).toFixed(1)}%
						</span>
						<span className="w-16 text-right opacity-50 tabular-nums">
							{entry.maxCombo}x
						</span>
					</li>
				);
			})}
		</ol>
	);
}
