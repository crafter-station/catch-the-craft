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
  tournament: boolean;
}

/**
 * Padding after the last object, so the progress bar reaches the end and the
 * final fruit has somewhere to land before the run resolves.
 */
const TAIL_MS = 2_000;

/**
 * Every chart is played in full, from the top. The window is derived from the
 * chart itself rather than configured, so adding a song is one line.
 */
const CATALOGUE: Bundled[] = [
  { setId: 2573813, slug: "attitude", tournament: true },
  { setId: 2558930, slug: "kimi-no-shiranai-monogatari", tournament: false },
  { setId: 2469870, slug: "what-ive-done", tournament: false },
  { setId: 1478481, slug: "sugary-daydream", tournament: false },
  { setId: 2572301, slug: "boom-boom-boom-boom", tournament: false },
  { setId: 2377500, slug: "rockefeller-street", tournament: false },
  { setId: 2504028, slug: "black-rover", tournament: false },
  { setId: 2496961, slug: "more-jump-more", tournament: false },
  { setId: 2471999, slug: "hate-the-way-you-love-me", tournament: false },
  { setId: 978168, slug: "gurenge", tournament: false },
  { setId: 1284215, slug: "lost-in-paradise", tournament: false },
  { setId: 1316755, slug: "kaikai-kitan", tournament: false },
  { setId: 639494, slug: "yoka-yoka-dance", tournament: false },
  { setId: 2043818, slug: "idol", tournament: false },
  { setId: 1190741, slug: "platina", tournament: false },
  { setId: 321999, slug: "last-of-the-wilds", tournament: false },
  { setId: 1558943, slug: "pokemon-theme", tournament: false },
  { setId: 549036, slug: "sentou-mew", tournament: false },
  { setId: 2155969, slug: "touka-city", tournament: false },
  { setId: 1973407, slug: "pokemon-center", tournament: false },
  { setId: 1821381, slug: "n-no-dragon", tournament: false },
  { setId: 442618, slug: "xy-and-z", tournament: false },
  { setId: 2362134, slug: "starring-star", tournament: false },
  { setId: 2377706, slug: "telepathy", tournament: false },
  { setId: 68019, slug: "dragon-soul", tournament: false },
];

/** Difficulty names we surface, in ascending order, mapped to our own tiers. */
const TIERS = [
  { tier: "EASY", matches: ["cup"] },
  { tier: "NORMAL", matches: ["salad"] },
  { tier: "HARD", matches: ["platter"] },
] as const;

type Tier = (typeof TIERS)[number]["tier"];

/**
 * Where a chart belongs when it does not name itself Cup / Salad / Platter.
 *
 * Judged on what it actually plays like rather than on which slot happens to be
 * free: a lone difficulty at CS 6 / AR 9 is a hard chart, and filing it under
 * EASY because EASY was empty would be a lie to whoever picks it.
 */
function inferTier(difficulty: { circleSize: number; approachRate: number }): Tier {
  if (difficulty.approachRate >= 8 || difficulty.circleSize >= 4) return "HARD";
  if (difficulty.approachRate >= 7 || difficulty.circleSize >= 3.2) return "NORMAL";
  return "EASY";
}

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
  // The longest difficulty decides how far the progress bar has to run.
  let lastObjectMs = 0;

  // Every native catch difficulty in the archive, parsed once.
  const natives = Object.values(archive)
    .map((bytes) => ({ bytes, parsed: safeParse(bytes) }))
    .filter((d) => d.parsed !== null && d.parsed.general.mode === 2);

  const chosen = new Map<Tier, (typeof natives)[number]>();

  // Preferred: the chart names itself, including guest names like "Sadu's Salad".
  for (const { tier, matches } of TIERS) {
    const hit = natives.find((d) =>
      matches.some((m) => d.parsed?.metadata.version.toLowerCase().includes(m)),
    );
    if (hit) chosen.set(tier, hit);
  }

  // Anything left over is placed by how it plays, filling only empty slots.
  for (const candidate of natives) {
    if ([...chosen.values()].includes(candidate)) continue;
    if (!candidate.parsed) continue;
    const tier = inferTier(candidate.parsed.difficulty);
    if (!chosen.has(tier)) chosen.set(tier, candidate);
  }

  for (const { tier } of TIERS) {
    const picked = chosen.get(tier);
    if (!picked) {
      console.warn(`  ${entry.slug}: no ${tier} difficulty`);
      continue;
    }

    const parsed = parseOsu(new TextDecoder().decode(picked.bytes));
    const file = `${tier.toLowerCase()}.osu`;
    writeFileSync(join(outputDir, file), picked.bytes);

    audioFilename = parsed.general.audioFilename;
    // osu! plays the track from here in song select; the menus do the same.
    previewMs = parsed.general.previewTime > 0 ? parsed.general.previewTime : 0;
    title = parsed.metadata.title;
    artist = parsed.metadata.artist;

    // The score ceiling is computed here, once, so the API can reject anything
    // above it without having to parse charts on every submission.
    const converted = toCatchBeatmap(parsed);
    lastObjectMs = Math.max(lastObjectMs, converted.objects.at(-1)?.time ?? 0);

    difficulties.push({
      tier,
      file,
      name: parsed.metadata.version,
      circleSize: parsed.difficulty.circleSize,
      approachRate: parsed.difficulty.approachRate,
      objectCount: parsed.hitObjects.length,
      // Over the whole chart, since the whole chart is now played. A ceiling
      // computed over a shorter window would reject legitimate full-run scores.
      maxScore: maximumScore(converted.objects, 0, Number.POSITIVE_INFINITY),
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
    startMs: 0,
    durationMs: lastObjectMs + TAIL_MS,
    previewMs,
    tournament: entry.tournament,
    difficulties,
  });

  console.log(
    `✓ ${entry.slug}: ${artist} - ${title} (${difficulties.map((d) => d.tier).join(", ")}, ${Math.round((lastObjectMs + TAIL_MS) / 1000)}s, audio ${Math.round(audio.length / 1024)}KB)`,
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
