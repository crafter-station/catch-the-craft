import { menuContext } from "./menu-audio";
import { SampleBank } from "./samples";
import { audioSettings, effectsVolume } from "./settings";

/**
 * Plays a hitsound so the effects slider can be set before a run starts.
 *
 * Without this the only way to judge the level is to start playing, which is
 * exactly the wrong moment to discover the booth is too quiet. It rides the
 * menus' shared context, so adjusting the sliders does not open one of its own.
 */
let bank: SampleBank | null = null;
let loading: Promise<void> | null = null;

export async function previewEffects(): Promise<void> {
	try {
		const context = await menuContext();

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
	bank = null;
	loading = null;
}
