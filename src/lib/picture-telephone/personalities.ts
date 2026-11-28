import type { Seat } from './types'

/* AI players. This is display data only (safe to ship to the client). The
   prompts that make each one describe pictures the way it does live on the
   server, keyed by `id`, and arrive in a later PR. */

export interface Personality {
  id: string
  name: string
  emoji: string
  /** One line for the setup screen. */
  blurb: string
  /** Hand-written, G-rated lines used when a model's output is rejected. */
  fallbackLines: readonly string[]
}

export const PERSONALITIES: readonly Personality[] = [
  {
    id: 'literal-lou',
    name: 'Literal Lou',
    emoji: '🧐',
    blurb: 'Counts things and names every object',
    fallbackLines: [
      'Three round things and one square thing sit in a row.',
      'There is a large animal next to two small trees.',
      'A red object is beside a blue object on the ground.',
    ],
  },
  {
    id: 'dramatic-dee',
    name: 'Dramatic Dee',
    emoji: '🎭',
    blurb: 'Makes everything a grand adventure',
    fallbackLines: [
      'A brave little hero leaps over a mountain of marshmallows at sunrise.',
      'The great parade of cheerful animals marches toward a glittering castle.',
      'A very important cat takes a bow on a giant stage.',
    ],
  },
  {
    id: 'easily-distracted-ed',
    name: 'Easily Distracted Ed',
    emoji: '🦋',
    blurb: 'Only notices one tiny detail',
    fallbackLines: [
      'A small butterfly sits on a flower in the corner.',
      'There is a funny little cloud shaped like a sock.',
      'A tiny snail wears the smallest hat in the whole world.',
    ],
  },
  {
    id: 'poet-pat',
    name: 'Poet Pat',
    emoji: '🪶',
    blurb: 'Describes it with flowery words',
    fallbackLines: [
      'Golden light spills over a meadow where the daisies hum softly.',
      'A gentle breeze carries a paper boat across the shining pond.',
      'Sleepy clouds drift above a hill of soft green grass.',
    ],
  },
  {
    id: 'detective-dot',
    name: 'Detective Dot',
    emoji: '🔍',
    blurb: 'Hunts for clues and odd details',
    fallbackLines: [
      'A friendly puppy leaves muddy paw prints beside a plate of cookies.',
      'The clue is a single yellow sock hanging from a tree branch.',
      'Someone left a map and a very large sandwich on the picnic table.',
    ],
  },
  {
    id: 'grumpy-gus',
    name: 'Grumpy Gus',
    emoji: '🦆',
    blurb: 'Unimpressed, but pays attention',
    fallbackLines: [
      'A duck with a tiny umbrella does not look impressed by the rain.',
      'A cat sits in a box and refuses to share it with anyone.',
      'The sun is out again and a sleepy bear is not happy about it.',
    ],
  },
  {
    id: 'hungry-hana',
    name: 'Hungry Hana',
    emoji: '🍙',
    blurb: 'Sees snacks everywhere',
    fallbackLines: [
      'A round yellow moon looks just like a big wheel of cheese.',
      'Those fluffy clouds look like warm pancakes stacked very high.',
      'A smiling picnic basket is full of apples, bread, and jam.',
    ],
  },
]

export function getPersonality(id: string | undefined): Personality {
  return PERSONALITIES.find(p => p.id === id) ?? PERSONALITIES[0]
}

export type SeatMode = 'solo' | 'group'

/** Seat ids are stable per game; "seat-3" is the third seat added. */
export function seatId(n: number): string {
  return `seat-${n}`
}

function aiSeat(n: number, personalityId: string): Seat {
  return { id: seatId(n), kind: 'ai', name: getPersonality(personalityId).name, personalityId }
}

/** Solo = 1 human + 3 AI. Group = 2 humans, with AI players optional. */
export function defaultSeats(mode: SeatMode): Seat[] {
  if (mode === 'solo') {
    return [
      { id: seatId(1), kind: 'human', name: 'Player 1' },
      aiSeat(2, 'literal-lou'),
      aiSeat(3, 'dramatic-dee'),
      aiSeat(4, 'easily-distracted-ed'),
    ]
  }
  return [
    { id: seatId(1), kind: 'human', name: 'Player 1' },
    { id: seatId(2), kind: 'human', name: 'Player 2' },
  ]
}
