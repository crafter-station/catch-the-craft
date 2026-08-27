"use client";

import { useEffect, useRef } from "react";
import { GameEngine, type RunResult } from "@/game/engine";
import type { BeatmapEntry, Tier } from "@/game/library";
import { loadChart } from "@/game/library";

interface Props {
	entry: BeatmapEntry;
	tier: Tier;
	onEnd: (result: RunResult) => void;
	onError: (message: string) => void;
}

export function GameCanvas({ entry, tier, onEnd, onError }: Props) {
	const canvasRef = useRef<HTMLCanvasElement>(null);

	// The engine owns the frame loop and never touches React state, so this effect
	// exists only to create it, hand it a canvas, and tear it down.
	const endRef = useRef(onEnd);
	const errorRef = useRef(onError);
	endRef.current = onEnd;
	errorRef.current = onError;

	useEffect(() => {
		const canvas = canvasRef.current;
		if (!canvas) return;

		let engine: GameEngine | null = null;
		let cancelled = false;

		(async () => {
			try {
				const beatmap = await loadChart(entry, tier);
				if (cancelled) return;

				engine = new GameEngine({
					canvas,
					beatmap,
					audioUrl: entry.audio,
					slug: entry.slug,
					tier,
					startMs: entry.startMs,
					durationMs: entry.durationMs,
					onEnd: (result) => endRef.current(result),
				});
				await engine.start();
			} catch (error) {
				if (!cancelled) {
					errorRef.current(
						error instanceof Error ? error.message : "Failed to start run",
					);
				}
			}
		})();

		return () => {
			cancelled = true;
			engine?.dispose();
		};
	}, [entry, tier]);

	return (
		<canvas
			ref={canvasRef}
			className="block h-dvh w-full touch-none"
			aria-label={`${entry.artist} - ${entry.title}, ${tier}`}
		/>
	);
}
