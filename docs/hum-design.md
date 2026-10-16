# Hum — Design

A sound toy at `/hum` that teaches how sound works by letting you build it. A
big round screen shows the sound as a line. Silence is a flat line. Each knob
you turn changes the line and the sound together, so you see what you hear.
The sounds you make go into a small beat-maker underneath.

*Hum* is a working name.

Status: **phase 1 built.** This document is the spec and tracks the code. Where
the build changed a decision, it is updated here and marked *(build)*.

---

## 1. The three decisions

These were chosen on purpose. Undoing any of them changes what the app is.

1. **Knobs unlock as you go.** You start with one knob and a flat line. Each
   short lesson adds a knob and explains it. The full instrument is the reward
   for learning it. A "skip to the full studio" button exists for people who
   already know synths, but it is never the default.
2. **Every sound is built from scratch.** No microphone and no samples. Every
   sound starts as one pure tone, so any change on the screen comes from a
   knob the player turned. A recorded sound draws a messy line that teaches
   nothing.
3. **The beat-maker lives in the app.** You make music without leaving the
   page, and a beat shares as a link that plays for whoever opens it.
   Downloading audio files is a possible later addition (§8), not part of
   phase 1.

---

## 2. The screen

```
            ┌──────────────────────────┐
            │      ╭────────────╮      │
            │    ╭╯   ∿∿∿∿∿∿∿∿   ╰╮    │   ← the scope: a big circle,
            │    ╰╮              ╭╯    │     the sound drawn across it
            │      ╰────────────╯      │
            │                          │
            │   ◯ Volume   ◯ Pitch     │   ← knobs (only the unlocked ones)
            │   ⌁ Shape                │
            │                          │
            │  "Turn Pitch up. Watch   │   ← the lesson card
            │   the waves squeeze."    │
            ├──────────────────────────┤
            │ ▢▣▢▢ ▣▢▢▢ ▢▣▢▢ ▣▢▢▢  ▶   │   ← beat grid (16 steps)
            └──────────────────────────┘
```

### 2.1 The scope

- A circle the size of the viewport's short side, minus the gutters. It looks
  like a glowing glass dial, the instrument's one big piece of craft
  (Principle 7).
- The trace runs edge to edge across the middle. At rest it is flat.
- It draws the real signal from a Web Audio `AnalyserNode` every frame. The
  trace is **triggered**: each frame starts where the wave crosses zero going
  up, so a steady tone holds still on screen instead of sliding. Without
  this, nothing can be read off the line.
- **Two zoom levels**, switched with one toggle:
  - **Close**: a few cycles of the wave. Shows shape, pitch and filter.
  - **Wide**: one second of loudness over time *(build: was two, which
    squeezed every note into a featureless bar)*. Shows how a note
    starts and fades (§3, lessons 6–7) and how a beat repeats.
- Reduced motion: the trace still draws, because it carries the information.
  The glow, afterimage trails and idle shimmer are turned off.

### 2.2 Knobs

- You drag up and down to turn a knob (drag direction works on mouse and
  touch). Arrow keys nudge it, Shift with an arrow makes a big jump, and
  double-click or double-tap resets it.
- Every knob is a real `role="slider"` with a label and a spoken value
  ("Pitch, 440 hertz, the A above middle C").
- The value is always printed under the knob in plain units and plain words:
  "220 Hz · low", "Cutoff 800 Hz · muffled".
- A knob appears with a small unlock moment the first time. That flourish
  belongs inside the game, not the shell (Principle 2).

### 2.3 The play key

Nothing sounds until the player presses and holds the **Play** button, or
holds the space bar. Release stops the note. This makes the start and end of
a note something the player controls and sees, which lessons 6–7 depend on. A
**Hold** toggle keeps the tone running so both hands are free for knobs.

---

## 3. The lessons

Each lesson is one screen: two or three sentences, one new knob, and one or
two **goals** the app checks by itself ("Make the wave twice as tight").
Meeting a goal finishes the lesson. The goal is what makes this a lesson
instead of a tooltip: the player has to *do* the idea, not just read it.

| # | Lesson | Knob it unlocks | Goal the app checks | The idea |
|---|---|---|---|---|
| 1 | Silence | **Volume** | Make the line move, then make it twice as tall | Sound is air pushed back and forth. The height of the wave is how hard it pushes, and that is loudness. |
| 2 | High and low | **Pitch** | Double the pitch | Pitch is how many waves fit in a second, counted in hertz. Twice as many is the same note, one octave up. |
| 3 | Shape | **Shape** (sine, triangle, square, saw) | Find the buzziest shape | Same pitch, different shape, different sound. Sharp corners hide extra high tones inside the wave, called harmonics. |
| 4 | Bright and muffled | **Filter cutoff** | Turn a saw wave into something close to a sine | A filter removes high tones. On the scope, the sharp corners round off. |
| 5 | The wah | **Resonance** | Sweep the cutoff with resonance high | Resonance boosts the tones right at the cutoff. Sweeping it is the "wah" sound. |
| 6 | Start and stop | **Attack, Release** | Make a slow swell, then a long fade after letting go | A note's loudness changes over time. In the wide view, the envelope is the outline of the note. |
| 7 | The middle of a note | **Decay, Sustain** | Make a pluck, then a piano-like note that falls back to half and holds | What happens while the note is held. Together the four are ADSR. |
| 8 | Two voices | **Second tone + Detune** | Detune until the wave slowly rolls | Two tones that are almost the same pitch go in and out of step. That roll is called beating, and it makes sounds fat. |
| 9 | Wobble | **LFO** (speed, depth, target) | Make vibrato, then tremolo | An LFO is a knob that turns itself, slowly and over and over. Point it at pitch for vibrato, at volume for tremolo, or at the filter for wah. |
| 10 | Drums are just sounds | **Noise + Pitch drop** | Build a hi-hat, then a kick | Noise is every tone at once and draws as a jagged random line. A hat is noise with a short envelope; a kick is a low tone whose pitch drops fast. |
| 11 | Crunch | **Drive** | Clip the wave until its tops go flat | Push a wave harder than it can go and its tops get cut off. Those flat tops are what distortion sounds like. |
| 12 | Echo | **Delay** (time, feedback) | Make an echo that repeats in time with the beat | A delay plays the sound again a moment later. In the wide view, you see the copies repeat. |

Notes:

- *(build)* The envelope was first one lesson unlocking four knobs at once,
  and in play that was overwhelming: every other lesson adds one or two. It
  is now two lessons — the ends of a note (attack, release), then the middle
  (decay, sustain) — and there are 12 lessons, not 11.
- ~~**The beat grid is present from the first visit**~~ *(build, Nick's
  call)*: **the beat-maker appears in the Studio** — after the 12 lessons, or
  on skipping them — and always for a shared beat. During lessons it was one
  more thing on screen competing with the lesson. The lesson sound still
  joins the beat when lesson 7 is done, so it is waiting there in the Studio.
  The beat section collapses to its header (Play stays reachable), and the
  collapsed state is remembered per browser.
- Lesson 9 is when the drums stop being mysterious: the starter drums turn
  out to be built from the same knobs, and the player can open and edit them.
  *(build)* A kick needs its pitch to fall, which no earlier knob could do, so
  lesson 9 also unlocks **Pitch drop**. Without it the "drums are made of the
  same knobs" claim would have been false for the kick.
- *(build)* Finishing lesson 7 puts the lesson sound into the beat as its own
  row, so the takeaway's promise is literally kept. Rows hold a copy of a
  sound; "Knobs" on a row puts that row's sound on the knobs.
- Each lesson takes about two minutes. That is short enough to do one a day,
  and one a day is the return hook (Principle 3, §6).
- Goal checks use the patch values (pitch ≥ 2× its starting value, and so on),
  not audio analysis. That is cheap and has no false positives.
- After lesson 12, the app becomes the **Studio**: every knob, no lesson
  card, and a lesson index for review.

---

## 4. The beat-maker

- **16 steps × up to 11 rows**, one bar in 4/4, looping. Tempo is 60–180 BPM
  and defaults to 100.
- Rows: kick, snare and hat (the starter drums), plus up to **eight** of the
  player's own sounds *(build: was three)*. A sound row can be renamed by
  tapping its name, and a newly added row opens straight into its name.
- **Clear all** empties every step and keeps the rows and their sounds. One
  undo is kept, since a mis-tap would wipe real work.
- For a row of the player's sound, each step can also carry a **pitch** (a
  note in a C minor pentatonic scale, so nothing sounds wrong). That turns a
  sound into a melody or bassline without needing any music theory.
- The scope shows the whole mix while the beat plays.
- Timing uses the standard look-ahead scheduler (`setTimeout` loop scheduling
  notes slightly ahead on the `AudioContext` clock). Timing from
  `setInterval` alone drifts noticeably.

---

## 5. Sharing and saving

- **A sound or a beat is fully described by a small set of numbers,** called
  the patch and the pattern. The whole thing compresses into the share link
  itself (`/hum#b=…`), so phase 1 needs no server or database.
- **Opening a shared link plays it right away** after one tap (browsers
  require a tap before sound). The recipient sees every knob the sender used,
  even ones they haven't unlocked, with a line under it: "Learn how this
  was made →" goes to lesson 1. The share rate feeds the lesson funnel.
- Progress (lessons done) and up to 12 saved sounds live in `localStorage`
  for anonymous players.
- **Sign-up CTA** appears after the first beat is shared, or after lesson 7.
  The pitch is "Keep your sounds and progress on every device." It never
  appears before lesson 1 is done (Principle 1). Syncing saved sounds to the
  account is phase 2.
  *(build)* **Not shipped in phase 1.** Signing in would not yet keep
  anything, so the prompt would promise depth that doesn't exist. It ships
  with account sync.

---

## 6. The shared pact and principles

- Uses `GameShell` for the exit, mute and share button
  (Principle 6). **Mute** stops all output and the scope keeps drawing, so
  the visuals still teach on a silent device.
- **Sound is the point of this app,** and that is a deliberate exception to
  "silent device as baseline" (Principle 8). The mitigation is that every
  idea is also taught visually through the scope and in text, so a muted
  player can still learn everything, just not hear it.
- **Volume safety:** a limiter (`DynamicsCompressorNode`) is the last thing
  before the speakers, and master output is capped. Resonance and feedback
  can't run away into a painful squeal. This is an all-ages app and
  headphones exist.
- **Chrome copy is plain** (Principle 4). Lesson copy is the game's voice:
  warm, curious, a little cosmic, never jargon without the plain word next
  to it.
- ~~**Streak:** lessons done in a row, one per day.~~ *(build, Nick's call)*
  **No streak.** A deliberate exception to the shared pact's streak/score
  display (Principle 6). Hum is an open-ended tool, like Avatar Maker: there
  is no daily session to count, and once the lessons are done a streak would
  only measure how often you shared. The return hook is the next lesson,
  then the Studio; the daily "Match the sound" puzzle (§8) is the natural
  place to bring a streak back.

**Metrics (Principle 9):** daily return rate, through one lesson a day; share
rate, through beat links that play instantly; and session length, through
the Studio.

---

## 7. Build notes

- All audio is the Web Audio API, with no libraries. A patch is a plain
  object; `buildVoice(ctx, patch)` wires
  `oscillators → filter → amp(envelope) → drive → delay → master → limiter`.
- One shared `AudioContext`, unlocked on the first tap, same approach as
  `src/app/starmatch/lib/audio.ts`.
- The scope is a `<canvas>` drawn in a `requestAnimationFrame` loop that
  reads `getFloatTimeDomainData`. The wide view keeps a ring buffer of
  loudness readings (RMS per frame).
- Folder: `src/app/hum/` with `lib/` (patch, voice, scheduler, share
  encoding, lessons) kept free of React so it can be unit-tested, and
  `components/` (Scope, Knob, LessonCard, BeatGrid).
- Tests: patch↔link encoding round-trips; every lesson goal can be met from
  the starting patch; scheduler step timing is correct at the tempo extremes.
  *(build)* The lesson test walks a solution through every goal using **only
  that lesson's unlocked knobs**, and checks no lesson starts already passed.
  That test caught a real bug: lesson 3's "try all four shapes" never counted
  the shape it started on.
- Mobile and desktop are both first-class (Principle 8). *(build)* On wide
  screens the knobs split into two columns either side of the scope — the
  lesson card (or Studio card), tone and filter on the left; envelope, wobble
  and effects on the right — so the goals sit next to the scope while you
  turn knobs. On
  narrow screens it all stacks: scope, lesson, knobs. The grid scrolls
  sideways inside its own box, never the page.
- *(build)* **Scope scale.** One voice at full volume reaches 60% of the
  radius, so a full-volume wave is visible across most of the circle's
  width (the circle narrows toward its sides).
- *(build)* **A bug worth remembering.** The safety ceiling (a WaveShaper
  after the limiter) was first built as if its curve spanned inputs ±2. A
  WaveShaper always spans −1..1, so every signal was doubled on its way out
  and anything loud was flattened. It made the scope look twice as zoomed in
  as designed, and made everything louder and slightly distorted at full
  volume. There is now a test that normal levels pass through unchanged.

---

## 8. Phase 1 and later

**Phase 1 (built):** scope (both views), lessons 1–12, Studio, beat grid with
starter drums and up to eight player sounds, share links, local saves.

**Later, in rough order of value:**

1. Download a sound or loop as a `.wav` file, rendered offline with
   `OfflineAudioContext`.
2. A daily **Match the sound** puzzle: hear and see a target, then rebuild it
   with your knobs, scored on how close the patch gets. This is the natural
   daily ritual after the lessons run out.
3. Account sync for saved sounds.
4. A polar scope mode that wraps the wave around the ring.
