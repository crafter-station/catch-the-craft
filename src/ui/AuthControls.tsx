"use client";

import { SignInButton, UserButton, useUser } from "@clerk/nextjs";
import { useStrings } from "@/i18n/strings";
import { Icon } from "./Icon";

/**
 * Sign in, or the account you are signed in as.
 *
 * Driven by `useUser` rather than the `<SignedIn>` / `<SignedOut>` control
 * components, which Core 3 removed — the hook is the form that survives an SDK
 * major.
 *
 * Deliberately optional. Anyone can walk up and play, and a score set signed out
 * still lands on the board under a typed name; signing in only means the score
 * follows you between visits and keeps your best on each song.
 */
export function AuthControls() {
	const { t } = useStrings();
	const { isLoaded, isSignedIn } = useUser();

	// Render nothing until Clerk resolves, or the control flips on hydration.
	if (!isLoaded) return null;

	if (isSignedIn) {
		return (
			<UserButton
				appearance={{
					elements: {
						userButtonAvatarBox: "h-7 w-7 rounded-sm",
						userButtonPopoverCard: "panel",
					},
				}}
			/>
		);
	}

	return (
		<SignInButton mode="modal">
			<button
				type="button"
				className="keycap-ghost inline-flex items-center gap-2 px-4 py-1.5 text-xs"
			>
				<Icon name="user" size={0.9} />
				{t.signIn}
			</button>
		</SignInButton>
	);
}
