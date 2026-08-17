---
name: micro-land-stability
description: Running one iteration of the Micro Land ecosystem-stability experiment loop — measuring whether the grassland meadow survives on its own, forming a hypothesis, A/B testing it against fixed seeds, and recording the result. Load when asked to improve micro-land animal behaviour, breeding, population stability or extinctions; when continuing docs/micro-land-stability-plan.md; or when this is running on a schedule or a loop. Covers the metric that is worth optimising and the four ways a result can be a lie.
---

# Micro Land — the stability loop

## What this is

A repeatable experiment for one question: **does the grassland meadow, seeded
once and left alone, sustain itself?** The plan, the metrics and the running log
live in `docs/micro-land-stability-plan.md`. This document is how to execute one
turn of it.

**Load the `micro-land` skill as well.** That one covers how the simulation works
and what must not break. This one covers only how to measure it. If you are about
to change simulation code rather than a knob, you need both.

## Before anything else

1. Read `docs/micro-land-stability-plan.md`, bottom-up: the **experiment log**
   first, then the work items, then the hypotheses.
2. **The next action is the first row marked `*pending*`.** Do not invent a new
   experiment while an earlier one is unfinished — the rows are in dependency
   order, and a tuning result obtained before the noise floor exists is not a
   result.
3. W1–W8 have landed. `T_ext` prints above the checks, `breedAtScale` is a real
   knob, and the three instruments that were passing for bad reasons have been
   fixed. Anything in an older note claiming otherwise is stale.
4. **`T_ext` is blind today, and no tuning experiment can be judged until W9.**
   Stochastic extinction deletes any species under five members on a 1% roll every
   five seconds; grassland seeds the sunhawk at three, so the top predator is
   erased at a mean of t=500s — before its maturity at 760s — and it was the first
   species out in ten of twelve recorded runs. Both arms of every A/B are
   measuring that dice roll. Do not spend a run on a knob until this is resolved;
   read E3 and E4 in the plan first.

## One iteration

```
read the log  →  pick the pending row  →  run both arms on the same seeds
      →  read the funnel top-down  →  apply the decision rule  →  append a row
```

### 1. Run it

Baseline command, and the only one whose output is comparable to the log:

```
npm run eval:micro-land -- --theme grassland --seconds 1600 --runs 3 --diagnose
```

**Run it in the background.** 1600s × 3 seeds takes upwards of fifteen minutes of
wall clock. Start it, do something else, come back.

The variant arm is the same command plus exactly one `--set knob=value`, or the
same command on a branch with exactly one code change. Never both.

`--seed-start N` shifts which seeds run without changing how many, which is what
makes a _disjoint_ set possible: `--runs 3` against `--runs 3 --seed-start 3` is
six different worlds under one configuration, and the gap between those two
answers is the noise floor.

### 1a. Read `T_ext` — it is the only number that moves

It prints above the checks:

```
T_ext     ≥1600s   median time to first animal extinction · 420s stalker  ≥1600s  980s hopper
```

Median world-second at which the first _seeded animal_ species hit zero, per-run
values after the dot, and the species that went first. A leading `≥` means
censored — nothing died, so the number is a floor rather than a measurement, and
a set of mostly-censored runs means the window is now the binding constraint
rather than the world.

Every check is a guardrail. `T_ext` is the target.

### 2. Read the result in causal order

The checks are listed in the order you would debug them, and **only the first
failure is worth acting on**:

```
run-outlasts-maturity → foraging-feeds-animals → breeding-gate-opens
    → ready-animals-seek-mates → mate-stints-convert
```

`run-outlasts-maturity` is a check about the _experiment_, not the world. If it
is red, every breeding number below it is measuring how much of a creature's
childhood fitted in the window. Believe none of them; raise `--seconds`.

Then `--diagnose` gives the blocker mix — `cooldown` / `underfed` /
`no-headroom` / `too-young`. That is the only thing that says _which clause_ of
`readyToBreed` is shut, and the fixes for `underfed` and `too-young` are opposite.

### 3. Apply the decision rule

Keep the change only when **all three** hold:

- `T_ext` improves by more than the measured noise floor, on the same seeds;
- every guardrail in the plan's table still holds — especially
  `lineages-advance`;
- it survives a re-run on a _different_ seed set.

Otherwise revert. Record it either way: a hypothesis that died is the most
valuable row in the log, because it is the one nobody will otherwise re-test.

### 4. Append to the log

Append only; never edit a past row. Record the **commit and the verbatim
command** for both arms. A row without them cannot be reproduced and is worth
nothing six months from now.

## A fifth way, learned the hard way

**The metric can be measuring something other than the world.** `T_ext` is the
time to the first animal extinction, and if one species is being removed by a
mechanic unrelated to the ecosystem — a coin flip on small populations, in this
case — then it is _always_ the first species out, and `T_ext` reports that
mechanic's timer on both arms of every experiment. E3 moved the entire breeding
funnel and `T_ext` did not notice, because `T_ext` was not looking at breeding.

Before trusting a `T_ext` number, check **which species** went first. The eval
prints it. If it is the same species every time, ask what kills it before asking
what the change did.

## The four ways a result lies

Check these before believing any improvement. Each one makes the world worse
while making the number better.

- **Immortality.** A longer `lifespanScale` means founders outlast the run.
  Nothing bred, nothing died, the check went green. **`lineages-advance` is the
  only guard** — read it on every run, not just when it is red. Median surviving
  species must average generation ≥ 1.5, or the population alive at the end was
  seeded rather than made.
- **Monoculture.** One tough species survives and the rest are gone. Total
  population looks fine. Check species richness at the end.
- **Plants only.** `seedNativePlants` pulls flora back from zero on purpose, so a
  world with no animals left still looks green and still scores well on anything
  counting creatures. Animals have no equivalent and never will (invariant 7).
- **A short run.** Everything survives 300 seconds. See
  `run-outlasts-maturity`.

## What the instruments were lying about, and what fixed it

Three of the nine checks were green in the E0 baseline for reasons that did not
hold. All three are repaired; the shape of the mistakes is worth keeping, because
the next check anyone adds can make any of them again.

- **`foraging-feeds-animals` was a median across species.** It read 43% and
  passed while woolly, stalker and sunhawk sat at `underfed` 93–99%. A food chain
  breaks at one link and a median cannot see one link. It now judges the **worst**
  species against a floor of 0.1 meals/creature-minute and reports the median
  alongside.
- **`lineages-advance` counted `skybloom`.** A flower that flies — `tags:
['plant']`, eats nothing, needs no partner — which produced 428 of the run's 432
  births and held the anti-immortality guard green while the six real animals
  managed four between them. The probe's plant filter was `move.kind === 'root'`
  and is now `isPlantLike`, which fixes every animal-denominated check at once.
- **`mate-stints-convert` read 1.00 off two stints.** It now abstains below five
  stints and prints `~`, which is a third state and **not a pass**.

Two rules fall out of that, and they generalise:

- **A median hides the link that breaks.** If a check reduces across species, ask
  what it would report if exactly one species were dying.
- **"Is it a plant" is `isPlantLike`, never `move.kind === 'root'`.** The two
  agree on every species in the game except the one that mattered.

## Traps specific to this measurement

- **A binary check is not an optimisation target.** `no-animal-extinctions` is
  the right headline and useless for steering: while it fails, both arms report
  "still failing" and you learn nothing. Optimise `T_ext`; read the binary checks
  as guardrails.
- **Piping the eval masks its exit code.** `npm run eval:micro-land … | tail`
  reports `tail`'s status, not the eval's. The harness exits non-zero on failure
  and that is the bit worth having — redirect to a file and read it, or check
  `PIPESTATUS`.
- **`--set` only accepts real `TUNING` knobs.** `breedAt` lives on the blueprint,
  so `--set breedAt=0.5` still exits 2 with `Bad --set`. The knob is
  **`breedAtScale`**, a multiplier over every blueprint's `breedAt` — which
  preserves the roster's deliberate ordering, and exempts the three blueprints at
  `breedAt: 1` that use it to mean "does not breed". `mateRadius`, `mealValue`,
  `breedCost`, `breedCooldown`, `lifespanScale`, `hungerRateScale` and the plant
  knobs are the other live ones.
- **The harness is only mostly deterministic.** Same seed on two branches is a
  fair comparison; a single run is never evidence. Three seeds to smell, five to
  decide.
- **Free experiments exist — do them first.** Some hypotheses are answered by
  re-reading a `--diagnose` output you already have, with no code change and no
  run. H4 in the plan is one. Spending fifteen minutes of compute on a question
  already answered in a file on disk is the commonest waste here.
- **Don't tune past an upstream failure.** Fixing a knob when the priority order
  is the problem makes the world worse _and_ still shows no births.

## Promoting a result

A value proven here becomes a default in `constants.ts` only after it has cleared
the decision rule on 5 seeds **and** been run against `tropical-island`,
`verdant-forest` and `tidepool` — a change that fixes grassland by breaking the
others is not a fix. Update the comment that justifies the old number; in this
codebase that comment is the only record of why it was ever that value.

Adding a check means adding it to `CHECKS` in `harness/evals.ts`, honouring the
three rules in that file's header: one failure reason per check, thresholds are
floors set where behaviour is _unambiguously_ wrong, and nothing asserts on a
single seed.
