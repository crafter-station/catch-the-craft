/**
 * Sponsor fruit.
 *
 * Each token is a brand-coloured disc with the sponsor's logo knocked out of it,
 * composited once at boot into an offscreen canvas and reused every frame. A
 * wordmark drawn straight to a 40px sprite is illegible; a silhouette on a
 * coloured disc reads instantly and keeps every fruit the same circular hitbox.
 *
 * Colours are cosmetic only. Every token is worth the same, so which logo
 * happens to spawn can never affect a leaderboard placing. They are picked for
 * separation against the warm-black playfield first and brand fit second: a disc
 * the player cannot see is a fruit they cannot catch.
 */
export interface Sponsor {
	slug: string;
	name: string;
	/** Disc colour. Chosen for on-field distinguishability as well as brand fit. */
	color: string;
}

export const SPONSORS: readonly Sponsor[] = [
	{ slug: "convex", name: "Convex", color: "#F5C518" },
	{ slug: "clerk", name: "Clerk", color: "#6C47FF" },
	{ slug: "cursor", name: "Cursor", color: "#9B9BA8" },
	{ slug: "elevenlabs", name: "ElevenLabs", color: "#B4B4C0" },
	{ slug: "exa", name: "Exa", color: "#1F6FEB" },
	{ slug: "tavily", name: "Tavily", color: "#00B8D9" },
	{ slug: "vapi", name: "Vapi", color: "#12A594" },
	{ slug: "apify", name: "Apify", color: "#FF7A00" },
];

/** Rendered at 2x the on-field size so the tokens stay crisp on retina. */
const TOKEN_SIZE = 96;
/** Keeps the fitted logo clear of the rim. */
const LOGO_INSET = 0.9;

export class TokenAtlas {
	private readonly tokens: HTMLCanvasElement[] = [];

	static async load(): Promise<TokenAtlas> {
		const atlas = new TokenAtlas();
		const drawn = await Promise.all(
			SPONSORS.map((sponsor) => renderToken(sponsor)),
		);
		atlas.tokens.push(...drawn);
		return atlas;
	}

	get size(): number {
		return TOKEN_SIZE;
	}

	/** Tokens rotate by combo, so one combo is visually one sponsor. */
	forCombo(comboIndex: number): HTMLCanvasElement {
		return this.tokens[comboIndex % this.tokens.length];
	}

	sponsorForCombo(comboIndex: number): Sponsor {
		return SPONSORS[comboIndex % SPONSORS.length];
	}
}

async function renderToken(sponsor: Sponsor): Promise<HTMLCanvasElement> {
	const canvas = document.createElement("canvas");
	canvas.width = TOKEN_SIZE;
	canvas.height = TOKEN_SIZE;
	const ctx = canvas.getContext("2d");
	if (!ctx) return canvas;

	const centre = TOKEN_SIZE / 2;
	const radius = centre - 3;

	ctx.fillStyle = sponsor.color;
	ctx.beginPath();
	ctx.arc(centre, centre, radius, 0, Math.PI * 2);
	ctx.fill();

	// A light rim, not a dark one. The playfield is near-black, so a dark outline
	// merges the darker discs into the background instead of separating them.
	ctx.strokeStyle = "rgba(233, 231, 222, 0.4)";
	ctx.lineWidth = 2.5;
	ctx.stroke();

	const ink = contrastInk(sponsor.color);

	try {
		const logo = await loadSvg(`/sponsors/${sponsor.slug}.svg`);
		ctx.drawImage(
			knockOut(logo, ink, radius),
			0,
			0,
			TOKEN_SIZE,
			TOKEN_SIZE,
		);
	} catch {
		// A logo that will not load falls back to its initial rather than a blank disc.
		ctx.fillStyle = ink;
		ctx.font = `bold ${TOKEN_SIZE * 0.5}px "Silkscreen", monospace`;
		ctx.textAlign = "center";
		ctx.textBaseline = "middle";
		ctx.fillText(sponsor.name[0].toUpperCase(), centre, centre + 2);
	}

	return canvas;
}

/**
 * Redraws the logo as a solid silhouette in `ink`, centred on a transparent
 * square. Sponsor logos arrive in whatever colours their brand uses — including
 * white-on-transparent, which would vanish on a light disc — so none of the
 * original fills survive.
 */
function knockOut(
	logo: HTMLImageElement,
	ink: string,
	radius: number,
): HTMLCanvasElement {
	const canvas = document.createElement("canvas");
	canvas.width = TOKEN_SIZE;
	canvas.height = TOKEN_SIZE;
	const ctx = canvas.getContext("2d");
	if (!ctx) return canvas;

	// For aspect ratio a, the largest rectangle inscribed in a circle of radius r
	// is 2ra/sqrt(1+a^2) by 2r/sqrt(1+a^2). Most sponsor marks are wordmarks near
	// 4:1, and squeezing those into a square box leaves the lettering too small to
	// recognise at 40px on the playfield, which defeats the point of sponsor fruit.
	const aspect = logo.width / logo.height;
	const diagonal = Math.sqrt(1 + aspect * aspect);
	const width = ((2 * radius * aspect) / diagonal) * LOGO_INSET;
	const height = ((2 * radius) / diagonal) * LOGO_INSET;

	ctx.drawImage(
		logo,
		(TOKEN_SIZE - width) / 2,
		(TOKEN_SIZE - height) / 2,
		width,
		height,
	);
	ctx.globalCompositeOperation = "source-in";
	ctx.fillStyle = ink;
	ctx.fillRect(0, 0, TOKEN_SIZE, TOKEN_SIZE);

	return canvas;
}

/** Black on light discs, white on dark ones. */
function contrastInk(hex: string): string {
	const value = Number.parseInt(hex.slice(1), 16);
	const r = (value >> 16) & 255;
	const g = (value >> 8) & 255;
	const b = value & 255;
	const luminance = (0.299 * r + 0.587 * g + 0.114 * b) / 255;
	return luminance > 0.6 ? "#101014" : "#FFFFFF";
}

/**
 * SVGs without explicit width/height decode to a zero-sized image in some
 * browsers, so the viewBox is promoted to real dimensions before decoding.
 */
async function loadSvg(url: string): Promise<HTMLImageElement> {
	const response = await fetch(url);
	if (!response.ok) throw new Error(`Missing sponsor logo: ${url}`);

	let markup = await response.text();
	if (!/\swidth\s*=/.test(markup)) {
		const viewBox = /viewBox\s*=\s*"([^"]+)"/.exec(markup)?.[1];
		const [, , w, h] =
			viewBox
				?.trim()
				.split(/[\s,]+/)
				.map(Number) ?? [];
		if (w && h) {
			markup = markup.replace(/<svg/, `<svg width="${w}" height="${h}"`);
		}
	}

	const blobUrl = URL.createObjectURL(
		new Blob([markup], { type: "image/svg+xml" }),
	);
	try {
		const image = new Image();
		image.src = blobUrl;
		await image.decode();
		return image;
	} finally {
		URL.revokeObjectURL(blobUrl);
	}
}
