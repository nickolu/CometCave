// Modifiers to create context and variation. Crossed with seeds in
// generateQuestion.ts to drive prompt diversity.
export const MODIFIERS: string[] = [
  // History & time
  'origin',
  'creation',
  'rise',
  'fall',
  'peak',
  'decline',
  'renaissance',
  'golden_age',
  'turning_point',
  'milestone',
  'timeline',
  'evolution',

  // Significance & impact
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
  'counterexample',
  'common misconception',
  'little known fact',
  'hidden detail',
  'behind the scenes',

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
  'balance',
  'strategy',
  'tactic',
  'optimization',
  'tradeoff',
  'limitation',
  'constraint',

  // Culture, fandom & meta
  'fan reaction',
  'community',
  'debate',
  'controversy',
  'meme',
  'trope',
  'cliche',
  'fan theory',
  'headcanon',
  'retcon',

  // Failure, bugs & weirdness
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

  // Extremes & firsts
  'first',
  'last',
  'most influential',
  'most controversial',
  'most iconic',
  'best known',
  'worst known',

  // People & creation
  'creator',
  'inventor',
  'founder',
  'pioneer',
  'vision',
  'original intent',

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
