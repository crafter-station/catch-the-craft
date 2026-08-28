"use client";

import { useEffect } from "react";
import { playUiSound, preloadUiSounds } from "@/game/audio/ui-sounds";

/**
 * Anything you can point at or press. Buttons and links come first in the
 * ancestor chain, so a list row containing a button resolves to the button
 * rather than firing twice.
 */
const INTERACTIVE = 'button, a, [role="button"], input[type="range"], li';

/**
 * Wires interface sounds once, at the document level.
 *
 * Delegation rather than per-element handlers: screens here mount and unmount
 * constantly, and every button would otherwise need to remember to opt in.
 */
export function UiSounds() {
	useEffect(() => {
		preloadUiSounds();

		// Tracked so moving within one control does not retrigger on its children.
		let hovered: Element | null = null;

		const resolve = (event: Event): Element | null => {
			const target = event.target;
			return target instanceof Element ? target.closest(INTERACTIVE) : null;
		};

		const onPointerOver = (event: PointerEvent) => {
			const element = resolve(event);
			if (!element || element === hovered) return;
			hovered = element;
			if (element instanceof HTMLButtonElement && element.disabled) return;
			playUiSound("hover");
		};

		const onPointerOut = (event: PointerEvent) => {
			if (resolve(event) === hovered) hovered = null;
		};

		const onClick = (event: MouseEvent) => {
			const element = resolve(event);
			if (!element) return;
			if (element instanceof HTMLButtonElement && element.disabled) return;
			playUiSound("click");
		};

		document.addEventListener("pointerover", onPointerOver, true);
		document.addEventListener("pointerout", onPointerOut, true);
		document.addEventListener("click", onClick, true);

		return () => {
			document.removeEventListener("pointerover", onPointerOver, true);
			document.removeEventListener("pointerout", onPointerOut, true);
			document.removeEventListener("click", onClick, true);
		};
	}, []);

	return null;
}
