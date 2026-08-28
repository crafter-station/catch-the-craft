/**
 * The sponsor wall along the bottom of the title screen.
 *
 * Every logo the event ships, not just the eight that become fruit — the fruit
 * roster is a gameplay choice about how many discs stay distinguishable at 40px,
 * and it should not decide who gets credited.
 */
const SPONSOR_LOGOS = [
	"convex",
	"clerk",
	"cursor",
	"elevenlabs",
	"exa",
	"tavily",
	"vapi",
	"apify",
	"codex",
	"replit",
	"n8n",
	"yalo",
	"isotipo_cloudforge",
	"3DevLabs",
	"visagente",
	"upch",
] as const;

/** The few that only exist as bitmaps. */
const PNG_LOGOS = new Set(["dapta", "ucsm", "innicia-ucsm"]);

const source = (slug: string) => `/sponsors/${slug}.${PNG_LOGOS.has(slug) ? "png" : "svg"}`;

export function SponsorStrip() {
	return (
		<footer className="border-[color:var(--border)] border-t pt-4">
			<p className="section-label text-[color:var(--text-dim)]">Sponsors</p>

			<ul className="mt-3 flex flex-wrap items-center gap-x-6 gap-y-3">
				{[...SPONSOR_LOGOS, ...PNG_LOGOS].map((slug) => (
					<li key={slug}>
						<img
							src={source(slug)}
							alt={slug}
							loading="lazy"
							className="sponsor-mark h-4 w-auto max-w-24 object-contain sm:h-5"
						/>
					</li>
				))}
			</ul>
		</footer>
	);
}
