"use client";

import { LOCALES, type Locale, setLocale } from "@/i18n/locale";
import { useStrings } from "@/i18n/strings";

const LABELS: Record<Locale, string> = { en: "EN", es: "ES" };

/**
 * Language switch.
 *
 * Two keycaps rather than a select, because it lives on a screen someone is
 * looking at from a metre away and has exactly two options.
 */
export function LanguageToggle({ className = "" }: { className?: string }) {
	const { current } = useStrings();

	return (
		<div className={`flex items-center gap-2 ${className}`}>
			{LOCALES.map((option) => (
				<button
					key={option}
					type="button"
					onClick={() => setLocale(option)}
					aria-pressed={option === current}
					className={`${option === current ? "keycap" : "keycap-ghost"} px-3 py-1 text-xs`}
				>
					{LABELS[option]}
				</button>
			))}
		</div>
	);
}
