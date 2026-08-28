import { clerkMiddleware } from "@clerk/nextjs/server";

/**
 * Nothing here is gated.
 *
 * The game is the point of the booth and must stay playable by anyone who walks
 * up, signed in or not. The middleware runs purely so `auth()` has a session to
 * read in the score route — signing in changes how a score is *attributed*, not
 * whether you can play.
 */
export default clerkMiddleware();

export const config = {
	matcher: [
		// Everything except Next internals and static files.
		"/((?!_next|[^?]*\\.(?:html?|css|js(?!on)|jpe?g|webp|png|gif|svg|ttf|woff2?|ico|csv|docx?|xlsx?|zip|webmanifest|mp3|wav|osu)).*)",
		// Always run for API routes, which is where identity actually matters.
		"/(api|trpc)(.*)",
	],
};
