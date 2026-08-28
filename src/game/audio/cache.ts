/**
 * Persistent cache for audio.
 *
 * Beatmap tracks are megabytes each and the menu theme is played on every visit,
 * so they are stored in the Cache API rather than refetched. That survives a
 * reload, unlike the decoded buffers held in memory, and means a booth laptop
 * downloads each song exactly once no matter how many people play it.
 */
const CACHE_NAME = "ctb-audio-v1";

export async function cachedArrayBuffer(url: string): Promise<ArrayBuffer> {
	try {
		const cache = await caches.open(CACHE_NAME);

		const hit = await cache.match(url);
		if (hit) return await hit.arrayBuffer();

		const response = await fetch(url);
		if (!response.ok) throw new Error(`Failed to load audio: ${url}`);

		// Clone before reading: a Response body can only be consumed once.
		await cache.put(url, response.clone());
		return await response.arrayBuffer();
	} catch (error) {
		// The Cache API is unavailable in insecure contexts and some private modes.
		// Falling back to a plain fetch costs the caching, not the game.
		if (error instanceof Error && error.message.startsWith("Failed to load audio")) {
			throw error;
		}
		return plainFetch(url);
	}
}

async function plainFetch(url: string): Promise<ArrayBuffer> {
	const response = await fetch(url);
	if (!response.ok) throw new Error(`Failed to load audio: ${url}`);
	return response.arrayBuffer();
}

/** Warms the cache without decoding — used to pull beatmaps down ahead of time. */
export async function prefetchAudio(url: string): Promise<void> {
	try {
		const cache = await caches.open(CACHE_NAME);
		if (await cache.match(url)) return;
		await cache.add(url);
	} catch {
		// Prefetching is an optimisation; failing it must never surface.
	}
}
