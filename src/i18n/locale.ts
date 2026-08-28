/**
 * Interface language, stored per browser.
 *
 * Local only, like the volume: it is a property of the machine someone is
 * standing at, not of their account, and the booth laptop may well want a
 * different one from a phone that scanned the QR.
 */
export type Locale = "en" | "es";

export const LOCALES: Locale[] = ["en", "es"];

export const DEFAULT_LOCALE: Locale = "en";

const STORAGE_KEY = "ctb.locale";

const listeners = new Set<(locale: Locale) => void>();
let current: Locale | null = null;

export function locale(): Locale {
	if (current) return current;

	try {
		const stored = localStorage.getItem(STORAGE_KEY);
		current = stored === "es" || stored === "en" ? stored : DEFAULT_LOCALE;
	} catch {
		current = DEFAULT_LOCALE;
	}

	return current;
}

export function setLocale(next: Locale): void {
	current = next;

	try {
		localStorage.setItem(STORAGE_KEY, next);
	} catch {
		// Preference lost on reload is acceptable; crashing the switch is not.
	}

	for (const listener of listeners) listener(next);
}

/** Live updates, so switching language re-labels the screen and swaps the music. */
export function subscribeLocale(listener: (locale: Locale) => void): () => void {
	listeners.add(listener);
	return () => listeners.delete(listener);
}
