# CATCH THE CRAFT — Plan

> **Status: shipped and live at https://catch.crafter.run**
> Phases 1–4 are done. Remaining: hyperdash, `.osz` drag-drop, service worker,
> QR poster, and tuning the audio offset on the booth machine.

osu!Catch clone for The Next Craft (Aug 29, 2026). Next.js 16, real `.osu` beatmaps,
sponsor logos as fruit, C64-terminal shell, leaderboard on Dokploy.

## Locked decisions

| # | Decision |
|---|---|
| Scope | Booth game, playable Aug 29. ~48h budget. |
| Maps | Bundled-first (`public/beatmaps/`), `.osz` drag-drop as secondary path. |
| Copyright | Not a concern. Real osu! maps. |
| Renderer | Canvas 2D. `GameEngine` class + rAF. No game state in React. |
| Fidelity | Fruits + juice streams + banana showers. No hyperdash (stretch). |
| Input | Arrows/A-D + Shift dash · mouse-X mode · touch drag (mobile). |
| Fail | No-fail always. No HP bar. |
| Run length | Whole chart, no cut. (Was a ~90s window; removed later.) |
| Scoring | Arcade tiers 1x/2x/4x/8x at 10/25/50 combo. Accuracy = caught/total. |
| Audio clock | `AudioContext.currentTime`. Decoded `AudioBuffer`. Hardcoded offset + `[`/`]` nudge. |
| Aesthetic | C64 terminal shell; playfield stays readable. Light scanlines only. |
| Fruit | Circular brand-colored tokens, composited at runtime. Cosmetic only, never mechanical. |
| Storage | `ScoreRepository` iface. JSON file = local dev. Postgres = prod. |
| Deploy | Dokploy VPS, **docker-compose**, `crafter-station/catch-the-craft` (**private** — the repo carries commercial mp3s, and a public repo of those invites a DMCA). |
| DB | Postgres **inside the compose stack**, named volume `ctb-pgdata`, no public port. |
| Domain | `catch.crafter.run` |
| Board | ONE global board on the tournament map's EASY diff. Everything else free play. |
| Anti-cheat | Server-side plausibility checks + per-IP rate limit. |
| Tests | Parser snapshot test only. |

## Verified facts

- `osu.direct` download: `https://osu.direct/api/d/{setId}` (NOT `/api/v2/d/` — that 404s).
  Search: `https://osu.direct/api/v2/search?mode=2&amount=N` (no `sort` param — it 400s).
  catboy.best and nerinyan.moe are both DOWN. osu.direct is the only live mirror.
- Set 2573813 verified: Cup/Salad/Platter/Rain/Majestic, all `Mode: 2`, audio.mp3 2.1MB.
- CtB diff names: Cup -> Salad -> Platter -> Rain -> Overdose. Map to EASY/NORMAL/HARD.
- Dokploy: v0.29.1, IP 95.111.248.246. GitHub account `mQ9jA2X9wMQI62PpeoWaL` = crafter-station org.
- Next.js on this VPS MUST set `HOSTNAME=0.0.0.0` or Traefik returns 404.
- Reference repo fonts: Silkscreen (display), IBM Plex Mono / Geist Mono (body).
- Sponsor logos: `public/sponsors/*.svg|png` in crafter-station/the-next-craft.
- Latest: Next 16.3.3, Tailwind 4.3.3. Local: Bun 1.2.0, Node 22.22.1.

## Beatmaps

Tournament map: **aespa - ATTITUDE (TV Size)** `2573813` — 88s, no cut needed, Cup 1.51*.
Also bundle: supercell - Kimi no Shiranai Monogatari `2558930` (85s),
Linkin Park - What I've Done `2469870` (200s, needs cut),
Zekk - Sugary Daydream `1478481` (154s, needs cut).

## Layout

    src/
      app/
        page.tsx                  # state machine host (client island)
        leaderboard/page.tsx      # second-screen board
        api/scores/route.ts       # GET + POST
      game/
        engine.ts                 # rAF loop, no React
        clock.ts                  # AudioContext master clock
        catcher.ts  fruit.ts  spawner.ts  scoring.ts
        render/canvas.ts  render/tokens.ts   # sponsor token compositing
      osu/
        parse.ts                  # .osu -> Beatmap  (the one tested module)
        types.ts
        osz.ts                    # fflate unzip for drag-drop
        toCatch.ts                # hitobjects -> falling fruit + droplets
      scores/
        repository.ts             # interface
        json-repo.ts  pg-repo.ts
      ui/                         # terminal shell components
    public/beatmaps/<slug>/{map.osu, audio.mp3, meta.json}
    docker-compose.yaml  Dockerfile  .env.example

## Build order

**Phase 1 — engine spike (must work before anything else is worth building)**
1. `bun create next-app` w/ Tailwind 4 + Biome, lift tokens/fonts from the-next-craft.
2. `.osu` parser: `[General] [Difficulty] [TimingPoints] [HitObjects]`. Parser test.
3. Bundle ATTITUDE: download osz, extract Cup+Salad+Platter, cut audio, write meta.json.
4. `toCatch`: circles -> fruit at `x`; sliders -> droplet trail sampled along the path;
   spinners -> banana shower. CS -> catcher width, AR -> fall time.
5. Canvas + AudioContext clock + keyboard catcher + catch detection. **Playable.**

**Phase 2 — game feel**
6. Combo/score/accuracy, miss handling, no-fail.
7. Sponsor token compositing (dominant-color extraction + disc + logo -> ImageBitmap).
8. Mouse + touch input. Offset nudge keys.

**Phase 3 — shell**
9. Boot sequence, title/attract, song select, results, 3-letter initials entry.
10. `/leaderboard` full-screen board.

**Phase 4 — ship**
11. `ScoreRepository` + json-repo + pg-repo + plausibility checks + pending-queue sync.
12. Dockerfile (standalone) + docker-compose (app + db + ctb-pgdata volume).
13. `git init` -> push to crafter-station/catch-the-craft ->
    `vps github deploy crafter-station/catch-the-craft -e <envId> --compose` ->
    `vps compose env` for POSTGRES_PASSWORD ->
    `crafters domain add catch` -> `vps domain add catch.crafter.run --compose <id> --port 3000`.

Stretch, in order: hyperdash · `.osz` drag-drop · service worker · QR poster.

## Risks

1. **Game feel is the whole product.** If Phase 1 doesn't feel good by end of day 1, cut
   Phase 3 down to a title screen and spend the time on feel.
2. **Audio offset.** Budget an hour for tuning on the actual booth machine.
3. **Sponsor tiering is a guess.** Default fruit rotation: Convex, Clerk, Cursor,
   ElevenLabs, Exa, Tavily, Vapi, Apify. Trivially changed; confirm before the event.
4. **osu.direct is the only live mirror.** Download all four sets to disk on day 1.
5. Never run `vps compose remove --delete-volumes`.

## Deployment facts learned the hard way

- Build the image with **Node**, not Bun. Bun's NAPI layer cannot load
  Turbopack's worker pool in a container; `bun run build` fails there while
  working locally. Dependencies still install under Bun.
- Do **not** declare `dokploy-network` as an external network in the compose
  file. Dokploy attaches its own when a domain is bound; naming it fails the
  deploy in ~30s, before any build starts.
- `vps compose deploy` queues; deployments run serially. `deployment.allByCompose`
  on the Dokploy API is the only way to see status from the CLI side — there is
  no log endpoint exposed, so a broken deploy is diagnosed by comparing against a
  known-good compose on the same host (`the-next-craft` is one).
- Adding a domain needs a redeploy before Traefik routes it.
- IDs: project `0wOxnwTY0zlsdLwwbNsgp`, env `zB7pYNZECCBpcsiS-CPOw`,
  compose `zsQV6ZlBWQ5UwzxlKUBlO`.
