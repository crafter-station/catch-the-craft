# CATCH THE CRAFT

**Live: [catch.crafter.run](https://catch.crafter.run)**

osu!catch in the browser, for [The Next Craft](https://thenextcraft.org) — real osu!
beatmaps, sponsor logos as the fruit, and an arcade leaderboard.

```
bun install
bun dev
```

Open the app and pick a track. Arrows or `A`/`D` to move, `Shift` or `Space` to
dash, or just aim with the mouse. On a phone, drag anywhere on the playfield.
`Esc` opens the pause menu — continue, retry, quit, and the volume sliders.
`[` and `]` nudge the audio offset by 5ms if the booth machine needs it.

Music and effects levels sit on the main menu too, so they can be set for a loud
room before anyone is queueing. They live in `localStorage` only (`ctb.audio`) —
a per-machine preference, never sent to the server, so the booth laptop and a
phone player each keep their own.

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

**Chart time is the audio playback position, and nothing else.** `AudioClock`
already counts through the lead-in, reporting negative time until playback
begins, so no caller may subtract the lead-in again — doing so lands every
object a lead-in behind the music, which looks entirely correct on screen and is
obvious the moment you listen. Measured drift on a real chart is under 20ms.

Catching sprays particles in the sponsor's colour and presses the plate into its
shadow; dropping something jolts the playfield, while the HUD and the bursts stay
still — a score that jitters is only hard to read. At combo milestones a sponsor slides in from the edge, osu!'s combo
bursts with logos in place of anime characters; they cycle the roster rather
than following the fruit, so every sponsor gets airtime regardless of which
logos happened to spawn. An announcer names whichever sponsor is on screen.

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

Interface hovers and clicks use osu!'s keyboard samples, delegated from one
document-level listener rather than wired per button — screens here mount and
unmount constantly, and every control would otherwise have to opt in.

Gameplay samples in `public/sfx/` are from
[ppy/osu-resources](https://github.com/ppy/osu-resources), licensed
**CC BY-NC 4.0**. Fine for a hackathon booth; if this ever becomes commercial,
they have to be replaced.

The opening themes in `public/music/` are the event's own. To add or swap one,
edit `MENU_THEMES` in `src/app/page.tsx` — the caching, the volume slider and
the start-on-first-gesture handling all key off that array. Lyrics for the theme
are in `docs/theme-lyrics.md`.

The announcer lines in `public/voice/` were generated with OpenAI's
`gpt-4o-mini-tts`. To regenerate or add one, see `SPONSORS` in
`src/game/render/tokens.ts` for the roster and `src/game/audio/voice.ts` for the
slugs the game looks for; the files are plain mp3s named after the slug.

Participant badges are served from
[thenextcraft.crafter.run](https://thenextcraft.crafter.run).

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

## Screens

`Title -> Play | Settings`, then `Songs -> Song -> Run -> Results`. Choosing a
song shows **that song's leaderboard for the selected difficulty** before you
play it: a target read ten seconds before a run is worth more than one read
after it.

Entering a run and leaving one cross-fade through a void panel. The phase swaps
while the panel is fully opaque rather than before it, so the incoming screen is
never caught mid-mount — which matters most on the way into a run while the
canvas is sizing itself and audio is still decoding. When a run ends the canvas
holds on its final frame for a beat first, so the run resolves visibly instead
of the screen changing under the player.

The menus play one of the event's own opening themes, chosen at random per
visit so the booth is not repeating itself across twelve hours. On a song screen
it switches to that beatmap from the chart's own `PreviewTime`, looping back to
the preview point rather than the top of the track — the way osu! song select
does.
The context is built and the track scheduled on load, before any interaction.
Browsers start it suspended when autoplay is blocked, and it resumes itself on
the first gesture — a keypress, a touch, reaching for PLAY — with the audio
already fetched, decoded and queued. Waiting for the gesture before *loading*
meant the music only arrived some time after the first click.

Every track, the menu theme and the hitsounds go into the Cache API
(`ctb-audio-v1`), and the beatmaps are pulled down while someone is still
reading the menu. A booth laptop downloads each song once no matter how many
people play it, and a reload costs nothing.

The title's letters shake continuously, each on its own offset so the word never
moves as one block, and tighten into a faster jitter while hovered.

Beside them, hackathon badges cross-fade one at a time every 900ms. All of them
are fetched up front, because at that cadence a single uncached image is a
visible stall. Numbers are not contiguous, so the roster size is discovered
server-side with a gap-tolerant probe and numbers with no published badge drop
out of the rotation. Upstream serves 1080x1350 JPEGs at ~400KB with
`max-age=0`; `/api/participants/[id]` resizes them to 320px WebP (~9KB) and
serves them immutable, which turns 63MB of badges into about 1.5MB.

## Leaderboard

Every song and difficulty keeps its own board, shown on the song screen.
`/leaderboard` is a standalone full-screen board for a second monitor, pinned to
the featured map's EASY difficulty.

Names are up to ten characters — letters, digits, spaces and dashes — so a team
can put its own name up rather than three initials.

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
