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

export const metadata: Metadata = {
	title: "CATCH THE CRAFT",
	description: "osu!catch for The Next Craft — catch the sponsors, keep the combo.",
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
