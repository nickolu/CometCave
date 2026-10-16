/* ---------------------------------------------------------------------------
   Hum — knobs and lessons

   Each lesson unlocks knobs and sets one or two goals the app checks by
   itself. The goal is what makes it a lesson rather than a tooltip: the
   player has to *do* the idea (docs/hum-design.md §3).

   Goals read patch values, never audio analysis — cheap, deterministic, and
   impossible to pass by accident through a glitch in the signal.
   -------------------------------------------------------------------------- */

import { BEAT_DIVISIONS, type Patch } from './patch'

export type KnobId = keyof Patch

export type KnobGroup = 'tone' | 'filter' | 'envelope' | 'wobble' | 'effects'

export interface KnobInfo {
  label: string
  group: KnobGroup
  /** One plain sentence: what turning this does. */
  hint: string
}

export const KNOBS: Record<KnobId, KnobInfo> = {
  volume: {
    label: 'Volume',
    group: 'tone',
    hint: 'How tall the wave is. Taller pushes the air harder, which is louder.',
  },
  pitch: {
    label: 'Pitch',
    group: 'tone',
    hint: 'How many waves fit in a second. More waves, higher note.',
  },
  wave: {
    label: 'Shape',
    group: 'tone',
    hint: 'The shape of one wave. Sharper corners hide more high tones.',
  },
  osc2: {
    label: 'Second tone',
    group: 'tone',
    hint: 'Adds a second copy of the wave on top of the first.',
  },
  detune: {
    label: 'Detune',
    group: 'tone',
    hint: 'Pulls the second tone slightly out of tune with the first.',
  },
  noise: {
    label: 'Noise',
    group: 'tone',
    hint: 'Fades from a clean tone to hiss: every pitch at once, at random.',
  },
  pitchDrop: {
    label: 'Pitch drop',
    group: 'tone',
    hint: 'Starts each note higher and slides it down fast. This is the thump in a kick drum.',
  },
  cutoff: {
    label: 'Cutoff',
    group: 'filter',
    hint: 'Removes the high tones above this point. Lower is more muffled.',
  },
  resonance: {
    label: 'Resonance',
    group: 'filter',
    hint: 'Boosts the tones right at the cutoff, giving it a whistle.',
  },
  attack: { label: 'Attack', group: 'envelope', hint: 'How long a note takes to get loud.' },
  decay: {
    label: 'Decay',
    group: 'envelope',
    hint: 'How long it takes to fall back after the first hit.',
  },
  sustain: {
    label: 'Sustain',
    group: 'envelope',
    hint: 'How loud it stays while you keep holding.',
  },
  release: {
    label: 'Release',
    group: 'envelope',
    hint: 'How long it takes to fade after you let go.',
  },
  lfoRate: {
    label: 'Wobble speed',
    group: 'wobble',
    hint: 'How fast the wobble swings back and forth.',
  },
  lfoDepth: { label: 'Wobble amount', group: 'wobble', hint: 'How far the wobble swings.' },
  lfoTarget: {
    label: 'Wobble what',
    group: 'wobble',
    hint: 'Which knob the wobble moves for you: pitch, volume or the filter.',
  },
  drive: {
    label: 'Drive',
    group: 'effects',
    hint: 'Pushes the wave past the edge so its tops get cut flat.',
  },
  delayTime: {
    label: 'Echo time',
    group: 'effects',
    hint: 'How long until the sound plays again.',
  },
  delayFeedback: {
    label: 'Echo repeats',
    group: 'effects',
    hint: 'How much of each echo gets echoed again.',
  },
  delayMix: {
    label: 'Echo amount',
    group: 'effects',
    hint: 'How loud the echoes are next to the original.',
  },
}

export const GROUP_LABEL: Record<KnobGroup, string> = {
  tone: 'Tone',
  filter: 'Filter',
  envelope: 'Envelope',
  wobble: 'Wobble',
  effects: 'Effects',
}

export const ALL_KNOBS = Object.keys(KNOBS) as KnobId[]

export interface GoalContext {
  patch: Patch
  /** The patch as it was when the lesson began (after its setup). */
  start: Patch
  playing: boolean
  bpm: number
  /** Scratch space a goal can use to remember things between checks. */
  memo: Record<string, number>
}

export interface Goal {
  text: string
  check: (ctx: GoalContext) => boolean
}

export interface Lesson {
  id: string
  title: string
  unlocks: KnobId[]
  /** Values the lesson starts from, so its goal is always reachable. */
  setup: Partial<Patch>
  view: 'close' | 'wide'
  intro: string
  goals: Goal[]
  /** Shown once the goals are met — the idea, said plainly. */
  takeaway: string
}

const near = (a: number, b: number, tolerance: number) => Math.abs(a - b) / b <= tolerance

export const LESSONS: Lesson[] = [
  {
    id: 'silence',
    title: 'Silence',
    unlocks: ['volume'],
    setup: { volume: 0, pitch: 220, wave: 'sine' },
    view: 'close',
    intro:
      'That flat line is silence. Sound is air being pushed back and forth, and this screen draws the push. Right now nothing is pushing.',
    goals: [
      {
        text: 'Hold Play and turn Volume up until the line moves.',
        check: ({ patch, playing, memo }) => {
          if (!(playing && patch.volume >= 0.05)) return false
          memo.base = Math.min(patch.volume, 0.45)
          return true
        },
      },
      {
        text: 'Now make the wave twice as tall.',
        check: ({ patch, playing, memo }) =>
          playing && patch.volume >= 2 * (memo.base ?? 0.25) - 0.01,
      },
    ],
    takeaway:
      'The height of the wave is how hard the air is pushed, and your ears hear that as loudness. Doubling the height adds about 6 decibels, the unit sound engineers measure loudness in.',
  },
  {
    id: 'pitch',
    title: 'High and low',
    unlocks: ['pitch'],
    setup: { pitch: 220 },
    view: 'close',
    intro:
      'Each bump on the line is one push of air. Pitch is how many pushes happen every second, counted in hertz (Hz). Watch the bumps as you turn it.',
    goals: [
      {
        text: 'Double the pitch, from 220 Hz to 440 Hz. The waves will squeeze together.',
        check: ({ patch, start }) => patch.pitch >= start.pitch * 2 * 0.97,
      },
      {
        text: 'Now go below where you started: down to 110 Hz.',
        check: ({ patch, start }) => patch.pitch <= (start.pitch / 2) * 1.03,
      },
    ],
    takeaway:
      'Twice as many waves per second sounds like the same note, only higher. That jump is called an octave, and it is why 110, 220 and 440 Hz are all called A.',
  },
  {
    id: 'shape',
    title: 'Shape',
    unlocks: ['wave'],
    setup: { wave: 'sine', pitch: 165 },
    view: 'close',
    intro:
      'So far every wave has been smooth. Same pitch, same height, but a different shape makes a different sound. This is why a flute and a trumpet playing the same note still sound different.',
    goals: [
      {
        text: 'Try all four shapes.',
        check: ({ patch, start, memo }) => {
          // The shape it started on counts as tried.
          memo[`seen_${start.wave}`] = 1
          memo[`seen_${patch.wave}`] = 1
          return ['sine', 'triangle', 'square', 'sawtooth'].every(w => memo[`seen_${w}`])
        },
      },
      {
        text: 'Leave it on the buzziest one.',
        check: ({ patch }) => patch.wave === 'sawtooth' || patch.wave === 'square',
      },
    ],
    takeaway:
      'Sharp corners are made of extra, higher tones stacked on top of the main one, called harmonics. A sine has none, which is why it sounds pure. The saw, with its sharp tooth shape, has every harmonic, which is why it buzzes most.',
  },
  {
    id: 'filter',
    title: 'Bright and muffled',
    unlocks: ['cutoff'],
    setup: { wave: 'sawtooth', pitch: 110, cutoff: 12000 },
    view: 'close',
    intro:
      "A filter removes tones. This one lets low tones through and removes the high ones above the Cutoff. Since the saw's sharp corners are made of high tones, watch what happens to them.",
    goals: [
      {
        text: 'Turn Cutoff down until the saw wave goes round and smooth.',
        check: ({ patch }) => patch.cutoff <= patch.pitch * 2.2,
      },
    ],
    takeaway:
      'Remove the high harmonics and the corners round off, until the saw is almost a sine again. This is the "muffled through a wall" sound, and turning Cutoff is one of the most-used moves in electronic music.',
  },
  {
    id: 'resonance',
    title: 'The wah',
    unlocks: ['resonance'],
    setup: { wave: 'sawtooth', pitch: 110, cutoff: 1200, resonance: 0.7 },
    view: 'close',
    intro:
      'Resonance makes the filter boost the tones right at the Cutoff instead of only removing the ones above it. Turn it up, then move Cutoff and listen to the whistle travel.',
    goals: [
      { text: 'Turn Resonance up past 8.', check: ({ patch }) => patch.resonance >= 8 },
      {
        text: 'Keep it high and sweep Cutoff from low to high.',
        check: ({ patch, memo }) => {
          if (patch.resonance < 8) return false
          memo.lo = Math.min(memo.lo ?? patch.cutoff, patch.cutoff)
          memo.hi = Math.max(memo.hi ?? patch.cutoff, patch.cutoff)
          return memo.hi / memo.lo >= 4
        },
      },
    ],
    takeaway:
      'That moving whistle is the "wah" sound. Guitarists do it with a foot pedal, and acid house is built on it. On the screen, the boosted tone shows up as a small ripple riding on the wave.',
  },
  {
    id: 'start-stop',
    title: 'Start and stop',
    unlocks: ['attack', 'release'],
    setup: { attack: 0.005, decay: 0.3, sustain: 1, release: 0.05, cutoff: 3000, resonance: 2 },
    view: 'wide',
    intro:
      'The screen is zoomed out now. It shows the last second, so each note you play draws its outline. Attack is how long a note takes to get loud. Release is how long it takes to fade after you let go.',
    goals: [
      {
        text: 'Make a slow swell: turn Attack past 1 second, then hold Play and watch the note rise.',
        check: ({ patch, playing }) => playing && patch.attack >= 1,
      },
      {
        text: 'Make a long fade: turn Release past 1 second, then let go of Play and watch the note fade out.',
        check: ({ patch, playing, memo }) => {
          if (playing && patch.release >= 1) memo.held = 1
          return !playing && patch.release >= 1 && memo.held === 1
        },
      },
    ],
    takeaway:
      'The outline a note draws is called its envelope. Attack shapes the front of it and Release shapes the tail. Slow attacks are how violins and soft synth pads swell in. A drum has almost no attack at all.',
  },
  {
    id: 'hold',
    title: 'The middle of a note',
    unlocks: ['decay', 'sustain'],
    setup: { attack: 0.005, decay: 0.3, sustain: 1, release: 0.2 },
    view: 'wide',
    intro:
      'Attack and Release shape the start and the end. These two shape the middle, while you hold the note down. Sustain is how loud the note stays while held. Decay is how quickly it falls to that level after the first hit.',
    goals: [
      {
        text: 'Make a pluck: turn Sustain all the way down, so the note fades away even while you hold Play.',
        check: ({ patch, playing }) =>
          playing && patch.attack <= 0.02 && patch.sustain <= 0.1 && patch.decay <= 0.8,
      },
      {
        text: 'Make a piano-like note: it hits hard, then falls back to about half and holds there.',
        check: ({ patch, playing }) =>
          playing &&
          patch.attack <= 0.05 &&
          patch.sustain >= 0.3 &&
          patch.sustain <= 0.7 &&
          patch.decay >= 0.1,
      },
    ],
    takeaway:
      'Attack, decay, sustain and release, ADSR for short, are how a sound starts, falls back, holds and fades. Now that your sound has a start and an end, it can go in a beat. It will be waiting there when you reach the Studio.',
  },
  {
    id: 'two-voices',
    title: 'Two voices',
    unlocks: ['osc2', 'detune'],
    setup: {
      osc2: 0,
      detune: 0,
      attack: 0.005,
      sustain: 1,
      decay: 0.3,
      release: 0.1,
      cutoff: 4000,
      resonance: 1,
    },
    view: 'close',
    intro:
      'Add a second copy of your wave. While both are perfectly in tune, they line up and simply add together. Then pull the second one slightly out of tune.',
    goals: [
      { text: 'Turn the Second tone up past half.', check: ({ patch }) => patch.osc2 >= 0.5 },
      {
        text: 'Add a little Detune until the wave slowly rolls and changes shape.',
        check: ({ patch }) => patch.osc2 >= 0.5 && patch.detune >= 3 && patch.detune <= 25,
      },
    ],
    takeaway:
      "Two tones that are almost the same pitch drift in and out of step. When they line up they add, and when they don't they cancel. That slow roll is called beating, and stacking slightly detuned tones is how synths sound wide and fat.",
  },
  {
    id: 'wobble',
    title: 'Wobble',
    unlocks: ['lfoRate', 'lfoDepth', 'lfoTarget'],
    setup: { lfoDepth: 0, lfoRate: 5, lfoTarget: 'pitch' },
    view: 'close',
    intro:
      'This is a knob that turns itself, slowly and over and over. It is called an LFO, short for low-frequency oscillator: a wave too slow to hear, used to move something you can hear. You choose what it moves.',
    goals: [
      {
        text: 'Make vibrato: wobble the pitch, about 4 to 8 times a second.',
        check: ({ patch }) =>
          patch.lfoTarget === 'pitch' &&
          patch.lfoDepth >= 0.15 &&
          patch.lfoRate >= 3.5 &&
          patch.lfoRate <= 8.5,
      },
      {
        text: 'Make tremolo: wobble the volume instead.',
        check: ({ patch }) => patch.lfoTarget === 'volume' && patch.lfoDepth >= 0.4,
      },
    ],
    takeaway:
      'Singers make vibrato by wobbling their pitch, and old guitar amps had a tremolo switch. Point the wobble at the filter and you get the "wub" in dubstep.',
  },
  {
    id: 'drums',
    title: 'Drums are just sounds',
    unlocks: ['noise', 'pitchDrop'],
    setup: {
      noise: 0,
      pitchDrop: 0,
      osc2: 0,
      lfoDepth: 0,
      wave: 'sine',
      attack: 0.002,
      sustain: 0,
      decay: 0.3,
      release: 0.1,
      cutoff: 12000,
      resonance: 0.7,
    },
    view: 'wide',
    intro:
      "Noise is every pitch at once, at random, and on the screen it draws a jagged mess. The drums in the Studio's beat-maker are built from the knobs you already have, plus these two. Try building two of them yourself.",
    goals: [
      {
        text: 'Build a hi-hat: Noise all the way up, Cutoff above 5 kHz, Decay under 150 ms, and Sustain at 0%.',
        check: ({ patch }) =>
          patch.noise >= 0.9 &&
          patch.cutoff >= 5000 &&
          patch.decay <= 0.15 &&
          patch.sustain <= 0.05,
      },
      {
        text: 'Build a kick: a sine with Pitch under 90 Hz, Noise all the way down, Sustain at 0%, and Pitch drop at 4.5× or more.',
        check: ({ patch }) =>
          patch.noise <= 0.1 &&
          patch.pitch <= 90 &&
          patch.pitchDrop >= 0.5 &&
          patch.sustain <= 0.1 &&
          (patch.wave === 'sine' || patch.wave === 'triangle'),
      },
    ],
    takeaway:
      'A drum is mostly a short envelope. The kick is a low tone that starts high and drops fast, which is the thump. The snare is a tone plus noise. In the Studio, the drums on the beat-maker are built exactly this way, and you can open and change them like any other sound.',
  },
  {
    id: 'crunch',
    title: 'Crunch',
    unlocks: ['drive'],
    setup: {
      drive: 0,
      noise: 0,
      pitchDrop: 0,
      wave: 'sine',
      pitch: 110,
      sustain: 1,
      attack: 0.005,
      release: 0.1,
      cutoff: 12000,
      resonance: 0.7,
      lfoDepth: 0,
    },
    view: 'close',
    intro:
      'Every speaker has a limit on how far it can push. Drive pushes the wave harder than the limit allows. Watch the tops of the wave.',
    goals: [
      {
        text: 'Turn up Drive until the tops of the wave are cut flat.',
        check: ({ patch, playing }) => playing && patch.drive >= 0.6,
      },
    ],
    takeaway:
      'The flattened tops are called clipping, and they add sharp corners. As you saw with the shapes, sharp corners mean extra harmonics, which is why distortion makes even a pure sine buzz. A sine with heavy drive looks almost like a square.',
  },
  {
    id: 'echo',
    title: 'Echo',
    unlocks: ['delayTime', 'delayFeedback', 'delayMix'],
    setup: {
      delayMix: 0,
      delayTime: 0.3,
      delayFeedback: 0.4,
      drive: 0,
      attack: 0.003,
      decay: 0.2,
      sustain: 0,
      release: 0.1,
    },
    view: 'wide',
    intro:
      'An echo plays your sound again a moment later. Each echo can be echoed again, quieter each time. In the wide view you can see the copies line up behind the original.',
    goals: [
      {
        text: 'Turn up the Echo amount and play a note.',
        check: ({ patch, playing }) => playing && patch.delayMix >= 0.25,
      },
      {
        text: 'Set Echo time so the echoes land in time with a beat. The readout tells you when it locks.',
        check: ({ patch, bpm }) =>
          patch.delayMix >= 0.25 &&
          BEAT_DIVISIONS.some(d => near(patch.delayTime, (60 / bpm) * d.beats, 0.04)),
      },
    ],
    takeaway:
      'An echo that matches the tempo becomes part of the rhythm. That is the whole idea behind dub reggae. You now know every knob. Welcome to the Studio.',
  },
]

/** The lesson after which the player's own sound joins the beat grid. */
export const GRID_UNLOCK_LESSON = LESSONS.findIndex(l => l.id === 'hold')

/** Knobs unlocked once `completed` lessons are done, plus the knobs of the
 *  lesson in progress (you can't do a lesson without its knob). */
export function unlockedKnobs(completed: number): Set<KnobId> {
  if (completed >= LESSONS.length) return new Set(ALL_KNOBS)
  const set = new Set<KnobId>()
  for (let i = 0; i <= completed && i < LESSONS.length; i++) {
    for (const k of LESSONS[i].unlocks) set.add(k)
  }
  return set
}
