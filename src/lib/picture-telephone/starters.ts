/* Kid-safe material for "AI starts". Theme seeds are for a model to build on
   (later PR); the complete sentences are used directly by the mock and as the
   fail-closed fallback when a generated opener is rejected. */

export const STARTER_THEMES: readonly string[] = [
  'a picnic', 'a lighthouse', 'a snowy village', 'a hot air balloon', 'a friendly dragon',
  'a tiny submarine', 'a rainy day', 'a treehouse', 'a robot bakery', 'a space garden',
  'a mountain train', 'a lost umbrella', 'a pirate ship made of cardboard', 'a moonlit pond',
  'a sleepy giant', 'a bicycle race', 'a market full of fruit', 'a kite festival', 'a snow fort',
  'a clockwork owl', 'a library on a hill', 'a talking teapot', 'a beach with a sandcastle',
  'a very tall giraffe', 'a cozy cabin', 'a parade of ducks', 'a magic paintbrush',
  'a cloud factory', 'a campfire', 'a swimming elephant', 'a farm at sunrise', 'a puppet show',
  'a rocket made of pillows', 'a wise old turtle', 'a windmill', 'a juggling octopus',
  'a garden gnome party', 'a rainbow bridge', 'a snowman on a skateboard', 'a night market',
]

export const STARTER_SENTENCES: readonly string[] = [
  'A fox in a yellow raincoat splashes through a puddle.',
  'Two penguins share an umbrella on a sunny beach.',
  'A giraffe peeks over the roof of a small red barn.',
  'A friendly dragon toasts marshmallows over a campfire.',
  'A robot waters the flowers in a tiny backyard garden.',
  'A snail carries a birthday cake up a grassy hill.',
  'Three ducks ride a wooden boat across a calm pond.',
  'A little owl reads a book under a giant mushroom.',
  'An elephant balances on a big blue ball at the circus.',
  'A girl and her dog fly a kite on a windy hill.',
  'A turtle wearing a scarf walks through a snowy forest.',
  'A hot air balloon floats over a patchwork of green fields.',
  'A bear in a chef hat flips pancakes in a cozy kitchen.',
  'A pirate ship sails across a sea of fluffy clouds.',
  'A rabbit rides a bicycle past a row of sunflowers.',
  'A smiling sun peeks out from behind a tall lighthouse.',
  'A cat and a mouse build a sandcastle together.',
  'A small submarine explores a reef full of colorful fish.',
  'A gnome paints a rainbow on the side of a barn.',
  'An octopus juggles six shiny apples on a stage.',
]

/** Deterministic pick (wraps), so a fallback does not need randomness. */
export function starterAt(i: number): string {
  const n = STARTER_SENTENCES.length
  return STARTER_SENTENCES[((i % n) + n) % n]
}

export function randomStarter(rand: () => number = Math.random): string {
  return starterAt(Math.floor(rand() * STARTER_SENTENCES.length))
}
