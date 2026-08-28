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

export default function RootLayout({ children }: { children: React.ReactNode }) {
	return (
		<html
			lang="en"
			className={`${silkscreen.variable} ${ibmPlexMono.variable} ${borel.variable} h-full antialiased`}
		>
			<body>{children}</body>
		</html>
	);
}
