import { readFileSync } from "node:fs";
import { parseOsu } from "../src/osu/parse";
import { toCatchBeatmap, catcherWidthFor, fallDurationFor } from "../src/osu/toCatch";

const manifest = JSON.parse(readFileSync("public/beatmaps/manifest.json", "utf8"));

// Driven by the manifest rather than assuming three tiers: some sets only ship
// the difficulties their mappers actually made.
for (const entry of manifest as Array<{ slug: string; difficulties: Array<{ file: string }> }>) {
  const slug = entry.slug;
  for (const tier of entry.difficulties.map((d) => d.file.replace(".osu", ""))) {
    const raw = readFileSync(`public/beatmaps/${slug}/${tier}.osu`, "utf8");
    const map = parseOsu(raw);
    const catch_ = toCatchBeatmap(map);
    const o = catch_.objects;
    const counts = o.reduce<Record<string, number>>((a, x) => ((a[x.kind] = (a[x.kind] ?? 0) + 1), a), {});
    const xs = o.map((x) => x.x);
    const bad = o.filter((x) => !Number.isFinite(x.x) || !Number.isFinite(x.time) || x.x < 0 || x.x > 512);
    const nonMono = o.some((x, i) => i > 0 && x.time < o[i - 1].time);
    console.log(
      `${slug}/${tier.padEnd(6)} cs=${map.difficulty.circleSize} ar=${map.difficulty.approachRate}` +
      ` | hitobj=${map.hitObjects.length} -> ${o.length} (${JSON.stringify(counts)})` +
      ` | catcher=${catcherWidthFor(map.difficulty.circleSize).toFixed(1)} fall=${fallDurationFor(map.difficulty.approachRate).toFixed(0)}ms` +
      ` | t=${(o[0].time/1000).toFixed(1)}s..${(o[o.length-1].time/1000).toFixed(1)}s` +
      ` | x=${Math.min(...xs).toFixed(0)}..${Math.max(...xs).toFixed(0)}` +
      ` | maxCombo=${catch_.maxCombo}` +
      (bad.length ? ` !!BAD=${bad.length}` : "") + (nonMono ? " !!NONMONOTONIC" : "")
    );
  }
}
