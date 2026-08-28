/**
 * The sponsor wall along the bottom of the title screen, as a broadcast crawl.
 *
 * Every logo the event ships, not just the eight that become fruit — the fruit
 * roster is a gameplay choice about how many discs stay distinguishable at 40px,
 * and it should not decide who gets credited.
 */
const SVG_LOGOS = [
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
];

/** The few that only exist as bitmaps. */
const PNG_LOGOS = ["dapta", "ucsm", "innicia-ucsm"];

const SPONSORS = [
	...SVG_LOGOS.map((slug) => ({ slug, src: `/sponsors/${slug}.svg` })),
	...PNG_LOGOS.map((slug) => ({ slug, src: `/sponsors/${slug}.png` })),
];

export function SponsorStrip({ className = "" }: { className?: string }) {
	return (
		<footer className={`border-[color:var(--border)] border-t pt-4 ${className}`}>
			<p className="section-label text-[color:var(--text-dim)]">Sponsors</p>

			<div className="marquee mt-3">
				<div className="marquee-track">
					{/* Two passes of the same list: the second is what the first scrolls into. */}
					{[0, 1].map((pass) => (
						<ul key={pass} className="flex shrink-0 items-center" aria-hidden={pass === 1}>
							{SPONSORS.map((sponsor) => (
								<li key={sponsor.slug} className="px-6">
									<img
										src={sponsor.src}
										alt={pass === 0 ? sponsor.slug : ""}
										loading="lazy"
										className="sponsor-mark h-5 w-auto max-w-28 object-contain"
									/>
								</li>
							))}
						</ul>
					))}
				</div>
			</div>
		</footer>
	);
}
