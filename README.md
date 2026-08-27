# CATCH THE CRAFT

**Live: [catch.crafter.run](https://catch.crafter.run)**

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
(`src/game/render/tokens.ts`). Each logo is knocked out to a silhouette and
fitted to the largest rectangle that inscribes in its disc — most sponsor marks
are wordmarks near 4:1, and a square fit leaves the lettering unreadable at 40px.
Which logo spawns is cosmetic: every token scores the same, so the leaderboard
never depends on it.

Hitsounds are osu!'s own samples, played through the same `AudioContext` as the
music. A second context would run on its own hardware callback and drift.

## Look and feel

Palette, fonts and components come from
[the-next-craft](https://github.com/crafter-station/the-next-craft): warm
black-and-white (`#1a1a17` void, `#f2f0e9` text, `#8c8a82` lines), Silkscreen for
pixel headings, IBM Plex Mono for everything else, and the `.keycap` / `.panel` /
`.grid-bg` utilities. There is deliberately no accent hue — the sponsor tokens
are the only colour in the product, which is what makes them read as the subject
rather than as decoration. The catcher is drawn as a C64 keycap, and dashing
lifts it off its own shadow.

Scanlines are applied to the shell and never over the playfield canvas:
interference across moving objects makes them measurably harder to track.

## Credits

Gameplay samples in `public/sfx/` are from
[ppy/osu-resources](https://github.com/ppy/osu-resources), licensed
**CC BY-NC 4.0**. Fine for a hackathon booth; if this ever becomes commercial,
they have to be replaced.

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

Already deployed. To redeploy after a push:

```bash
vps compose redeploy zsQV6ZlBWQ5UwzxlKUBlO
```

The stack was created with:

```bash
vps github deploy crafter-station/catch-the-craft -e <envId> --compose
vps compose env <composeId> --set "POSTGRES_PASSWORD=<password>"
crafters domain add catch --no-vercel --target vps.crafter.run
vps domain add catch.crafter.run --compose <composeId> --service app --port 3000
```

Two things the Dockerfile encodes that are easy to get wrong here. The image
installs dependencies with Bun but builds and serves with **Node** — Bun's NAPI
layer cannot load Turbopack's worker pool in a container, so `bun run build`
fails there even though it works locally. And the compose file must **not**
declare `dokploy-network`; Dokploy attaches its own network when a domain is
bound, and naming it fails the deploy before anything is built.

Never run `vps compose remove --delete-volumes` against this stack — that is the
one command that destroys the leaderboard.
