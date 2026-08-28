/**
 * Extracts the difficulties we ship out of downloaded `.osz` archives into
 * `public/beatmaps/<slug>/`. Run with `bun run scripts/bundle-beatmaps.ts <oszDir>`.
 *
 * Audio is copied whole rather than trimmed: the run window is applied at
 * playback time by seeking the decoded buffer, which keeps chart time and audio
 * time in the same coordinate system and lets the window be retuned without
 * re-cutting any files.
 */
import { mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { unzipSync } from "fflate";
import { maximumScore } from "../src/game/scoring";
import { parseOsu } from "../src/osu/parse";
import { toCatchBeatmap } from "../src/osu/toCatch";

interface Bundled {
  setId: number;
  slug: string;
  /** Start of the played window, in ms. */
  startMs: number;
  /** Length of the played window, in ms. */
  durationMs: number;
  tournament: boolean;
}

const CATALOGUE: Bundled[] = [
  { setId: 2573813, slug: "attitude", startMs: 0, durationMs: 90_000, tournament: true },
  { setId: 2558930, slug: "kimi-no-shiranai-monogatari", startMs: 0, durationMs: 90_000, tournament: false },
  { setId: 2469870, slug: "what-ive-done", startMs: 30_000, durationMs: 90_000, tournament: false },
  { setId: 1478481, slug: "sugary-daydream", startMs: 25_000, durationMs: 90_000, tournament: false },
];

/** Difficulty names we surface, in ascending order, mapped to our own tiers. */
const TIERS = [
  { tier: "EASY", matches: ["cup"] },
  { tier: "NORMAL", matches: ["salad"] },
  { tier: "HARD", matches: ["platter"] },
] as const;

const sourceDir = process.argv[2];
if (!sourceDir) {
  console.error("usage: bun run scripts/bundle-beatmaps.ts <dir-with-osz-files>");
  process.exit(1);
}

const outputRoot = join(process.cwd(), "public", "beatmaps");
rmSync(outputRoot, { recursive: true, force: true });
mkdirSync(outputRoot, { recursive: true });

const manifest = [];

for (const entry of CATALOGUE) {
  const archive = unzipSync(readFileSync(join(sourceDir, `${entry.setId}.osz`)));
  const outputDir = join(outputRoot, entry.slug);
  mkdirSync(outputDir, { recursive: true });

  const difficulties = [];
  let audioFilename = "";
  let previewMs = 0;
  let title = "";
  let artist = "";

  for (const { tier, matches } of TIERS) {
    const found = Object.entries(archive).find(([name, bytes]) => {
      if (!name.toLowerCase().endsWith(".osu")) return false;
      const parsed = safeParse(bytes);
      if (!parsed || parsed.general.mode !== 2) return false;
      // Guest difficulties are named e.g. "Sadu's Salad", so match on substring.
      return matches.some((m) => parsed.metadata.version.toLowerCase().includes(m));
    });

    if (!found) {
      console.warn(`  ${entry.slug}: no ${tier} difficulty, skipping tier`);
      continue;
    }

    const [, bytes] = found;
    const parsed = parseOsu(new TextDecoder().decode(bytes));
    const file = `${tier.toLowerCase()}.osu`;
    writeFileSync(join(outputDir, file), bytes);

    audioFilename = parsed.general.audioFilename;
    // osu! plays the track from here in song select; the menus do the same.
    previewMs = parsed.general.previewTime > 0 ? parsed.general.previewTime : 0;
    title = parsed.metadata.title;
    artist = parsed.metadata.artist;

    // The score ceiling is computed here, once, so the API can reject anything
    // above it without having to parse charts on every submission.
    const converted = toCatchBeatmap(parsed);

    difficulties.push({
      tier,
      file,
      name: parsed.metadata.version,
      circleSize: parsed.difficulty.circleSize,
      approachRate: parsed.difficulty.approachRate,
      objectCount: parsed.hitObjects.length,
      maxScore: maximumScore(converted.objects, entry.startMs, entry.startMs + entry.durationMs),
    });
  }

  const audio = archive[audioFilename] ?? findAudio(archive);
  if (!audio) throw new Error(`${entry.slug}: no audio track found in archive`);
  writeFileSync(join(outputDir, "audio.mp3"), audio);

  manifest.push({
    slug: entry.slug,
    setId: entry.setId,
    title,
    artist,
    audio: `/beatmaps/${entry.slug}/audio.mp3`,
    startMs: entry.startMs,
    durationMs: entry.durationMs,
    previewMs,
    tournament: entry.tournament,
    difficulties,
  });

  console.log(
    `✓ ${entry.slug}: ${artist} - ${title} (${difficulties.map((d) => d.tier).join(", ")}, audio ${Math.round(audio.length / 1024)}KB)`,
  );
}

writeFileSync(join(outputRoot, "manifest.json"), `${JSON.stringify(manifest, null, 2)}\n`);
console.log(`\nWrote manifest with ${manifest.length} beatmaps.`);

function safeParse(bytes: Uint8Array) {
  try {
    return parseOsu(new TextDecoder().decode(bytes));
  } catch {
    return null;
  }
}

function findAudio(archive: Record<string, Uint8Array>): Uint8Array | undefined {
  const name = Object.keys(archive).find(
    (f) => f.toLowerCase().endsWith(".mp3") && !f.toLowerCase().includes("hit"),
  );
  return name ? archive[name] : undefined;
}
