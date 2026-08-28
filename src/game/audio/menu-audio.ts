/**
 * The AudioContext the menus share.
 *
 * Menu music and the effects preview live on the same context so a browser is
 * not asked to keep several open at once. It is separate from the one a run
 * creates, which is fine: the two never sound together, and neither has to stay
 * in step with the other.
 *
 * The context is built and the track is scheduled immediately, even while the
 * browser still has it suspended. Waiting for a gesture before *loading*
 * anything meant the music only began some time after the first click, once the
 * fetch and decode had run; scheduling up front means the very first interaction
 * — a keypress, a touch, reaching for PLAY — starts the music instantly.
 */
const ACTIVATION_EVENTS = ["pointerdown", "pointerup", "keydown", "touchend", "click"] as const;

let context: AudioContext | null = null;
let listening = false;

export async function menuContext(): Promise<AudioContext> {
	context ??= new AudioContext();
	listenForActivation(context);

	// Resolves suspended when autoplay is blocked. Callers carry on and schedule
	// their sources anyway; the context starts advancing on the first gesture.
	try {
		await context.resume();
	} catch {
		// Blocked until a gesture. Expected, and handled below.
	}

	return context;
}

/**
 * Resumes on any gesture that counts as user activation, then stops listening.
 * Capture phase, so a handler that stops propagation cannot swallow it.
 */
function listenForActivation(ctx: AudioContext): void {
	if (listening) return;
	listening = true;

	const attempt = () => {
		void ctx
			.resume()
			.then(() => {
				if (ctx.state !== "running") return;
				for (const event of ACTIVATION_EVENTS) {
					window.removeEventListener(event, attempt, true);
				}
			})
			.catch(() => {
				// Still blocked; the listeners stay on for the next gesture.
			});
	};

	for (const event of ACTIVATION_EVENTS) {
		window.addEventListener(event, attempt, true);
	}
}

export function closeMenuAudio(): void {
	void context?.close();
	context = null;
	listening = false;
}
