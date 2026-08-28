"use client";

import { useEffect, useRef, useState } from "react";
import { TutorialEngine, type TutorialState, type TutorialStepId } from "@/game/tutorial";
import { useStrings } from "@/i18n/strings";
import { Icon } from "./Icon";

interface Props {
	onPlay: () => void;
	onQuit: () => void;
	onError: (message: string) => void;
}

/** The teaching steps, in the order the engine runs them. */
const TAUGHT: Exclude<TutorialStepId, "done">[] = ["move", "catch", "dash", "combo"];

/**
 * The tutorial screen: the real playfield with one instruction over it.
 *
 * The instruction sits at the top rather than the middle so it never covers the
 * thing it is describing, and only ever one step is on screen — a beginner at a
 * booth with a queue behind them will read one line, not four.
 */
export function TutorialCanvas({ onPlay, onQuit, onError }: Props) {
	const canvasRef = useRef<HTMLCanvasElement>(null);
	const engineRef = useRef<TutorialEngine | null>(null);
	const [state, setState] = useState<TutorialState>({ step: "move", done: 0, goal: 700 });
	const { t } = useStrings();

	const quitRef = useRef(onQuit);
	const errorRef = useRef(onError);
	quitRef.current = onQuit;
	errorRef.current = onError;

	useEffect(() => {
		const canvas = canvasRef.current;
		if (!canvas) return;

		const engine = new TutorialEngine({
			canvas,
			onState: setState,
			onExit: () => quitRef.current(),
		});
		engineRef.current = engine;

		let cancelled = false;
		engine.start().catch((error: unknown) => {
			if (!cancelled) {
				errorRef.current(error instanceof Error ? error.message : "Tutorial failed to start");
			}
		});

		return () => {
			cancelled = true;
			engine.dispose();
			engineRef.current = null;
		};
	}, []);

	const COPY: Record<TutorialStepId, { title: string; body: string }> = {
		move: { title: t.tutorialMove, body: t.tutorialMoveBody },
		catch: { title: t.tutorialCatch, body: t.tutorialCatchBody },
		dash: { title: t.tutorialDash, body: t.tutorialDashBody },
		combo: { title: t.tutorialCombo, body: t.tutorialComboBody },
		done: { title: t.tutorialDone, body: t.tutorialDoneBody },
	};

	const copy = COPY[state.step];
	const index = TAUGHT.indexOf(state.step as Exclude<TutorialStepId, "done">);
	// The "move" step counts distance, which is not a number worth showing.
	const counted = state.step !== "move" && state.step !== "done";

	return (
		<>
			<canvas ref={canvasRef} className="block h-dvh w-full touch-none" aria-label={t.tutorial} />

			{/* Pointer events off, so the overlay can never eat a mouse move that is
			    meant to be steering the plate underneath it. */}
			<div className="pointer-events-none fixed inset-x-0 top-0 z-50 flex justify-center px-6 pt-6">
				<div className="panel w-full max-w-2xl px-6 py-5 text-center">
					<div className="flex items-center justify-center gap-3">
						{TAUGHT.map((id, i) => (
							<span
								key={id}
								className={`h-1.5 w-8 ${
									i <= index || state.step === "done"
										? "bg-[color:var(--bright)]"
										: "bg-[color:var(--border)]"
								}`}
							/>
						))}
					</div>

					<p className="pixel-heading mt-4 text-2xl">{copy.title}</p>
					<p className="mt-3 text-[color:var(--text-dim)] text-sm leading-relaxed">{copy.body}</p>

					{counted && (
						<p className="section-label mt-4 text-[color:var(--bright)]">
							{state.done} / {state.goal}
						</p>
					)}
				</div>
			</div>

			{state.step === "done" ? (
				<div className="fixed inset-0 z-50 flex items-center justify-center bg-[rgba(26,26,23,0.86)]">
					<div className="scanlines pointer-events-none absolute inset-0" aria-hidden="true" />
					<div className="relative flex w-80 flex-col items-center gap-3">
						<p className="section-label mb-2">{t.tutorialDone}</p>
						<button
							type="button"
							onClick={onPlay}
							className="keycap inline-flex w-full items-center justify-center gap-2 py-3 font-semibold"
						>
							<Icon name="play" size={0.85} />
							{t.play}
						</button>
						<button
							type="button"
							onClick={onQuit}
							className="keycap-ghost inline-flex w-full items-center justify-center gap-2 py-3"
						>
							<Icon name="back" size={0.85} />
							{t.back}
						</button>
					</div>
				</div>
			) : (
				<div className="fixed inset-x-0 bottom-0 z-50 flex items-center justify-between gap-4 px-6 pb-6">
					<button
						type="button"
						onClick={onQuit}
						className="keycap-ghost inline-flex items-center gap-2 px-4 py-2 text-xs"
					>
						<Icon name="quit" size={0.8} />
						{t.tutorialExit}
					</button>
					<button
						type="button"
						onClick={() => engineRef.current?.advance()}
						className="keycap-ghost inline-flex items-center gap-2 px-4 py-2 text-xs"
					>
						{t.tutorialSkip}
						<Icon name="play" size={0.8} />
					</button>
				</div>
			)}
		</>
	);
}
