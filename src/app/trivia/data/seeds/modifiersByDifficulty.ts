// Modifiers, hand-bucketed by how obscure-leaning each one is. Crossed
// with seeds in generateQuestion.ts; the picker draws from the bucket
// matching the requested difficulty so easy questions end up framed
// around iconic / well-known angles ("origin", "most famous") and hard
// questions end up framed around niche angles ("cut content", "exploit",
// "headcanon").
//
// Co-located with seeds/modifiers.ts so a future contributor adding a
// modifier sees both lists side-by-side.

export const MODIFIERS_EASY: string[] = [
  // History & time — beginnings the casual fan knows
  'origin',
  'creation',
  'milestone',
  // Significance & impact — the high-level "why does this matter"
  'impact',
  'significance',
  'legacy',
  'influence',
  'reputation',
  'why it matters',
  'why its famous',
  // Definition & explanation
  'definition',
  'meaning',
  'example',
  // Extremes & firsts — iconic by construction
  'first',
  'most iconic',
  'best known',
  'most famous',
  // People & creation
  'creator',
  'inventor',
  'founder',
]

export const MODIFIERS_MEDIUM: string[] = [
  // History & time — slightly deeper
  'rise',
  'fall',
  'peak',
  'turning_point',
  'evolution',
  'timeline',
  'renaissance',
  'golden_age',
  // Comparison & contrast
  'difference',
  'similarity',
  'contrast',
  'variant',
  'alternative',
  'inspiration',
  'predecessor',
  'successor',
  // Mechanics, systems & design
  'mechanic',
  'rule',
  'system',
  'design',
  'strategy',
  'tactic',
  // Culture, fandom & meta
  'controversy',
  'fan reaction',
  'community',
  'debate',
  'pioneer',
  'vision',
  'original intent',
  // Definition & explanation — slightly trickier
  'common misconception',
  'counterexample',
  // Extremes — beyond plain "most famous"
  'most influential',
  'most controversial',
]

export const MODIFIERS_HARD: string[] = [
  // History & time — declines aren't usually as well-known as rises
  'decline',
  // Definition & explanation — deep cuts
  'little known fact',
  'hidden detail',
  'behind the scenes',
  // Mechanics, systems & design — specialist angles
  'balance',
  'optimization',
  'tradeoff',
  'limitation',
  'constraint',
  // Culture, fandom & meta — fandom-internal
  'meme',
  'trope',
  'cliche',
  'fan theory',
  'headcanon',
  'retcon',
  // Failure, bugs & weirdness — niche by definition
  'bug',
  'glitch',
  'exploit',
  'oversight',
  'design flaw',
  'broken version',
  'backlash',
  'misstep',
  'abandoned idea',
  'cut content',
  // Extremes — superlatives the casual fan can't reliably name
  'last',
  'worst known',
  // Random & unusual
  'random',
  'unusual',
  'odd',
  'rare',
  'unique',
  'obscure',
  'esoteric',
  'uncommon',
  '@#$&(*!)',
  'crazy',
  'weird',
  'strange',
  'unbelievable',
]

export const MODIFIERS_BY_DIFFICULTY: Record<'easy' | 'medium' | 'hard', string[]> = {
  easy: MODIFIERS_EASY,
  medium: MODIFIERS_MEDIUM,
  hard: MODIFIERS_HARD,
}
