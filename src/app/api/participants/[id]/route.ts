import sharp from "sharp";
import { type NextRequest, NextResponse } from "next/server";

/**
 * Thumbnails for the participant gallery.
 *
 * The upstream badge endpoint serves 1080x1350 JPEGs at ~400KB each and sends
 * `max-age=0`, so a browser re-downloads every one on every visit. A hundred and
 * sixty of those is sixty megabytes of gallery. This resizes them once, serves
 * them immutable, and keeps the encoded result in memory so the upstream is hit
 * a single time per participant per deploy.
 */
const UPSTREAM = "https://thenextcraft.crafter.run/api/badge/image";

/** Badges are 4:5; 320px wide is enough for a retina thumbnail. */
const WIDTH = 320;

const thumbnails = new Map<string, Buffer>();

export async function GET(
	_request: NextRequest,
	{ params }: { params: Promise<{ id: string }> },
): Promise<NextResponse> {
	const { id } = await params;

	const number = Number(id);
	if (!Number.isInteger(number) || number < 1 || number > 999) {
		return NextResponse.json({ error: "Bad participant id" }, { status: 400 });
	}

	const key = String(number).padStart(3, "0");
	const cached = thumbnails.get(key);
	if (cached) return webp(cached);

	const upstream = await fetch(`${UPSTREAM}/${key}`);
	if (!upstream.ok) {
		// Missing participants are expected — the gallery walks ids until they run out.
		return NextResponse.json({ error: "No such participant" }, { status: 404 });
	}

	const resized = await sharp(Buffer.from(await upstream.arrayBuffer()))
		.resize(WIDTH, null, { withoutEnlargement: true })
		.webp({ quality: 72 })
		.toBuffer();

	thumbnails.set(key, resized);
	return webp(resized);
}

function webp(body: Buffer): NextResponse {
	return new NextResponse(new Uint8Array(body), {
		headers: {
			"content-type": "image/webp",
			// The badge for a given number does not change, so this can be held forever.
			"cache-control": "public, max-age=31536000, immutable",
		},
	});
}
