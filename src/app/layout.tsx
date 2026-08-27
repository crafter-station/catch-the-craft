import type { Metadata, Viewport } from "next";
import { IBM_Plex_Mono, Silkscreen } from "next/font/google";
import "./globals.css";

const display = Silkscreen({
	weight: ["400", "700"],
	subsets: ["latin"],
	variable: "--font-silkscreen",
});

const mono = IBM_Plex_Mono({
	weight: ["400", "500", "600"],
	subsets: ["latin"],
	variable: "--font-plex-mono",
});

export const metadata: Metadata = {
	title: "CATCH THE CRAFT",
	description:
		"osu!catch for The Next Craft — catch the sponsors, keep the combo.",
};

export const viewport: Viewport = {
	themeColor: "#070b07",
	width: "device-width",
	initialScale: 1,
	// The playfield is driven by drag; pinch-zooming it only ever loses the plate.
	maximumScale: 1,
	userScalable: false,
};

export default function RootLayout({
	children,
}: {
	children: React.ReactNode;
}) {
	return (
		<html lang="en" className={`${display.variable} ${mono.variable}`}>
			<body>{children}</body>
		</html>
	);
}
