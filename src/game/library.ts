import { parseOsu } from "@/osu/parse";
import { type CatchBeatmap, toCatchBeatmap } from "@/osu/toCatch";

export type Tier = "EASY" | "NORMAL" | "HARD";

export interface DifficultyEntry {
	tier: Tier;
	/** File name inside the beatmap folder, e.g. `easy.osu`. */
	file: string;
	/** The chart's own difficulty name, e.g. "Cup" or "Sadu's Salad". */
	name: string;
	circleSize: number;
	approachRate: number;
	objectCount: number;
	/** Score a flawless run would produce. The server rejects anything above it. */
	maxScore: number;
}

export interface BeatmapEntry {
	slug: string;
	setId: number;
	title: string;
	artist: string;
	audio: string;
	/** Start of the played window within the track, in ms. */
	startMs: number;
	/** Length of the played window, in ms. */
	durationMs: number;
	/** The one map whose scores go on the shared leaderboard. */
	tournament: boolean;
	difficulties: DifficultyEntry[];
}

export async function loadManifest(): Promise<BeatmapEntry[]> {
	const response = await fetch("/beatmaps/manifest.json");
	if (!response.ok) throw new Error("Beatmap manifest is missing");
	return response.json();
}

/**
 * Charts are parsed in the browser from the same `.osu` files osu! ships, rather
 * than being pre-converted at build time. Costs a few ms per load and means the
 * drag-and-drop `.osz` path runs through exactly the same code as the bundled
 * maps — one parser to get right instead of two.
 */
export async function loadChart(
	entry: BeatmapEntry,
	tier: Tier,
): Promise<CatchBeatmap> {
	const difficulty = entry.difficulties.find((d) => d.tier === tier);
	if (!difficulty) throw new Error(`${entry.slug} has no ${tier} difficulty`);

	const response = await fetch(`/beatmaps/${entry.slug}/${difficulty.file}`);
	if (!response.ok)
		throw new Error(`Failed to load chart: ${entry.slug}/${difficulty.file}`);

	return toCatchBeatmap(parseOsu(await response.text()));
}
