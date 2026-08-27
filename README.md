# CATCH THE CRAFT

osu!catch in the browser, for [The Next Craft](https://thenextcraft.org) — real osu!
beatmaps, sponsor logos as the fruit, and an arcade leaderboard.

```
bun install
bun dev
```

Open the app and pick a track. Arrows or `A`/`D` to move, `Shift` to dash, or just
aim with the mouse. On a phone, drag anywhere on the playfield.

## How it works

The chart is the real thing. `.osu` files are parsed in the browser
(`src/osu/parse.ts`), slider paths are flattened to arc-length polylines
(`src/osu/curve.ts`), and the result is converted to osu!catch's own object model
(`src/osu/toCatch.ts`) — circles become fruit, sliders become juice streams with
droplets on the tick grid, spinners become banana showers. Catcher width comes
from the chart's circle size and fall time from its approach rate, using osu!'s
formulas.

The run itself is a plain class with a `requestAnimationFrame` loop
(`src/game/engine.ts`) drawing to one canvas. No game state lives in React, so a
re-render can never drop a frame. Time comes from `AudioContext.currentTime` and
nothing else.

Fruit are sponsor logos composited at boot into brand-coloured discs
(`src/game/render/tokens.ts`). Which logo spawns is cosmetic — every token scores
the same, so the leaderboard never depends on it.

## Scripts

| Command | |
|---|---|
| `bun dev` | Development server |
| `bun test` | Parser and conversion tests |
| `bun run lint` | Biome |
| `bun run typecheck` | TypeScript |
| `bun run bundle:beatmaps <dir>` | Rebuild `public/beatmaps` from `.osz` archives |

## Beatmaps

`public/beatmaps/` is generated. To change the setlist, edit `CATALOGUE` in
`scripts/bundle-beatmaps.ts`, download the `.osz` files, and re-run the bundler:

```bash
curl -L "https://osu.direct/api/d/<setId>" -o <setId>.osz
bun run bundle:beatmaps ./<dir-with-osz>
```

The bundler also computes each chart's maximum possible score, which the API uses
as a ceiling when validating submissions.

## Leaderboard

One shared board, on the tournament map's EASY difficulty. Everything else is
free play. `/leaderboard` is a standalone full-screen board for a second monitor.

Storage sits behind `ScoreRepository`: a JSON file in development, Postgres when
`DATABASE_URL` is set. Submissions that fail are queued in `localStorage` and
flushed on the next successful request, so a dropped connection never costs
somebody their score.

## Deploying

Docker Compose — the app and its Postgres, with the database on a named volume.

```bash
vps github deploy crafter-station/catch-the-craft -e <envId> --compose
vps compose env <composeId> --set "POSTGRES_PASSWORD=<password>"
vps domain add catch.crafter.run --compose <composeId> --port 3000
```

Never run `vps compose remove --delete-volumes` against this stack — that is the
one command that destroys the leaderboard.
