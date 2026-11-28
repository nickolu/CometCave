---
name: picture-telephone
description: Working on Picture Telephone (src/app/picture-telephone, src/lib/picture-telephone) — the pass-the-device drawing-and-describing game at /picture-telephone, played with friends or with AI players. Load before changing the game model (reducer, rotation, settings), the provider boundary, the mock provider, the screens, or, in later PRs, the image/describe/starter routes, moderation and the share image. Covers who owns the game, the chain shape, and the invariants that keep it safe and cheap.
---

# Picture Telephone

A sentence becomes a picture, the next player describes the picture, and so on. At the end the whole chain is revealed. Seats can be people or AI players, 2 to 8 seats with at least one person.

## Whose game this is

Howl owns this game. Nick is the creative director: when a change is a design decision rather than a repair, offer him real options in plain language, each with what it changes and what it costs. Seat counts, chain length, personas, and the N+1 sentence rule are first guesses and meant to be tuned.

## Where things live

- `src/lib/picture-telephone/` is pure and tested with vitest: `reducer.ts` (the state machine), `rotation.ts` (steps and hand-offs), `settings.ts`, `personalities.ts`, `starters.ts`, `provider.ts` (the interface the UI talks to), `mock.ts` (placeholder provider).
- `src/app/picture-telephone/` is the UI: `store.ts` runs the jobs the reducer asks for; `components/` holds one file per phase.

## Chain shape

A game with N pictures has N+1 sentences: `s0, img0, s1, img1, ... s(N-1), img(N-1), sN`. Each image is drawn from the sentence before it; each later sentence is written about the image before it. Seats wrap round, so a seat may write more than once. To change this, change `buildSteps` only.

## Invariants

- A player only ever sees the picture just before their turn. The hand-off screen shows a name and nothing else.
- Mock pictures must never render the player's sentence, or the next player can read it.
- Image count N drives cost. Do not add model calls per turn without saying so in the PR.
- Safety code (moderation, blocklist, persona prompts, the prompt wrapper) lives on the server in `safety/` (later PR) and is fail-closed: a moderation error is never treated as "safe". Never ship persona prompts or the blocklist to the client.
- The game is in memory only. A reload ends it, on purpose.
- Layout is immersive (no `GameShell`): the game carries its own "Return to the cave" link, which asks first mid-game.
