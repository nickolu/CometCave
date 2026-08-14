# Dicebound — Design

A dice-and-storytelling game at `/dicebound`. You write one line about who you
are and one line about where your story begins; a dungeon master puts you in a
scene; you say what you attempt; the dice decide whether it works.

Product direction is Nick's. This document records the decisions that are
load-bearing — the ones where doing the obvious thing instead would quietly
break the game.

---

## The loop

1. The DM describes the situation.
2. The player describes what their character attempts.
3. The DM describes the outcome.

Between 2 and 3, the DM either rules that the attempt simply works — trivial or
guaranteed — or calls for a check.

## The dice are not the model's

**The model decides whether a check happens, which attribute and skill it
tests, how hard it is, and what in the scene helps or hurts. Then it stops.
Code rolls the die.**

This is the single most important decision in the game. The DM model is
agreeable, the story is going well, and a 4 is inconvenient — a model asked to
roll its own dice will let the player win, not out of malice but out of
helpfulness. Difficulty and outcome chosen in the same instant by something
that wants the story to go well is not a game.

So the model gets one tool, `roll_check`. It commits to the DC _before_ it
learns the number, and then narrates around a fact it cannot edit. The turn
route is a loop rather than a single call precisely because of this
(`src/app/api/v1/dicebound/turn/route.ts`).

Resolution lives in `src/app/dicebound/domain/dice.ts`, is pure, and is tested
exhaustively.

### The table

Nick's table, verbatim:

| DC  | Label                           | Example                                                                 |
| --- | ------------------------------- | ----------------------------------------------------------------------- |
| 0   | trivial                         | operate an elevator                                                     |
| 5   | easy                            | tie your shoes, catch a ball                                            |
| 10  | medium                          | balance on a wide log; convince an ally to do a favor                   |
| 12  | kinda hard                      | balance on a skinny log; convince an ally to do something dangerous     |
| 15  | hard                            | carry a person over your shoulders; convince a neutral stranger to help |
| 18  | really hard                     | bend an iron bar; convince a neutral stranger to do something dangerous |
| 20  | extremely difficult             | hold up a huge iron door for a moment                                   |
| 25  | impossible for a regular person | lift a giant boulder                                                    |
| 30  | impossible                      | jump to the moon                                                        |

### Outcome bands

`margin = roll + modifiers − DC`. Six bands, so "describe by degree of success"
has something concrete to key off:

| Band             | Condition   |
| ---------------- | ----------- |
| critical success | natural 20  |
| strong success   | margin ≥ 5  |
| success          | margin ≥ 0  |
| near miss        | margin > −5 |
| failure          | margin ≤ −5 |
| critical failure | natural 1   |

Natural 20 and natural 1 beat the arithmetic in both directions. A character
good enough that a 1 still clears the DC should still get the moment where it
all goes wrong; a character who cannot mathematically reach the DC should still
get the moment where it doesn't matter. Those are the rolls people tell stories
about.

### Situational modifiers

The model names them in plain language ("the floor is wet", "you just mentioned
his daughter") and the player sees every one on the die card. Each is clamped to
±4, and the _sum_ is clamped to ±6 — three plausible +3s are how a DC 18
silently becomes a coin flip without anyone deciding it should. When the total
is over, the set is scaled rather than truncated, so every reason the player was
given still appears.

## The character sheet

Eight attributes, chosen once. Forty skills beneath them, **earned**.

A new sheet has no skills at all. The DM calls for Balance, the die rolls, a
counter ticks; at 3 uses Balance appears at +1, at 8 it reaches +2, at 18 it
reaches +3. The sheet grows into a record of what the player actually did.

Two rules make this work:

- **Advancement is on use, not success.** A sheet that only records wins
  punishes the player for attempting the interesting thing. The character who
  keeps falling off the log is learning to balance.
- **The DM cannot grant ranks.** It picks which skill a moment belongs to and
  nothing else. Thresholds live in code and are the same for everyone;
  otherwise a generous model hands out +3s in the first ten minutes.

A skill only adds its rank when it actually sits beneath the attribute being
tested (`applicableSkill`). Engineering must not help you jump a fence, however
the DM labelled it.

### Innate skills

`Size` and `Looks` describe what a character _is_, not what they practise. They
are set at creation from the player's own sentence and never advance. Nobody
trains their way into being large, and pretending otherwise would make every
other earned rank feel arbitrary.

### Creation budget

Attributes range −2..+3 and sum to **4 or less**. Deliberately tight: "a
brilliant, beautiful, unstoppable warrior-genius" should come out _pointy_, not
uniformly great, so the budget forces the model to decide what this person is
not. The model proposes; `normalizeAttributes` enforces, shaving the highest
first so the best thing stays the best thing.

### Departures from the original tree

- `Flirting` → `Rapport` (all-ages baseline, CLAUDE.md).
- Third-tier skills (Academics → Mathematics, Technical → Chemistry) are
  flattened to sit directly under their attribute. A four-level tree gives the
  DM 60 options per check and it picks inconsistently; 40 flat ones it handles
  well.

## Session shape

**Run-loop** (interaction-models.md, "Session shapes"). One campaign at a time,
resumable, autosaved silently on every turn. Streaks count **days visited**, not
runs — a streak that broke because you only played once today would punish the
wrong thing.

There is no threshold screen. A returning player's campaign _is_ the threshold;
making a regular tap "play" to re-enter a story they were mid-way through is
re-onboarding them (CLAUDE.md principle 3).

## Memory

A campaign is its transcript — there is no world model, no map, no inventory
table. The DM reconstructs the situation each turn by reading it.

Past 60 entries, the oldest are compressed into a `synopsis` and dropped
(`condense`). It is asked for _continuity_ rather than summary — names, debts,
promises, wounds, how things stand — because those are what a player notices
going missing, and a synopsis that reads like a plot outline loses exactly them.
This is the only lossy thing in the game.

## The shared pact

| Obligation                      | How                                                                                                                                                                                       |
| ------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Persistent exit                 | The cave shell's nav. This game does not hide the shell, so it adds no duplicate exit (interaction model 2).                                                                              |
| Share                           | Header button. Shares the **most recent roll**, not the game — "Pell needed a 15 and rolled a natural 20" is a story that teaches the rules; "I'm playing Dicebound" is an advertisement. |
| Sign-up CTA                     | Inline in the sheet at a 3-day streak (interaction model 4, trigger 2). Sells depth — the campaign already saves without an account.                                                      |
| Streak / score                  | Header (streak) and sheet ("At the table").                                                                                                                                               |
| Pause / mute                    | Not applicable — no audio, no ambient motion.                                                                                                                                             |
| Body font, primary action color | Shared tokens throughout.                                                                                                                                                                 |

## Storage

One Firestore document per player at `users/{uid}/dicebound/campaign`, held as a
single unindexed JSON string. A campaign is read whole and written whole and
never queried; as nested maps Firestore would index every paragraph of narration
on every write, and narration is exactly the kind of long prose that runs into
the per-index-entry ceiling.

Anonymous players are first-class: `useAuth` mints an anonymous uid on arrival,
so a player who never signs up still has a character that survives closing the
tab, and signing up later links the credential to the same uid.

## Failure behaviour

| Failure                              | Result                                                                                                                                              |
| ------------------------------------ | --------------------------------------------------------------------------------------------------------------------------------------------------- |
| No API key / model error at creation | A playable fallback character. Being told "the cave could not imagine you" and dumped back at an empty field is worse than a slightly generic hero. |
| Safety refusal mid-story             | An in-voice narration that closes the thread and keeps playing. No policy notice, no broken character.                                              |
| Model error mid-turn                 | In-voice error, the player's line is rolled back out of the transcript so they can edit and resend.                                                 |
| Save fails                           | Swallowed. The next turn sends the whole campaign again.                                                                                            |
| Condense fails                       | The turn proceeds on the previous synopsis — reads as a slightly forgetful DM, not an error.                                                        |

## Files

```
src/app/dicebound/
  domain/           attributes, dice, character, campaign, turn — all pure, all tested
  components/       creation, transcript, die-card, composer, sheet, share, sign-in-invite
  store.ts          zustand; the only place turns are sequenced
  backend.ts        account-backed and localStorage persistence behind one interface
  api.ts            the two model calls
src/app/api/v1/dicebound/
  character/        sentence → character sheet
  turn/             the DM loop, where the dice are rolled
  campaign/         GET / PUT / DELETE, own-uid only
src/lib/dicebound/
  anthropic.ts      the one place this game talks to the model
  campaign-store.ts Firestore
```

## Open, deliberately

- **No streaming.** Turns are non-streaming, so a slow turn is a visible wait
  behind "The dungeon master considers…". Streaming through a tool loop is real
  work and worth doing next; it is the biggest felt improvement available.
- **One campaign per player.** No shelf of stories. Starting a new one abandons
  the old.
- **No end-of-session ceremony.** A run-loop game with no run boundary has
  nowhere to put one yet. Chapter breaks would give it somewhere.
- **The name.** `Dicebound` is a placeholder that has now been committed to
  routes, Firestore paths and a lint-checked constant. Renaming is cheap today
  and annoying later.
