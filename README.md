# Kairos Engine

An interactive 3D time machine through music epochs, from the Baroque courts to the algorithm era and on into four forecast horizons (+1, +5, +10, +50 years).

**Chronos** is the time you travel through. **Kairos** (καιρός) is the Greek word for the opportune moment: the instant when a person's skill, their environment, and what the culture needed converge. Every artist who "made it" stood in that beam once. The engine lets you fly to each moment and see the three forces align.

## What is in it

- **A time drive with physics.** Position in time, temporal velocity (years per second), bounded acceleration, drag that rises with speed, an autopilot that plans a brake point and lands with a damped approach. You cannot stop instantly. Instruments are dressed as relativistic readouts: γ, a signed Doppler shift (blue toward the future, red toward the past) that tints the tunnel and bends the engine pitch, coherence, strain.
- **Fourteen historical epochs, 46 Kairos cases.** Each epoch states what the culture needed and what the environment made possible; each case scores Skill, Environment and Need and explains the convergence in a sentence. Counter-examples included: Bach (lock deferred 79 years), Little Richard (partial lock), Hendrix (moved countries to find the environment).
- **The orrery.** Three rings: Skill accumulates slowly, Environment changes in steps, Need oscillates like a pendulum. Select a case and the beads converge; a full lock fires a beam. A missing term leaves a bead on the far side.
- **The pendulum model.** Each epoch is scored on five bipolar cultural-need axes (artifice↔sincerity, individual↔communal, mind↔body, global↔local, polished↔rough). A sinusoid with a period search is fitted per axis and extrapolated with a widening error cone. The forecasts show the model's vector, its period and next turning point, next to an analyst's written reading of what the culture will need, which environment it will happen in, which skills will be rewarded, and who locks.
- **Procedural music.** Every epoch has a synthesized signature (swing brushes and walking bass, four-on-the-floor disco, gated-snare 1985, boom-bap, half-time 808s, sped-up 2020s pop, probabilistic patterns for the forecasts). No samples; all Web Audio.
- **Everything procedural.** No external assets: primitives, shaders, and a 690 KB single HTML file.

## Run it

```
npm install
npm run build      # writes dist/index.html (standalone) and dist/artifact.html (body fragment)
npx serve dist     # or open dist/index.html directly
```

## Deploy

- **Vercel:** import the repo; `vercel.json` sets the build command and output directory.
- **GitHub Pages:** the workflow in `.github/workflows/pages.yml` builds on push and publishes `dist/` to the `gh-pages` branch. If the site does not appear, enable Pages once under Settings → Pages with `gh-pages` as the branch.
- **Anywhere else:** copy `dist/index.html`. It is self-contained apart from Google Fonts.

## Controls

Drag the view to look. `←` `→` or the throttle to thrust (release to coast), `space` to brake, `enter` to dock at the nearest epoch, `[` `]` to step between epochs, click the timeline to set an autopilot target, mouse wheel for a velocity impulse, `m` sound, `t` theory.

## Caveats, stated in the app too

The archive only contains locks that happened (survivorship). "The culture needed it" is easy to say afterwards (hindsight). The pendulum fit is a toy on fourteen hand-scored points; its error cone covers the whole axis well before 2076, which is the model's own way of saying it does not know.
