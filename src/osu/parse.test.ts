import { readFileSync } from "node:fs";
import { describe, expect, it } from "bun:test";
import { parseOsu } from "./parse";
import { catcherWidthFor, fallDurationFor, toCatchBeatmap } from "./toCatch";

const CHART = readFileSync("public/beatmaps/attitude/easy.osu", "utf8");

describe("parseOsu", () => {
  const beatmap = parseOsu(CHART);

  it("reads the header and metadata", () => {
    expect(beatmap.general.mode).toBe(2);
    expect(beatmap.general.audioFilename).toBe("audio.mp3");
    expect(beatmap.metadata.artist).toBe("aespa");
    expect(beatmap.metadata.version).toBe("Cup");
    expect(beatmap.metadata.beatmapSetId).toBe(2573813);
  });

  it("reads difficulty settings", () => {
    expect(beatmap.difficulty.circleSize).toBe(2.5);
    expect(beatmap.difficulty.approachRate).toBe(6);
    expect(beatmap.difficulty.sliderMultiplier).toBeGreaterThan(0);
  });

  it("reads every hit object in time order", () => {
    expect(beatmap.hitObjects).toHaveLength(188);
    expect(beatmap.hitObjects.some((o) => o.type === "slider")).toBe(true);
    expect(beatmap.hitObjects.some((o) => o.type === "spinner")).toBe(true);

    for (let i = 1; i < beatmap.hitObjects.length; i++) {
      expect(beatmap.hitObjects[i].time).toBeGreaterThanOrEqual(beatmap.hitObjects[i - 1].time);
    }
  });

  it("splits timing points into uninherited and inherited", () => {
    const uninherited = beatmap.timingPoints.filter((p) => p.uninherited);
    expect(uninherited.length).toBeGreaterThan(0);
    for (const point of uninherited) expect(point.beatLength).toBeGreaterThan(0);
    for (const point of beatmap.timingPoints) {
      expect(point.sliderVelocity).toBeGreaterThan(0);
    }
  });

  it("rejects a file with no hit objects", () => {
    expect(() => parseOsu("osu file format v14\n\n[HitObjects]\n")).toThrow();
  });

  it("falls back to overall difficulty when approach rate is absent", () => {
    const legacy = parseOsu(
      "osu file format v5\n\n[Difficulty]\nOverallDifficulty:7\n\n[HitObjects]\n256,192,1000,1,0\n",
    );
    expect(legacy.difficulty.approachRate).toBe(7);
  });
});

describe("toCatchBeatmap", () => {
  const converted = toCatchBeatmap(parseOsu(CHART));

  it("produces objects inside the playfield, ordered by time", () => {
    expect(converted.objects.length).toBeGreaterThan(beatmapObjectCount());

    for (let i = 0; i < converted.objects.length; i++) {
      const object = converted.objects[i];
      expect(object.x).toBeGreaterThanOrEqual(0);
      expect(object.x).toBeLessThanOrEqual(512);
      expect(Number.isFinite(object.time)).toBe(true);
      if (i > 0) expect(object.time).toBeGreaterThanOrEqual(converted.objects[i - 1].time);
    }
  });

  it("turns spinners into banana showers", () => {
    expect(converted.objects.filter((o) => o.kind === "banana").length).toBeGreaterThan(10);
  });

  it("excludes bananas from max combo", () => {
    const catchable = converted.objects.filter((o) => o.kind !== "banana").length;
    expect(converted.maxCombo).toBe(catchable);
  });

  it("is deterministic, so every player gets the same chart", () => {
    const again = toCatchBeatmap(parseOsu(CHART));
    expect(again.objects).toEqual(converted.objects);
  });

  function beatmapObjectCount() {
    return parseOsu(CHART).hitObjects.length;
  }
});

describe("difficulty formulas", () => {
  it("matches osu!'s catcher scaling", () => {
    expect(catcherWidthFor(5)).toBeCloseTo(85.4, 1);
    expect(catcherWidthFor(2.5)).toBeCloseTo(115.29, 1);
  });

  it("matches osu!'s approach rate preempt", () => {
    expect(fallDurationFor(5)).toBe(1200);
    expect(fallDurationFor(6)).toBe(1050);
    expect(fallDurationFor(10)).toBe(450);
    expect(fallDurationFor(0)).toBe(1800);
  });
});
