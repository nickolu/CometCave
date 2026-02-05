// The eight trigrams of the I-Ching
// Each trigram is represented as [bottom, middle, top] where true = solid, false = broken

export type TrigramName =
  | 'Heaven'
  | 'Earth'
  | 'Thunder'
  | 'Water'
  | 'Mountain'
  | 'Wind'
  | 'Fire'
  | 'Lake'

export interface Trigram {
  name: TrigramName
  chinese: string
  attribute: string
  lines: [boolean, boolean, boolean]
}

export const trigrams: Trigram[] = [
  {
    name: 'Heaven',
    chinese: 'Qian',
    attribute: 'The Creative',
    lines: [true, true, true],
  },
  {
    name: 'Earth',
    chinese: 'Kun',
    attribute: 'The Receptive',
    lines: [false, false, false],
  },
  {
    name: 'Thunder',
    chinese: 'Zhen',
    attribute: 'The Arousing',
    lines: [false, false, true],
  },
  {
    name: 'Water',
    chinese: 'Kan',
    attribute: 'The Abysmal',
    lines: [false, true, false],
  },
  {
    name: 'Mountain',
    chinese: 'Gen',
    attribute: 'Keeping Still',
    lines: [true, false, false],
  },
  {
    name: 'Wind',
    chinese: 'Xun',
    attribute: 'The Gentle',
    lines: [true, true, false],
  },
  {
    name: 'Fire',
    chinese: 'Li',
    attribute: 'The Clinging',
    lines: [true, false, true],
  },
  {
    name: 'Lake',
    chinese: 'Dui',
    attribute: 'The Joyous',
    lines: [false, true, true],
  },
]

export function identifyTrigram(lines: [boolean, boolean, boolean]): Trigram {
  const found = trigrams.find(
    (trigram) =>
      trigram.lines[0] === lines[0] &&
      trigram.lines[1] === lines[1] &&
      trigram.lines[2] === lines[2]
  )
  if (!found) {
    throw new Error(`Unknown trigram: ${lines}`)
  }
  return found
}

export function getHexagramTrigrams(hexagram: boolean[]) {
  // Lower trigram: lines 0-2 (bottom three lines)
  const lowerTrigram = identifyTrigram([hexagram[0], hexagram[1], hexagram[2]])
  // Upper trigram: lines 3-5 (top three lines)
  const upperTrigram = identifyTrigram([hexagram[3], hexagram[4], hexagram[5]])

  return { lowerTrigram, upperTrigram }
}
