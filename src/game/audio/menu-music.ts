import { menuContext } from "./menu-audio";
import { audioSettings, musicVolume, subscribeAudioSettings } from "./settings";

/**
 * Background music for the menus.
 *
 * osu! does not play a separate menu theme in song select — it plays the
 * selected beatmap from that chart's own `PreviewTime`, and follows your
 * selection as you move through the list. This does the same, so the music
 * always belongs to whatever song you are looking at, and no extra track has to
 * be licensed and shipped to make the menus feel alive.
 */
const FADE_IN_MS = 700;
const FADE_OUT_MS = 400;

const buffers = new Map<string, AudioBuffer>();

let source: AudioBufferSourceNode | null = null;
let gain: GainNode | null = null;
let playing: string | null = null;
let unsubscribe: (() => void) | null = null;
/** Guards against two rapid selections racing each other into the output. */
let generation = 0;

export async function playMenuTrack(url: string, previewMs: number): Promise<void> {
	if (playing === url) return;

	// Stop first, then claim a generation: stopMenuTrack() bumps the same counter
	// to cancel any in-flight load, so taking the id before it would immediately
	// make this call look stale to its own guard.
	stopMenuTrack();
	const mine = ++generation;
	playing = url;

	try {
		const context = await menuContext();
		const buffer = await load(context, url);
		if (mine !== generation) return; // a newer selection won

		gain = context.createGain();
		gain.gain.value = 0;
		gain.connect(context.destination);

		source = context.createBufferSource();
		source.buffer = buffer;
		source.loop = true;
		// Loop back to the preview point rather than the top of the track, so the
		// menus never drop into a song's quiet intro.
		source.loopStart = Math.min(previewMs / 1000, Math.max(0, buffer.duration - 1));
		source.loopEnd = buffer.duration;
		source.connect(gain);
		source.start(0, source.loopStart);

		applyVolume(FADE_IN_MS);
		unsubscribe ??= subscribeAudioSettings(() => applyVolume(120));
	} catch {
		// Autoplay refused, or the track would not decode. Silence is survivable.
		playing = null;
	}
}

export function stopMenuTrack(): void {
	generation++;
	playing = null;

	const endingSource = source;
	const endingGain = gain;
	source = null;
	gain = null;
	if (!endingSource || !endingGain) return;

	const context = endingGain.context;
	const now = context.currentTime;
	endingGain.gain.cancelScheduledValues(now);
	endingGain.gain.setValueAtTime(endingGain.gain.value, now);
	endingGain.gain.linearRampToValueAtTime(0, now + FADE_OUT_MS / 1000);

	// Let the ramp finish before tearing the node down, or the fade becomes a cut.
	window.setTimeout(() => {
		try {
			endingSource.stop();
		} catch {
			// Already stopped.
		}
		endingSource.disconnect();
		endingGain.disconnect();
	}, FADE_OUT_MS + 60);
}

function applyVolume(rampMs: number): void {
	if (!gain) return;
	// Menu music sits under the interface rather than in front of it.
	const target = musicVolume(audioSettings()) * 0.55;
	const now = gain.context.currentTime;
	gain.gain.cancelScheduledValues(now);
	gain.gain.setValueAtTime(gain.gain.value, now);
	gain.gain.linearRampToValueAtTime(target, now + rampMs / 1000);
}

async function load(context: AudioContext, url: string): Promise<AudioBuffer> {
	const cached = buffers.get(url);
	if (cached) return cached;

	const response = await fetch(url);
	if (!response.ok) throw new Error(`Failed to load menu track: ${url}`);
	const buffer = await context.decodeAudioData(await response.arrayBuffer());

	buffers.set(url, buffer);
	return buffer;
}

export function disposeMenuMusic(): void {
	stopMenuTrack();
	unsubscribe?.();
	unsubscribe = null;
	buffers.clear();
}
