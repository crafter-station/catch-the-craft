# CRAFT THE NIGHT — The Next Craft theme

Eurobeat, 160 BPM, ~2:30. Written for the hackathon on 29 August 2026: twelve
hours, 300 hackers, five cities at once.

Bracketed lines are production directions for the generator, not sung.

---

[Intro]
[high-energy synth brass riff, driving 160 BPM kick drum]
Welcome to The Next Craft!
[orchestral hit]
Three hundred hearts — one countdown — GO!

[Verse 1]
[synth bass sixteenth notes, staccato synth chords]
Twelve hours on the clock tonight
Every screen a city light
Lima calling, Bogotá
Arequipa, here we are
[snare roll]
Guatemala, San Salvador —
Everybody wants some more

[Pre-Chorus]
[filter rises, kick drops out]
Nothing left to overthink
Push the branch and cross the brink

[Chorus]
[layered sawtooth pads, bright synth brass accents]
Craft the night, we're taking flight
Craft the night, the build is right
(Yeah, yeah)
[orchestral hit]
Feel the power, feel the flame
The Next Craft is just the name

[Verse 2]
[synth bass returns, hi-hat sixteenths]
Teams of five and teams of three
Coffee cold, the server free
One idea, a hundred tries
Ship it once before sunrise
[snare roll]
Nobody remembers slow —
Only what you had to show

[Bridge — sponsor chant]
[stacked shouts over four-on-the-floor, brass stabs on each name]
Convex! Clerk! Cursor! Go!
ElevenLabs, let the voices flow
Exa, Tavily, find the sign
Vapi ringing down the line
Apify, Codex, Replit — run!
n8n, Yalo, CloudForge, one!
3DevLabs, Visagente, rise
Dapta, Innicia, open eyes
UCSM, UPCH — stand tall
The Next Craft is calling all

[Bridge — the station]
[half-time, vocoder pads, single kick]
Railly built the station floor
Shiara draws it, Emmy roars
Anthony is shipping fast
Liz will make the twelve hours last
Cristian moves the data through
Nicolas and Gabriel too
Two Ignacios on the line
Carlos, Edward, Juan design
Henry calling from Beijing —
Crafter Station, everything

[Final Chorus]
[key change up a tone, full brass, double-time hats]
Craft the night, we're taking flight
Craft the night, the build is right
(Yeah, yeah)
[orchestral hit]
Feel the power, feel the flame
The Next Craft is just the name
(Craft the night!)
The Next Craft is just the name

[Outro]
[synth brass melody repeats]
[filter sweep on drums]
Twelve hours... and we go again
[final orchestral hit]

---

## Notes

- **Cities.** Lima, Bogotá, Guatemala, Arequipa and El Salvador are the five
  in-person venues. "San Salvador" is sung instead of "El Salvador" purely for
  the syllable count; swap it back if you would rather name the country.
- **Two Ignacios.** Velasquez and Rueda. The line is deliberate, not a slip.
- **The sponsor chant** is the section to cut first if the track runs long — it
  is written as a self-contained 10-line block so it can be dropped whole.
- **Rhythm.** Lines sit at 7–9 syllables so they land inside one bar at 160 BPM.
  Anything longer starts to crowd the brass stabs.

## Using it as the menu theme

Drop the finished file at `public/music/theme.mp3` and change `MENU_THEME_URL`
in `src/app/page.tsx`. Everything else — caching, the volume slider, the
start-on-first-gesture handling — already works off that one constant.
