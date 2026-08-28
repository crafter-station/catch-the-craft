/**
 * The AudioContext the menus share.
 *
 * Menu music and the effects preview live on the same context so a browser is
 * not asked to keep several open at once. It is separate from the one a run
 * creates, which is fine: the two never sound together, and neither has to stay
 * in step with the other.
 *
 * Created lazily because a context made before a user gesture starts suspended.
 */
let context: AudioContext | null = null;

export async function menuContext(): Promise<AudioContext> {
	context ??= new AudioContext();
	if (context.state === "suspended") await context.resume();
	return context;
}

export function closeMenuAudio(): void {
	void context?.close();
	context = null;
}
