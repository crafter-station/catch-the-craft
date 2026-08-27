import { audioSettings, effectsVolume } from "./settings";
import { SampleBank } from "./samples";

/**
 * Plays a hitsound so the effects slider can be set before a run starts.
 *
 * Without this the only way to judge the level is to start playing, which is
 * exactly the wrong moment to discover the booth is too quiet. The context is
 * created lazily on the first interaction — a user gesture, so it is allowed to
 * start — and disposed when the menu goes away, so it never overlaps the run's
 * own context.
 */
let context: AudioContext | null = null;
let bank: SampleBank | null = null;
let loading: Promise<void> | null = null;

export async function previewEffects(): Promise<void> {
	try {
		context ??= new AudioContext();
		if (context.state === "suspended") await context.resume();

		loading ??= SampleBank.load(context).then((loaded) => {
			bank = loaded;
		});
		await loading;

		bank?.setVolume(effectsVolume(audioSettings()));
		bank?.play("fruit");
	} catch {
		// A preview that will not play is not worth surfacing to the player.
	}
}

export function disposePreview(): void {
	bank?.dispose();
	void context?.close();
	bank = null;
	context = null;
	loading = null;
}
