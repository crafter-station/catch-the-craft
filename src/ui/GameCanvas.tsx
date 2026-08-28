"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { GameEngine, type RunResult } from "@/game/engine";
import type { BeatmapEntry, Tier } from "@/game/library";
import { loadChart } from "@/game/library";
import { PauseMenu } from "./PauseMenu";

/**
 * Beat between the last object and the results screen. The canvas is frozen on
 * its final frame through this, so a run resolves visibly instead of the screen
 * changing under the player the instant they catch the last fruit.
 */
const HOLD_AFTER_RUN_MS = 1200;

interface Props {
	entry: BeatmapEntry;
	tier: Tier;
	onEnd: (result: RunResult) => void;
	onQuit: () => void;
	onError: (message: string) => void;
}

export function GameCanvas({ entry, tier, onEnd, onQuit, onError }: Props) {
	const canvasRef = useRef<HTMLCanvasElement>(null);
	const engineRef = useRef<GameEngine | null>(null);
	const holdTimer = useRef<number | null>(null);
	const [paused, setPaused] = useState(false);

	// Bumping this tears the engine down and builds a fresh one, which is all a
	// retry needs to be: no reset path to keep in step with the constructor.
	const [attempt, setAttempt] = useState(0);

	const endRef = useRef(onEnd);
	const errorRef = useRef(onError);
	endRef.current = onEnd;
	errorRef.current = onError;

	useEffect(() => {
		const canvas = canvasRef.current;
		if (!canvas) return;

		let engine: GameEngine | null = null;
		let cancelled = false;
		setPaused(false);

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
					onEnd: (result) => {
						holdTimer.current = window.setTimeout(
							() => endRef.current(result),
							HOLD_AFTER_RUN_MS,
						);
					},
					onPauseChange: setPaused,
				});
				engineRef.current = engine;
				await engine.start();
			} catch (error) {
				if (!cancelled) {
					errorRef.current(error instanceof Error ? error.message : "Failed to start run");
				}
			}
		})();

		return () => {
			cancelled = true;
			if (holdTimer.current) window.clearTimeout(holdTimer.current);
			engine?.dispose();
			engineRef.current = null;
		};
	}, [entry, tier, attempt]);

	const handleContinue = useCallback(() => engineRef.current?.resume(), []);
	const handleRetry = useCallback(() => setAttempt((value) => value + 1), []);

	return (
		<>
			<canvas
				ref={canvasRef}
				className="block h-dvh w-full touch-none"
				aria-label={`${entry.artist} - ${entry.title}, ${tier}`}
			/>
			{paused && (
				<PauseMenu onContinue={handleContinue} onRetry={handleRetry} onQuit={onQuit} />
			)}
		</>
	);
}
