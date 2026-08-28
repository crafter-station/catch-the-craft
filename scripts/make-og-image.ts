/**
 * Builds the link-preview card from `public/screenshot.png`.
 *
 * Chat clients are fussy about this image in ways the source screenshot is not
 * suited to: WhatsApp in particular wants a small file and reads 1.91:1, and a
 * 2188x1315 RGBA PNG at ~385KB often just fails to render. This produces a
 * 1200x630 JPEG on the brand background — letterboxed rather than cropped, so
 * nothing in the shot is lost.
 *
 * Run with: bun run scripts/make-og-image.ts
 */
import { statSync } from "node:fs";
import sharp from "sharp";

const SOURCE = "public/screenshot.png";
const OUTPUT = "public/og.jpg";

/** The Open Graph standard, and what every chat client is laid out for. */
const WIDTH = 1200;
const HEIGHT = 630;

/** the-next-craft's void, so the letterbox bars read as part of the design. */
const BACKGROUND = { r: 0x1a, g: 0x1a, b: 0x17, alpha: 1 };

await sharp(SOURCE)
	.resize(WIDTH, HEIGHT, { fit: "contain", background: BACKGROUND })
	.flatten({ background: BACKGROUND })
	.jpeg({ quality: 82, progressive: true, mozjpeg: true })
	.toFile(OUTPUT);

const before = statSync(SOURCE).size;
const after = statSync(OUTPUT).size;
console.log(
	`${SOURCE} ${Math.round(before / 1024)}KB -> ${OUTPUT} ${Math.round(after / 1024)}KB (${WIDTH}x${HEIGHT})`,
);
