"use client";

/**
 * One row of any board. Per-song entries and cumulative totals share a shape,
 * so the same table renders both — `runs` is the only thing totals add.
 */
export interface BoardRow {
	name: string;
	score: number;
	accuracy: number;
	maxCombo: number;
	createdAt?: string;
	/** Present on the overall board: how many runs the score is made of. */
	runs?: number;
}

interface Props {
	scores: BoardRow[];
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
		<ol className="mt-4">
			{scores.map((entry, index) => {
				const isPlayer = highlight !== undefined && entry.name === highlight;
				return (
					<li
						key={`${entry.name}-${entry.createdAt ?? index}`}
						className={`flex items-baseline gap-4 border-[color:var(--border)] border-b py-2.5 ${
							isPlayer ? "bg-[color:var(--screen-dim)]" : ""
						}`}
					>
						<span
							className={`w-8 shrink-0 text-[color:var(--text-dim)] tabular-nums ${
								display ? "text-lg" : "text-sm"
							}`}
						>
							{String(index + 1).padStart(2, "0")}
						</span>

						<span
							className={`min-w-0 flex-1 truncate font-[family-name:var(--font-pixel)] font-bold ${
								display ? "text-2xl" : "text-base"
							} ${isPlayer ? "text-[color:var(--bright)]" : "text-[color:var(--text)]"}`}
						>
							{entry.name}
						</span>

						<span className={`shrink-0 tabular-nums ${display ? "text-2xl" : "text-base"}`}>
							{String(entry.score).padStart(8, "0")}
						</span>

						{entry.runs !== undefined && (
							<span
								className={`w-16 shrink-0 text-right text-[color:var(--text-dim)] tabular-nums ${
									display ? "text-lg" : "text-xs"
								}`}
							>
								{entry.runs} run{entry.runs === 1 ? "" : "s"}
							</span>
						)}

						<span
							className={`w-16 shrink-0 text-right text-[color:var(--text-dim)] tabular-nums ${
								display ? "text-lg" : "text-xs"
							}`}
						>
							{(entry.accuracy * 100).toFixed(1)}%
						</span>
					</li>
				);
			})}
		</ol>
	);
}
