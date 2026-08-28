/**
 * Pixel glyphs, drawn on an 8x8 grid.
 *
 * Deliberately not an icon set: everything else on screen — the cursor, the
 * Silkscreen headings, the sponsor tokens — sits on a coarse pixel register, and
 * a smooth vector icon next to a Silkscreen label reads as borrowed from another
 * product. Each icon is a bitmap rendered as rects with crisp edges, so it stays
 * blocky at any size.
 */
const GLYPHS = {
	play: [
		"00000000",
		"01100000",
		"01111000",
		"01111110",
		"01111110",
		"01111000",
		"01100000",
		"00000000",
	],
	power: [
		"00011000",
		"00011000",
		"01011010",
		"11011011",
		"11000011",
		"11000011",
		"01100110",
		"00111100",
	],
	sliders: [
		"00010000",
		"11111111",
		"00000000",
		"00000100",
		"11111111",
		"00000000",
		"01000000",
		"11111111",
	],
	trophy: [
		"11111111",
		"11111111",
		"01111110",
		"01111110",
		"00111100",
		"00011000",
		"00111100",
		"01111110",
	],
	back: [
		"00010000",
		"00110000",
		"01110000",
		"11111111",
		"11111111",
		"01110000",
		"00110000",
		"00010000",
	],
	retry: [
		"00111100",
		"01100110",
		"11000011",
		"11000000",
		"11000000",
		"11000011",
		"01100110",
		"00111100",
	],
	quit: [
		"11000011",
		"11100111",
		"01111110",
		"00111100",
		"00111100",
		"01111110",
		"11100111",
		"11000011",
	],
	save: [
		"11111111",
		"10011001",
		"10011001",
		"10000001",
		"11111111",
		"10111101",
		"10111101",
		"11111111",
	],
	note: [
		"00011110",
		"00010010",
		"00010010",
		"00010000",
		"00010000",
		"01110000",
		"11110000",
		"01100000",
	],
	user: [
		"00111100",
		"01111110",
		"01111110",
		"00111100",
		"00000000",
		"01111110",
		"11111111",
		"11111111",
	],
	help: [
		"00111100",
		"01100110",
		"01100110",
		"00001100",
		"00011000",
		"00011000",
		"00000000",
		"00011000",
	],
} as const;

export type IconName = keyof typeof GLYPHS;

interface Props {
	name: IconName;
	/** Rendered size in em, so an icon tracks the label it sits beside. */
	size?: number;
	className?: string;
}

export function Icon({ name, size = 1, className = "" }: Props) {
	const rows = GLYPHS[name];

	return (
		<svg
			viewBox="0 0 8 8"
			width={`${size}em`}
			height={`${size}em`}
			fill="currentColor"
			shapeRendering="crispEdges"
			aria-hidden="true"
			className={`shrink-0 ${className}`}
		>
			{rows.flatMap((row, y) =>
				[...row].map((cell, x) =>
					cell === "1" ? (
						<rect key={`${x}-${y}`} x={x} y={y} width={1} height={1} />
					) : null,
				),
			)}
		</svg>
	);
}
