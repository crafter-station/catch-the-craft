/**
 * Volume settings, stored per browser.
 *
 * Local only, by design: this is a per-machine preference, not part of a run.
 * The booth laptop wants its own levels for a loud room, and a phone player
 * wants theirs, and neither should affect the other or reach the server.
 */
export interface AudioSettings {
	/** 0..1 */
	music: number;
	/** 0..1 */
	effects: number;
	muted: boolean;
}

/**
 * Effects at full, music well under it. The hitsounds are the feedback telling
 * you whether you caught something, so they have to cut through a loud room;
 * the track only has to be recognisable behind them.
 */
export const DEFAULT_AUDIO_SETTINGS: AudioSettings = {
	music: 0.4,
	effects: 1,
	muted: false,
};

const STORAGE_KEY = "ctb.audio";

const listeners = new Set<(settings: AudioSettings) => void>();
let current: AudioSettings | null = null;

/**
 * Reads once and caches. Private browsing and blocked storage both throw here,
 * so a failure falls back to defaults rather than taking the game down.
 */
export function audioSettings(): AudioSettings {
	if (current) return current;

	try {
		const raw = localStorage.getItem(STORAGE_KEY);
		current = raw ? sanitise(JSON.parse(raw)) : { ...DEFAULT_AUDIO_SETTINGS };
	} catch {
		current = { ...DEFAULT_AUDIO_SETTINGS };
	}

	return current;
}

export function setAudioSettings(next: Partial<AudioSettings>): AudioSettings {
	const merged = sanitise({ ...audioSettings(), ...next });
	current = merged;

	try {
		localStorage.setItem(STORAGE_KEY, JSON.stringify(merged));
	} catch {
		// Preference lost on reload is acceptable; crashing the settings panel is not.
	}

	for (const listener of listeners) listener(merged);
	return merged;
}

/** Live updates, so changing a slider mid-run is audible immediately. */
export function subscribeAudioSettings(listener: (settings: AudioSettings) => void): () => void {
	listeners.add(listener);
	return () => listeners.delete(listener);
}

export function musicVolume(settings: AudioSettings): number {
	return settings.muted ? 0 : settings.music;
}

export function effectsVolume(settings: AudioSettings): number {
	return settings.muted ? 0 : settings.effects;
}

function sanitise(value: unknown): AudioSettings {
	const input = (value ?? {}) as Partial<AudioSettings>;
	return {
		music: clamp(input.music, DEFAULT_AUDIO_SETTINGS.music),
		effects: clamp(input.effects, DEFAULT_AUDIO_SETTINGS.effects),
		muted: input.muted === true,
	};
}

function clamp(value: unknown, fallback: number): number {
	return typeof value === "number" && Number.isFinite(value)
		? Math.min(1, Math.max(0, value))
		: fallback;
}
