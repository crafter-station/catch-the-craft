"use client";

import { useEffect, useState } from "react";

/**
 * A device that cannot really play this.
 *
 * Both conditions have to hold: a coarse primary pointer *and* a narrow
 * viewport. Width alone would lock out anyone who happens to have a small
 * desktop window, and a coarse pointer alone would catch touchscreen laptops
 * that have a mouse attached and are perfectly capable of running it.
 */
const QUERY = "(pointer: coarse)";
const MAX_WIDTH = 1024;

export function useIsMobile(): boolean {
	// Starts false so the server pass and the first client render agree; the real
	// answer arrives immediately after mount.
	const [isMobile, setIsMobile] = useState(false);

	useEffect(() => {
		const media = window.matchMedia(QUERY);
		const evaluate = () => setIsMobile(media.matches && window.innerWidth < MAX_WIDTH);

		evaluate();
		media.addEventListener("change", evaluate);
		window.addEventListener("resize", evaluate);

		return () => {
			media.removeEventListener("change", evaluate);
			window.removeEventListener("resize", evaluate);
		};
	}, []);

	return isMobile;
}
