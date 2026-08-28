import { menuContext } from "./menu-audio";
import { audioSettings, effectsVolume } from "./settings";

/**
 * Interface clicks and hovers, using osu!'s own keyboard samples.
 *
 * Rides the menus' shared AudioContext rather than opening another, and follows
 * the effects volume — these are game sounds, not a separate channel to balance.
 */
const SOURCES = {
	hover: "/sfx/ui-hover.mp3",
	click: "/sfx/ui-click.mp3",
} as const;

export type UiSound = keyof typeof SOURCES;

/** Hovers sit well under clicks, or sweeping a list becomes a rattle. */
const LEVELS: Record<UiSound, number> = { hover: 0.3, click: 0.6 };

/** Floor between two of the same sound, so a fast pointer cannot machine-gun it. */
const GUARD_MS = 45;

const buffers = new Map<UiSound, AudioBuffer>();
const lastPlayedAt = new Map<UiSound, number>();

let master: GainNode | null = null;
let loading: Promise<void> | null = null;

async function ready(): Promise<AudioContext> {
	const context = await menuContext();

	master ??= (() => {
		const gain = context.createGain();
		gain.connect(context.destination);
		return gain;
	})();

	loading ??= Promise.all(
		(Object.keys(SOURCES) as UiSound[]).map(async (name) => {
			try {
				const response = await fetch(SOURCES[name]);
				if (!response.ok) return;
				buffers.set(name, await context.decodeAudioData(await response.arrayBuffer()));
			} catch {
				// A missing interface sound is not worth surfacing.
			}
		}),
	).then(() => undefined);

	await loading;
	return context;
}

/** Warms the buffers so the first hover is not silent while it decodes. */
export function preloadUiSounds(): void {
	void ready().catch(() => undefined);
}

export function playUiSound(name: UiSound): void {
	const settings = audioSettings();
	if (settings.muted) return;

	void (async () => {
		try {
			const context = await ready();
			const buffer = buffers.get(name);
			if (!buffer || !master) return;

			const now = context.currentTime * 1000;
			if (now - (lastPlayedAt.get(name) ?? Number.NEGATIVE_INFINITY) < GUARD_MS) return;
			lastPlayedAt.set(name, now);

			master.gain.value = effectsVolume(settings) * LEVELS[name];

			const source = context.createBufferSource();
			source.buffer = buffer;
			source.connect(master);
			source.start();
			source.onended = () => source.disconnect();
		} catch {
			// Blocked or unavailable audio; the interface still works silently.
		}
	})();
}
