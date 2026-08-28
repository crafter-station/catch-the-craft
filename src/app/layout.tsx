import { ClerkProvider } from "@clerk/nextjs";
import type { Metadata, Viewport } from "next";
import { Borel, IBM_Plex_Mono, Silkscreen } from "next/font/google";
import "./globals.css";

// Same three faces, same roles and weights as the-next-craft: Silkscreen for
// pixel headings, IBM Plex Mono for everything else, Borel for script accents.
const silkscreen = Silkscreen({
	variable: "--font-silkscreen",
	subsets: ["latin"],
	weight: ["400", "700"],
	display: "swap",
});

const ibmPlexMono = IBM_Plex_Mono({
	variable: "--font-plex-mono",
	subsets: ["latin"],
	weight: ["400", "500", "600", "700"],
	display: "swap",
});

const borel = Borel({
	variable: "--font-borel",
	subsets: ["latin"],
	weight: "400",
	display: "swap",
});

const SITE_URL = "https://catch.crafter.run";
const TITLE = "CATCH THE CRAFT";
const DESCRIPTION = "osu!catch for The Next Craft — catch the sponsors, keep the combo.";

export const metadata: Metadata = {
	// Chat clients resolve nothing: every URL in a link preview has to be
	// absolute, and metadataBase is what turns the relative ones below into that.
	metadataBase: new URL(SITE_URL),
	title: TITLE,
	description: DESCRIPTION,
	openGraph: {
		type: "website",
		url: SITE_URL,
		siteName: TITLE,
		title: TITLE,
		description: DESCRIPTION,
		images: [
			{
				url: "/og.jpg",
				width: 1200,
				height: 630,
				type: "image/jpeg",
				alt: "Catch the Craft — sponsor logos falling towards a catcher plate",
			},
		],
	},
	twitter: {
		card: "summary_large_image",
		title: TITLE,
		description: DESCRIPTION,
		images: ["/og.jpg"],
	},
};

export const viewport: Viewport = {
	themeColor: "#1a1a17",
	width: "device-width",
	initialScale: 1,
	// The playfield is driven by drag; pinch-zooming it only ever loses the plate.
	maximumScale: 1,
	userScalable: false,
};

/**
 * Clerk's components dressed in the same warm black-and-white as everything
 * else, so signing in does not look like a different product bolted on. The
 * keycap and panel classes are the app's own, reused rather than re-described.
 */
const clerkAppearance = {
	variables: {
		colorPrimary: "#e6e3d8",
		colorBackground: "#161613",
		colorText: "#f2f0e9",
		colorTextSecondary: "#a2a096",
		colorInputBackground: "#1a1a17",
		colorInputText: "#f2f0e9",
		colorDanger: "#f87171",
		borderRadius: "0.5rem",
		fontFamily: "var(--font-plex-mono), ui-monospace, monospace",
	},
	elements: {
		card: "panel",
		headerTitle: "pixel-heading text-lg",
		headerSubtitle: "text-[color:var(--text-dim)]",
		formButtonPrimary: "keycap font-semibold",
		socialButtonsBlockButton: "keycap-ghost",
		footerActionLink: "text-[color:var(--bright)]",
		formFieldLabel: "section-label",
	},
} as const;

export default function RootLayout({ children }: { children: React.ReactNode }) {
	return (
		<html
			lang="en"
			className={`${silkscreen.variable} ${ibmPlexMono.variable} ${borel.variable} h-full antialiased`}
		>
			<body>
				{/* Inside <body>, which is where this SDK requires it. */}
				<ClerkProvider appearance={clerkAppearance}>{children}</ClerkProvider>
			</body>
		</html>
	);
}
