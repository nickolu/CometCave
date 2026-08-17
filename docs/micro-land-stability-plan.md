# Micro Land — making the meadow last

## The goal, in one sentence

**Grassland, seeded once and left alone, should sustain itself indefinitely —
populations cycling, nothing going extinct, no player intervention.**

"Meadow" in conversation means the `grassland` theme; there is no theme called
meadow. Grassland is the one to fix first because it is the plainest food chain
in the game, and a fix that only works somewhere exotic has not been understood.

Everything below exists to turn that sentence into numbers that can go up, and
to stop us fooling ourselves about whether they did.

---

## What "stable" must mean, and what it must not

A terrarium that never changes is not the goal and would be worse than what we
have. Boom and bust _is_ the content — invariant 7 is explicit that an animal
which dies out stays out, precisely so that extinction means something. So the
target is a world that **cycles without falling off the bottom**.

That distinction matters because almost every cheap way to make the number go up
is a way of making the world duller. Four of them, named here so that a future
experiment cannot quietly win by one:

- **Immortality.** Crank `lifespanScale` and founders simply outlast the run.
  Nothing bred; nothing died; the check passes.
- **Monoculture.** One tough species survives and the rest are gone. "No
  population collapse" is true and the meadow is a lawn.
- **Sterility with a safety net.** Plants regrow (`seedNativePlants`), so a world
  of nothing but plants can look green forever.
- **A shorter run.** Everything survives 300 seconds.

Each of these has a guardrail below. **A result that improves the primary metric
while tripping a guardrail is a failed experiment, not a trade-off to argue
about.**

---

## Metrics

### Primary — time to first animal extinction (`T_ext`)

> Median across seeds of the world-second at which the first animal species that
> was seeded at t=0 reaches zero. Censored at the run length: a run where nothing
> died reports `≥ seconds`.

Every other candidate was rejected for a reason worth writing down:

- **`no-animal-extinctions` (the existing check) is binary.** It is the right
  headline and a terrible optimisation target. While it fails — which is today —
  every A/B test reports "still failing" on both arms and teaches us nothing.
  Twenty experiments could each halve the problem and the check would not move
  once.
- **Survivor counts** reward monoculture.
- **Total population** rewards whatever breeds fastest.

`T_ext` is continuous, monotone in the direction we want, and defined even when
the world is broken — which is the only reason a long sequence of small
improvements is measurable at all. It is also directly the sentence at the top of
this document: "how long until the meadow breaks?"

**Landed in `9b0f90fe` (W1).** `RunMetrics` records when each species first hit
zero and the eval prints `T_ext` above the checks.

**But read E3 before trusting a number it gives you.** A metric that measures the
time to an event only measures the world if the _world_ causes that event. Today
one species is removed by a mechanic unrelated to the ecosystem, always goes
first, and therefore sets `T_ext` on both arms of every experiment. That is W9,
and it is the blocking item.

### Guardrails — all must hold for a result to count

| Guard             | Metric                                              | Bar                                                |
| ----------------- | --------------------------------------------------- | -------------------------------------------------- |
| Not immortality   | `lineages-advance`                                  | median surviving species averages generation ≥ 1.5 |
| Not monoculture   | animal species alive at end ÷ animal species seeded | ≥ 0.8                                              |
| Not a flatline    | `population-oscillates`                             | low water ≥ 35% of peak                            |
| Not terrain decay | `world-stays-solid`                                 | within 20% of starting solid share                 |
| Not a short run   | `run-outlasts-maturity`                             | run ≥ 2× slowest maturity                          |

`lineages-advance` is the important one. It is the only thing standing between
this project and the immortality cheat, and it should be read on every single
experiment, not just when it fails.

### Diagnostics — where the loss is, not whether there is one

The existing breeding funnel, in its existing causal order. These are not targets;
they are how you decide _what_ to change next.

```
foraging-feeds-animals → breeding-gate-opens → ready-animals-seek-mates → mate-stints-convert
```

Plus the blocker mix (`cooldown` / `underfed` / `no-headroom` / `too-young`) from
`--diagnose`, which is the only thing that tells you which clause of
`readyToBreed` is shutting the gate.

---

## Milestones

Each is the same measurement at a longer horizon. Nothing is "done" until the
guardrails hold at that horizon too.

| #      | Bar                                               | Meaning                                          |
| ------ | ------------------------------------------------- | ------------------------------------------------ |
| **M0** | `T_ext` measured at all, with a known noise floor | We can tell signal from luck                     |
| **M1** | `T_ext ≥ 1600s`, 3/3 seeds                        | Matches today's eval window                      |
| **M2** | `T_ext ≥ 5000s`, 5/5 seeds                        | Longer than anyone watches in one sitting        |
| **M3** | `T_ext ≥ 20000s`, 5/5 seeds                       | ~5.5 hours of world time; effectively indefinite |

M3 is the real goal. M1 and M2 exist so that progress is visible on the way.

---

## Baseline

Measured on `dc973eed` (`feat/micro-land-evals`), theme `grassland`.

```
npm run eval:micro-land -- --theme grassland --seconds 1600 --runs 3 --diagnose
```

```
── Grassland Meadow ✗ 3 failing ────────────
  ✓ run-outlasts-maturity         1.05   run ≥ 2× slowest maturity (1520s; this run 1600s)
  ✗ no-animal-extinctions          14%   extinct in ≥1 run: mite, hopper, woolly, dustbee, stalker, sunhawk
  ✓ population-oscillates          57%   low water ≥ 35% of peak
  ✓ foraging-feeds-animals         43%   median species eats ≥ 0.25 /creature-minute
  ✗ breeding-gate-opens             0%   median species breeding-ready ≥ 10% of samples
      too-young 59%  underfed 37%  no-headroom 4%  cooldown 0%
  ✗ ready-animals-seek-mates      0.00   median ≥ 20% of ready time in `mate` mood
  ✓ mate-stints-convert           1.00   median converts ≥ 10% of mate stints into a birth
  ✓ lineages-advance              2.38   median surviving species averages generation ≥ 1.5
  ✓ world-stays-solid              38%   within 20% of starting solid share

  species     ready  mating|ready  stints  births   top blockers
  skybloom       0%            0%       0     428   too-young:70% underfed:30%
  hopper         3%            0%       2       2   underfed:85% too-young:66%
  mite           6%            0%       2       2   underfed:60% too-young:50%
  dustbee        4%            0%       0       0   underfed:79% too-young:71%
  woolly         0%            0%       0       0   underfed:99% too-young:95%
  stalker        0%            0%       0       0   underfed:93% too-young:73%
  sunhawk        0%            0%       0       0   too-young:100% underfed:99%
```

### What that actually says

**Every animal in the meadow dies.** All six true animals go extinct in at least
one run. The only survivor is `skybloom` — which is a flower that flies:
`isPlantLike`, needs no partner, and produced 428 of the run's 432 births. The
grassland does not have a breeding problem so much as it has no animal
reproduction at all: four births across six species in 4800 creature-seconds.

**Three of the nine checks are passing for reasons that do not hold.**

- `lineages-advance` reads 2.38 and passes **on skybloom's 428 births**. The
  guardrail meant to catch "nothing actually bred" is being satisfied by a plant.
- `mate-stints-convert` reads 1.00 and passes on a sample of **two stints**. A
  median over n=2 is not a measurement.
- `foraging-feeds-animals` reads 43% and passes **as a median across species**,
  while woolly, stalker and sunhawk sit at `underfed` 99%, 93% and 99%. A food
  chain does not need every link to starve — it needs one. The median is
  structurally blind to exactly the failure that kills it.

**`cooldown` is 0%.** `breedCooldown` is not involved, confirming the note in the
`micro-land` skill.

**The blockers co-occur.** Read per species rather than in aggregate:
woolly is `underfed:99% too-young:95%`, sunhawk `too-young:100% underfed:99%`.
These animals are not young _or_ hungry — they are starving to death before they
ever reach maturity. Woolly matures at 600s (`lifespanSeconds: 300`), sunhawk at
760s (`380`), and they are not living that long.

The aggregate line `too-young 59% underfed 37%` therefore invites the wrong fix.
It reads as "half a maturity problem"; the per-species rows say "the upper half
of the food chain never eats".

_(Checked and discarded: the top predators look like they seed a founder
population of 1–2, which would make their extinction arithmetic. They do not —
`seedStarters` multiplies every starter count by `WIDTH_SCALE`, so `count: 1`
places three sunhawks. Invariant 5.)_

---

## The mechanism, as currently understood

Read this before proposing anything. All of it is arithmetic off the source, not
inference from the eval output.

**The gate.** `readyToBreed` is four clauses, all of which must hold:

```ts
c.breedCooldown <= 0 &&
  1 - c.hunger >= bp.diet.breedAt &&
  c.hunger + TUNING.breedCost < 1 &&
  c.ageSeconds > breedingAge(c, bp)
```

**Maturity is 20% of life.** `founderMaturityAge` is
`lifespanSeconds * lifespanScale * 0.2`, and total life is
`lifespanSeconds * lifespanScale`. So every animal is a juvenile for a fifth of
its life, by construction and on every species.

**`breedAt` is stricter than it looks.** The modal value across the roster is
**0.75** (14 species), which demands `hunger ≤ 0.25`. `mealValue` is **0.26**
(not 0.42 — that number was stale in the `micro-land` skill and is corrected
here), so that is a whole meal's worth of headroom and no more. The tail runs to
0.9+, and some of those are deliberate — a `breedAt` of exactly 1 is how a nymph
is stopped from breeding before it metamorphoses, and reading those as a balance
bug would be a mistake. `breedAtScale` exempts them for that reason.

**A child always costs more than a meal.** Invariant 6 requires
`mealValue < breedCost` (**0.26 < 0.31**), and `enforceInvariants` holds that margin
whichever slider moves. This is load-bearing — if one meal paid for a child,
grazers would breed on every full stomach and strip the plants. So _every_ child
costs roughly two meals plus maintenance, permanently, by design.

**Hunting outranks mating, and the bands nearly miss.** In the mood ladder the
order is `flee` → `hunt` (seen) → `hunt` (smelled) → `mate` → `rest`/`wander`.
Prey is only considered when `wantToEat`, which is `hunger > 0.3`. So:

- At `breedAt: 0.75` a creature is ready at `hunger ≤ 0.25` and hungry above 0.3.
  The windows **do not overlap** — the comment in the source claiming these two
  "almost never compete" is correct for the modal species.
- At `breedAt ≤ 0.6` — roughly 19 species — ready reaches `hunger ≤ 0.4`, which
  **does** overlap the hungry band. Those species can be simultaneously
  breeding-ready and hunting, and hunting always wins.

**A ready animal with no mate in sight rests.** The final branch sends a creature
with `hunger < 0.25` and both feet down to `rest`. That is exactly the state a
breeding-ready modal species is in. There is no seek-a-mate wandering behaviour:
a mate is found by walking into one.

---

## Hypotheses

Each is written so that it can be **wrong**, with the observation that would kill
it. Two of them are expected to be wrong; that is the point of listing them.

### H0 (methodological) — the harness measures outcomes, not timing

We cannot see improvement because nothing records _when_ things broke.

- **Change:** add `firstExtinctionSecond` and a coarse population time series to
  `RunMetrics`; derive `T_ext` from it.
- **Predicts:** nothing about the world. It is the instrument.
- **Killed by:** nothing. This is a prerequisite, not a claim.

### H0b (methodological) — the most-suspected lever cannot be tested

`breedAt` lives on the blueprint, not in `TUNING`. **`--set breedAt=0.5` exits 2
with `Bad --set`** — the command the skill document currently recommends does not
run. Every hypothesis about `breedAt` is untestable until this is fixed.

- **Change:** add a `breedAtScale` multiplier to `TUNING`/`KNOBS`, applied where
  `bp.diet.breedAt` is read. A scale rather than an absolute, so the deliberate
  `breedAt: 1` non-breeders stay non-breeding.
- **Killed by:** nothing. Also a prerequisite.

### H1 — the gate is shut by arithmetic, not by food supply

_Sharpened by the baseline into H6 below, which carries the evidence. Kept
separate because H1 is the general claim and H6 is the specific one — if H6's
`breedAt` story turns out to be wrong, H1 may still hold via `breedCost`._

`foraging-feeds-animals` passes, so food is reachable. If so, lowering the
effective `breedAt` should open the gate without touching anything else.

- **Predicts:** `breedAtScale` down → `breeding-gate-opens` rises roughly in
  proportion to the `underfed` share it removes; `foraging-feeds-animals`
  unchanged; `T_ext` up.
- **Killed by:** the gate opening and `T_ext` _not_ moving — which would mean
  breeding was never the binding constraint and we have been reading the funnel
  wrong.

### H2 — `too-young` is a structural tax and not a bug — **FALSIFIED, E2**

Juveniles are 20% of a lifespan by construction, so a `too-young` share near 20%
would be what a healthy world looks like and not worth chasing.

**Answered off the baseline, no run required.** Observed shares are 50% (mite),
66% (hopper), 71% (dustbee), 73% (stalker), 95% (woolly), 100% (sunhawk) — far
above 20% in every case.

The reasoning that settles it: woolly recorded **zero births**, so every woolly
sampled was a founder, seeded at age 0 and crossing maturity at t=600s. Across a
1600s run a surviving founder would be juvenile for at most 37% of the samples.
Observing 95% means the sampled population is concentrated in the pre-maturity
window — the woollies are dying before they ever grow up.

**So `too-young` is downstream, not a cause.** Raising or lowering the maturity
fraction treats a symptom. **Do not spend an experiment on maturity tuning.**

### H3 — ready animals rest instead of looking

A modal-species creature that is ready to breed and cannot see a mate goes to
`rest` and stops moving. Encounters then depend entirely on someone else walking
into it.

- **Change:** make `readyToBreed && !mate` wander rather than rest; or widen
  `mateRadius` (already a knob, testable today).
- **Predicts:** `mate-stints-convert` and births up; `ready-animals-seek-mates`
  up. Should show most strongly in low-sight species.
- **Killed by:** `mateRadius` moving nothing, which would mean mates are found
  fine and the loss is at the gate rather than the search.

### H4 — low-`breedAt` species are outcompeted by their own appetite — **NOT APPLICABLE TO GRASSLAND, E2**

For the ~19 species across the whole roster with `breedAt ≤ 0.6`, ready and
hungry overlap and `hunt` outranks `mate` unconditionally.

**Answered off the baseline.** Every grassland animal sits at `breedAt ≥ 0.70`,
so the ready window (`hunger ≤ 0.30` at the loosest) barely touches the hungry
band (`> 0.3`). The conflict does not arise here.

Keep the hypothesis — it is probably live on a theme that seeds low-`breedAt`
species — but **it cannot explain the meadow** and must not be worked on under
this plan's goal.

### H6 — `breedAt` is the whole gate, and it is set above what the food supply can deliver

The strongest signal in the baseline, and it should be the first thing tested.
Ordered by `breedAt`, the `underfed` blocker share is almost perfectly monotone:

| species | eats      | `breedAt` | hunger needed | `underfed` | births |
| ------- | --------- | --------- | ------------- | ---------- | ------ |
| mite    | plant     | 0.70      | ≤ 0.30        | 60%        | 2      |
| dustbee | plant     | 0.72      | ≤ 0.28        | 79%        | 0      |
| hopper  | plant     | 0.80      | ≤ 0.20        | 85%        | 2      |
| woolly  | plant     | 0.82      | ≤ 0.18        | 99%        | 0      |
| stalker | meat      | 0.85      | ≤ 0.15        | 93%        | 0      |
| sunhawk | bug, meat | 0.88      | ≤ 0.12        | 99%        | 0      |

Six species, six points, one line. The two species that bred at all are the two
loosest gates. With `mealValue` at **0.26**, a woolly must be within 0.18 of
completely full — under one meal's worth of headroom — and hold that state long
enough to meet another woolly in the same condition. E1 makes this stronger, not
weaker: every one of these species eats 0.44–0.55 times a minute, so they are not
short of food. They are short of the _last_ mouthful, permanently.

- **Predicts:** scaling `breedAt` down moves `underfed`, `breeding-gate-opens`
  and `T_ext` together, and moves them most for the species highest in the table.
- **Killed by:** the gate opening while `T_ext` stays flat — which would mean
  animals now qualify to breed and still cannot find each other, promoting H3
  from "plausible" to "the answer".
- **Blocked by W2.** `breedAt` is not a knob; this cannot be tested today.

### H7 — hunger outruns the meal, so fullness is unreachable rather than merely rare

New in E1, and the reason the `underfed` story is not simply "lower `breedAt`".

The sunhawk eats **0.52 meals per creature-minute**, sits at `underfed: 100%` for
its entire life, and dies of old age at t≈1600s having never once qualified. That
combination is only possible if hunger accrues faster than 0.26 of a stomach per
two minutes — i.e. the _equilibrium_ hunger this species settles at is above its
`breedAt` no matter how well the hunting goes. If so it is not a rare state, it
is an unreachable one, and no amount of `breedAtScale` short of dropping below
that equilibrium will produce a single birth.

- **Change:** none yet — first compute, per grassland species, the steady-state
  hunger implied by `hungerRate * hungerRateScale` against the observed meal rate,
  and compare it to `breedFullness(bp)`. Arithmetic off the source and one
  `--diagnose` output already on disk. **Free — do it before spending a run.**
- **Predicts:** the species ordering of "equilibrium hunger minus `breedAt`"
  matches the ordering of `underfed` share almost exactly, and the three species
  with zero births sit on the wrong side of zero.
- **Killed by:** equilibrium hunger comfortably below `breedAt` for all six, which
  would mean fullness is reachable and the loss is in how long it is _held_ —
  promoting H3.
- **Distinguishes itself from H6** by predicting that `breedAtScale` produces a
  **threshold**, not a gradient: nothing until the scale crosses a species' line,
  then that species starts breeding all at once.

### H5 — the meal economy sets a floor we should stop fighting

`mealValue < breedCost` is invariant 6 and must not be inverted. So a child costs
~2 meals forever, and the only lever left is the **rate** of meals, not their
ratio.

- **Predicts:** experiments that improve foraging rate (plant density,
  `nativePlantTarget`, `maxPlants`, plant distribution) move `T_ext` further than
  experiments that shave the breeding cost.
- **Killed by:** cost-side changes outperforming supply-side ones.

---

## Method

The point of the method is that in six months someone can read the log and know
whether a number was earned or lucky.

### Rules

1. **One variable per experiment.** Two knobs moved together is a result nobody
   can attribute.
2. **Same seeds on both arms.** `seedFor(i) = 1000 + i * 7919`, so run `i` is the
   same world on every checkout. A comparison across different seeds is not a
   comparison.
3. **Never fewer than 3 seeds; 5 for a decision.** `Math.random()` is reachable
   from three places in the sim, so one run is an anecdote.
4. **Never a run shorter than `2× slowest maturity`.** Below that,
   `run-outlasts-maturity` fails and every breeding number is measuring
   childhood. For grassland that is ~1600s.
5. **Fix the first failure in the causal chain, not the loudest one.** Foraging
   before gate before priority before pathing.
6. **Record the command and the commit.** Both arms, verbatim.

### The noise floor comes first

Before any hypothesis is tested, run the _same_ configuration on two disjoint
seed sets and record how much `T_ext` moves. That spread is the noise floor.

**An experiment that moves the primary metric by less than the noise floor has
found nothing**, however good the story attached to it. Without this number every
subsequent result is unfalsifiable, which is why it is E1 and not an
afterthought.

### Decision rule

Keep a change when **all** of these hold:

- `T_ext` improves by more than the noise floor, on the same seeds;
- every guardrail in the table above still holds;
- the improvement survives a re-run on a _different_ seed set.

Otherwise revert it. A change that is neutral on the primary metric but tidies the
world is a separate conversation and does not belong in this log.

### Promoting a number to a default

A knob value found here becomes a default in `constants.ts` only after it has
cleared the decision rule on 5 seeds **and** been run against the other themes
(`tropical-island`, `verdant-forest`, `tidepool`) to check it did not fix
grassland by breaking them. Update the comment that justifies the old number —
house rule, and the comment is the only record of why.

---

## Experiment log

Append only. Never edit a past row; add a new one that supersedes it.

| ID  | Date       | Hypothesis                 | Change                            | Command                                                     | Result                                                                             | Verdict                    |
| --- | ---------- | -------------------------- | --------------------------------- | ----------------------------------------------------------- | ---------------------------------------------------------------------------------- | -------------------------- |
| E0  | 2026-08-16 | baseline                   | none, at `dc973eed`               | `--theme grassland --seconds 1600 --runs 3 --diagnose`      | 3 failing; 6/6 animals extinct; 4 animal births                                    | **done** — table above     |
| E2  | 2026-08-16 | H2, H4 (free, off E0)      | none — re-read E0                 | —                                                           | H2 falsified; H4 not applicable to grassland                                       | **done**                   |
| E1  | 2026-08-16 | noise floor                | none, two disjoint seed sets      | at `9b0f90fe`, as E0, and again with `--seed-start 3`       | `T_ext` 495s vs 360s. **Noise floor ≈ 135s at 3 seeds.**                           | **done** — below           |
| E3  | 2026-08-16 | H6                         | `--set breedAtScale=0.7`          | as E1 both arms, `--set breedAtScale=0.7`                   | Gate opens (0–2%→4–6%), births ×3.5. `T_ext` **worse**, within noise.              | **not promoted** — below   |
| E4  | 2026-08-16 | H7 (free, off E1)          | none — arithmetic + source        | —                                                           | H7 confirmed for 4/6. **Sunhawk cannot survive by construction.**                  | **done** — below           |
| E5  | 2026-08-16 | W9 — sunhawk starters      | `sunhawk count: 1 → 2` (3 → 6)    | as E1, both arms                                            | `T_ext` 410s / 440s, within noise. **The metric stopped measuring a dice roll.**   | **kept** — below           |
| E6  | 2026-08-16 | fatigue latch + chase-only | code, no knobs                    | as E1, both arms, on top of E5                              | `T_ext` 480s / 450s, within noise. Exhaustion pinning gone (63–80% → 0–3%).        | **kept** — a repair, below |
| W9a | 2026-08-16 | noise floor, re-measured   | none — free, off E5/E6's own arms | —                                                           | **Noise floor is 30s**, not 135s. Two independent estimates agree.                 | **done** — below           |
| E7  | 2026-08-16 | H6, re-tested post-E5/E6   | `--set breedAtScale=0.7`          | as E1, both arms                                            | `T_ext` 435s / 505s — arms disagree in sign. `underfed` 47%→28%, `too-young` →60%. | **not promoted** — below   |
| E8  | 2026-08-16 | H8 (free, off one sim run) | none — `sim:micro-land 900s`      | `npm run sim:micro-land -- --theme grassland --seconds 900` | Plants at cap all run. 12 predators, **77 kills**. Grazers are eaten, not starved. | **done** — below           |

### E3 — the gate opens, three and a half times the babies, nobody is saved

Commit `9b0f90fe`, both arms of E1 repeated with exactly one knob moved:

```
npm run eval:micro-land -- --theme grassland --seconds 1600 --runs 3 --diagnose --set breedAtScale=0.7
npm run eval:micro-land -- --theme grassland --seconds 1600 --runs 3 --seed-start 3 --diagnose --set breedAtScale=0.7
```

| Measure                   | Baseline (E1) | `breedAtScale=0.7` |
| ------------------------- | ------------- | ------------------ |
| `T_ext` median, seeds 0–2 | 495s          | **225s**           |
| `T_ext` median, seeds 3–5 | 360s          | **335s**           |
| `breeding-gate-opens`     | 0–2%          | 4–6%               |
| `underfed` blocker        | 49%           | 30%                |
| animal births, seeds 0–2  | 17            | **42**             |
| animal births, seeds 3–5  | 5             | **19**             |
| mate stints, seeds 0–2    | 16            | 42                 |

**H6's prediction about the funnel is confirmed.** Scaling `breedAt` down moves
`underfed` and `breeding-gate-opens` together and multiplies births by ~3.5. The
stalker is the clearest case: 0 mate stints and 0 births at baseline, 27 stints
and 11 births at 0.7. The gate was the binding constraint on breeding, exactly as
claimed.

**And it did not help.** All six species still go extinct in every run.
`lineages-advance` is still 0.00. `T_ext` went _down_ in both arms — 270s in one
(beyond the noise floor) and 25s in the other (well inside it).

By the decision rule this is **not promoted**. But the interesting part is why
the rule cannot actually adjudicate it:

> **`T_ext` is currently blind, and E3 is what proved it.** The first species out
> was `sunhawk` in **all six** E3 runs and four of six E1 runs — and per E4 the
> sunhawk is not dying of anything the ecosystem does. It is being deleted by a 1%
> coin flip, on a timer, at a mean of 500s. Both arms of every experiment are
> therefore measuring the same dice roll, and a three-draw median of a geometric
> distribution swings by hundreds of seconds for free. The 135s "noise floor"
> measured in E1 is mostly _this_.
>
> No tuning experiment can be judged on `T_ext` until the sunhawk stops being
> coin-flipped out of the world. This is now the blocking work item, and it is
> ahead of every hypothesis in this document.

Two real effects worth keeping, both new:

- **`too-young` and `no-headroom` are what is left.** With `underfed` down to 30%,
  `too-young` becomes the top blocker at 55% and `no-headroom` roughly triples to
  14–15%. The second is a genuine signal: those animals now qualify on fullness
  and cannot _afford_ the child (`hunger + breedCost >= 1`). That points at
  `breedCost`, which invariant 6 constrains but does not pin.
- **The world became ceiling-bound.** Peak population sat at exactly **350** in all
  six E3 runs, against 292–318 across the six baseline runs, and
  `population-oscillates` fell from 56–58% to 48–50%. Something is capping at 350
  — not `MAX_CREATURES` (1020) — and `dustbee` starvation rose from 22% to 39%
  with `mite` at 18%. More babies, crowded out plants, hungrier grazers. That is
  the failure invariant 6 exists to prevent, arriving by a route it does not
  cover. See W9.

### E5 — six sunhawks, and a metric that finally looks at the world

`sunhawk count: 1 → 2` in the grassland starters (× `WIDTH_SCALE` = 6), the
option chosen over exempting never-established species and over lowering the
threshold. Both arms of E1 repeated, nothing else moved.

| Measure            | Baseline (E1)        | 6 sunhawks (E5)               |
| ------------------ | -------------------- | ----------------------------- |
| `T_ext`, seeds 0–2 | 495s                 | 410s                          |
| `T_ext`, seeds 3–5 | 360s                 | 440s                          |
| first species out  | sunhawk, 4 of 6 runs | woolly ×2, hopper, dustbee ×3 |
| per-run spread     | 55–621s              | **340–523s**                  |

Both `T_ext` moves are inside the noise floor, so on the primary metric this is a
null result — and it is nonetheless the most valuable change so far, because of
the third row. **The sunhawk is no longer the first species out of any run.**
`T_ext` is now set by grazers dying of grazer problems, which is what it was
supposed to measure all along.

The fourth row is the same fact said in variance: the per-run spread collapsed
from 566s to 183s. The 135s noise floor measured in E1 was mostly the coin flip,
and **it should be re-measured on this commit before it is used to judge
anything.**

The mechanic itself now shows up honestly in the cause-of-death column, which is
the other half of the repair: `sunhawk vanished: 22%`, `stalker vanished: 17%`,
`hopper 9%`, `woolly 4%` — species genuinely declining into the window and
winking out, which is what #3291 is for. And the sunhawk's real cause of death
turns out to be **starvation, 78%** — an ecological signal that was completely
masked for the life of the project by a species that never lived long enough to
be hungry.

### E6 — the creatures were never resting, they were flickering

Found by watching the game rather than the harness, which is worth recording on
its own: the player noticed creatures sitting at very high fatigue and "resting
even when starving", and neither the evals nor the funnel could have named it.

Two defects in the fatigue block, both repairs to stated intent:

- **The recovery threshold was unreachable.** The intent is hysteresis — hit 0.9,
  rest until 0.2 — but the exit was `mood === 'rest' && fatigue < 0.2`, and the
  mood is not memory: `look` re-decides it from scratch every sense pass and knows
  nothing about fatigue. A creature forced to rest was put back on `hunt` a tenth
  of a second later and tipped over 0.9 again immediately. It never rested and
  never recovered; it flickered, permanently pinned at exhaustion, at 60% speed,
  with `targetId` cleared ten times a second.
- **Walking toward a smell was charged as a sprint.** `hunt` covers both a locked
  chase and drifting on a bearing toward something only smelled (`targetId ===
null`). The second is ordinary walking and is most of the hunting a grazer does.

Measured over 600s of grassland, before → after:

| species | mean fatigue | fatigue ≥ 0.85 | resting while starving |
| ------- | ------------ | -------------- | ---------------------- |
| mite    | 0.70 → 0.27  | 65% → 3%       | 40% → 37%              |
| hopper  | 0.76 → 0.28  | 75% → 3%       | 50% → 41%              |
| woolly  | 0.64 → 0.32  | 63% → 3%       | 43% → 33%              |
| dustbee | 0.65 → 0.08  | 68% → 1%       | 54% → 5%               |
| stalker | 0.77 → 0.28  | 80% → 3%       | 60% → 34%              |
| sunhawk | 0.43 → 0.04  | 42% → 0%       | 27% → 0%               |

**And the ecosystem did not care.** `T_ext` 410→480 and 440→450, both inside the
noise floor; the gate is still shut at 0%; every species still dies. Kept anyway,
because the decision rule is for promoting _knob values_ and this is a bug fix —
the sim now does what its own comment says. But it is not progress on the goal
and should not be recorded as any.

Two things it did change that matter downstream:

- **`restSlowdown` is live for the first time.** The broken exit was also
  clobbering `look`'s own "a well-fed grounded creature rests" decision, so the
  half-hunger-while-resting multiplier had almost never applied to anything.
  Hunger economics are now different, and per E4 hunger is the binding constraint
  — any pre-E6 arithmetic about calorie balance needs redoing.
- **`dustbee` forages worse**: 0.24 → 0.16 meals/creature-minute, with starvation
  up to 53% in one arm. That is the worst species in the check and it is now
  within 0.06 of the failure floor. Watch it.

_(Two unit tests moved with this and neither was measuring what it claimed.
`brain-size` and `slow-metabolism` tick two worlds in one interleaved loop, which
shares `creature-sim`'s module-level `tickCount`; with both creatures at id 1 the
arithmetic works out so the second world **never runs its sense pass at all**.
The old fatigue line was dragging the first world's creature out of `rest` to
match, so the two agreed by accident. Fixed the interleaving; recalibrated the
two magnitudes against a measured trace.)_

### W9a — the noise floor is 30s, and it cost nothing

E5 and E6 each ran two disjoint seed sets under one unchanged configuration,
which _is_ the noise-floor measurement — it did not need its own experiment:

| commit          | seeds 0–2 | seeds 3–5 | spread  |
| --------------- | --------- | --------- | ------- |
| E5 (`958585a6`) | 410s      | 440s      | **30s** |
| E6 (`4c52e0f2`) | 480s      | 450s      | **30s** |

Two independent estimates agreeing at 30s, against 135s in E1. The old figure was
mostly the sunhawk coin flip, exactly as E3 predicted. **Every decision rule in
this document divides by this number, so re-derive any verdict that used 135s.**

A note on method that generalises: this was recorded as a work item and would
have cost a fifteen-minute run. It was already sitting in data on disk. The
skill's "free experiments exist — do them first" is the rule, and the way to
apply it is to ask what the _existing_ arms already are before designing a new
one.

### E7 — the gate opens further and the meadow dies at the same rate

`breedAtScale=0.7` again, now on `4c52e0f2` where the metric is un-blinded, the
calorie economics are better and the floor is 30s. Everything E3 could not be
judged against is fixed.

| Measure               | E6 (control) | E7 (`breedAtScale=0.7`) |
| --------------------- | ------------ | ----------------------- |
| `T_ext`, seeds 0–2    | 480s         | 435s                    |
| `T_ext`, seeds 3–5    | 450s         | 505s                    |
| `underfed` blocker    | 46–48%       | **27–29%**              |
| `too-young` blocker   | 42–46%       | **60–61%**              |
| `breeding-gate-opens` | 0%           | 1%                      |
| mite births           | 8            | 18                      |

The arms move in _opposite_ directions, −45s and +55s, both larger than the 30s
floor. That is not a small effect, it is no effect plus noise slightly wider than
the estimate — and it is the second time this knob has produced births without
producing survival. **H6 is answered: the gate is real, and opening it is not
sufficient.** Stop spending runs on it.

What it bought instead is the blocker mix. With `underfed` roughly halved, the
constraint underneath is visible, and it is not hunger:

| species | `too-young` | `underfed` | births |
| ------- | ----------- | ---------- | ------ |
| woolly  | **98–100%** | 25–30%     | 0      |
| stalker | 95–97%      | 22–37%     | 0      |
| dustbee | 85–96%      | 47–48%     | 0      |
| hopper  | 81–85%      | 19–26%     | 3–4    |

E2 falsified H2 by arguing that a `too-young` share far above 20% means juveniles
are dying before they grow up. That reasoning was right and is now sharper:
woolly is `too-young: 100%` with zero births, so every woolly ever sampled was a
juvenile, and its entire founder population dies each run before maturity at
600s.

### E8 — the grazers are eaten, and the plants are never touched

One human-read run, `npm run sim:micro-land -- --theme grassland --seconds 900`,
seed 1000. Free, and it says more than the last three experiments combined.

```
t=0s    Sunleaf:54 Bramble:36 | Mite:21 Hopper:18 Woolly:15 Dustbee:12 Stalker:6 Sunhawk:6
t=450s  Sunleaf:70 Bramble:70 | Mite:6  Hopper:6  Sunhawk:6 Stalker:5
t=900s  Sunleaf:70 Bramble:70 | Sunhawk:6
```

**The plants sit at `PLANT_SPECIES_CAP` (70) from t=90s to the end.** Food is
abundant, capped, and largely uneaten. Every hypothesis in this document about
the food supply — H5 especially — is answered: supply is not the constraint and
raising it cannot help.

What kills them is arithmetic:

| species | ate        | died                       |
| ------- | ---------- | -------------------------- |
| sunhawk | 47 animals | nothing — 6 alive at t=900 |
| stalker | 30 animals | eaten 5, starved 1         |
| mite    | 67 plants  | **eaten 22**, starved 1    |
| hopper  | 55 plants  | **eaten 16**               |
| woolly  | 21 plants  | **eaten 12**               |

**Twelve predators killed 77 animals in 900 seconds, from a standing stock of 66
grazers.** Predation exceeds prey turnover by a wide margin, and the grazers need
400–600s to reach breeding age — so they are removed faster than they mature,
and every question about whether they are then _allowed_ to breed is downstream
of a population that no longer exists.

**And the predator pressure never relents.** The sunhawk holds at exactly 6 for
the entire run: it cannot breed (maturity 760s) and does not die inside the
window, so unlike a real predator it does not crash when its prey does. A food
web recovers because the predator starves first. This one does not get the
chance.

_(Note what the guardrails did here. `population-oscillates` passed at 49–54%
across a run in which every animal died — the plants were doing the oscillating,
which is the "Plants only" lie named at the top of this document.
`species-richness-holds` (W7) was the only check that caught it. That is the
whole argument for W7 in one run.)_

### H8 — predation removes grazers faster than they can mature

The synthesis of E7 and E8, and it supersedes H1, H5 and H6 as the live
explanation.

- **Predicts:** removing the predators entirely lets the grazers reach maturity,
  breed, and hold a population — and `T_ext` becomes censored.
- **Killed by:** the grazers dying out anyway with no predators in the world,
  which would put the cause back on maturity and the gate and make predation a
  red herring.
- **Next:** that ablation. It is not a shippable change; it is the one run that
  distinguishes the two, and it should be run before anything is tuned.

**A tension to settle before any fix, not after.** If the answer is "fewer
predators", it collides with W9's resolution: three sunhawks sit inside the
stochastic-extinction window and get coin-flipped out, six strip the meadow. That
may mean grassland should not carry two predator species at all — which is a
design question about what the meadow _is_, and belongs to whoever owns the game.

### E4 — the meadow's top predator is deleted by a coin flip

Free: arithmetic off the source and the `--diagnose` output E1 already produced.
No run was spent.

**H7 holds for every grazer.** Net stomach change per creature-minute, at each
species' _observed_ E1 feeding rate, against `hungerRate * hungerRateScale * 60`:

| species | drain/min | gain/min | net/min    | needs hunger ≤ | can it ever get there?         |
| ------- | --------- | -------- | ---------- | -------------- | ------------------------------ |
| mite    | 0.204     | 0.138    | **−0.066** | 0.30           | no                             |
| hopper  | 0.156     | 0.127    | **−0.029** | 0.20           | no                             |
| woolly  | 0.120     | 0.114    | **−0.006** | 0.18           | no                             |
| dustbee | 0.168     | 0.081    | **−0.087** | 0.28           | no                             |
| stalker | 0.132     | 0.143    | +0.011     | 0.15           | ~32 min of perfect foraging    |
| sunhawk | 0.114     | 0.135    | +0.021     | 0.12           | ~18 min, then maturity at 760s |

All four grazers run a **negative** calorie balance while eating as often as they
actually manage to. They are not occasionally short of fullness; fullness is
behind them and receding. That is why `underfed` sits at 59–99% and why no
`breedAtScale` alone will fix the grazers — the gate is above their ceiling.

**And then the real one.** The two species that _can_ theoretically fill up are
the two that produced zero births in six runs, and the sunhawk's cause of death
is `aged: 78–100%` against a nominal lifespan of 3800s in a 1600s run — which is
impossible. It is not old age. `creature-sim.ts` (stochastic extinction, issue
#3291) wipes an entire species on a 1% roll every 300 ticks whenever its
population is **under 5**, and reports every one of those deaths as `aged`.

Grassland seeds the sunhawk at **3** — `count: 1 × WIDTH_SCALE` — in every seed.
So it is inside the stochastic-extinction window from tick one, rolling 1% every
five world-seconds. Mean time to deletion is **500s**. Its maturity age is
**760s**.

> The top predator of the grassland is, on average, erased 260 seconds before it
> is first allowed to breed. Not usually. Always.

Observed first-extinction seconds for sunhawk across E1's six runs — 55, 165,
360, 495 — are a geometric distribution with exactly that mean. The stalker is
seeded at 6, one death clear of the same window, and it starves (83%), so it
enters the window and follows.

**This is upstream of every breeding hypothesis**, and by the plan's own rule —
fix the first failure in the causal chain — it comes before H6 and H7 both. It
also means `T_ext` is currently measuring a dice roll: sunhawk was the first
species out in four of six runs.

Two separable defects:

1. **The label lies.** Stochastic extinction reports cause `aged`, which is
   indistinguishable from a creature living a full life. That is the whole reason
   this survived to now — `sunhawk aged:100%` reads as "died of old age", which
   is the one cause of death nobody investigates. This is a straight repair.
2. **Grassland seeds a species below the threshold the mechanic fires at.** That
   is a design decision with more than one defensible answer, and it belongs to
   whoever owns the game, not to this document.

### E1 — the noise floor, and a baseline that supersedes E0

Commit `9b0f90fe`, theme `grassland`. Both arms verbatim:

```
npm run eval:micro-land -- --theme grassland --seconds 1600 --runs 3 --diagnose
npm run eval:micro-land -- --theme grassland --seconds 1600 --runs 3 --seed-start 3 --diagnose
```

| Arm | Seeds | `T_ext` per run                           | Median |
| --- | ----- | ----------------------------------------- | ------ |
| A   | 0–2   | 555s mite · 495s sunhawk · 165s sunhawk   | 495s   |
| B   | 3–5   | 55s sunhawk · 621s dustbee · 360s sunhawk | 360s   |

**The noise floor is ≈135s on the median at three seeds.** The individual runs
span 55s to 621s — a factor of eleven under one configuration — so a single run
is worth nothing, and a three-seed experiment can only see a change worth several
minutes of `T_ext`. Five seeds for anything close.

M1 (`T_ext ≥ 1600s`, 3/3) is a long way off: the meadow currently breaks around
**seven minutes** in.

#### Two things E0 got wrong, both because of the instruments

**Foraging is fine. It was never the problem.** With the worst species reported
instead of the median, every animal eats 0.26–0.55 meals per creature-minute and
the slowest is `dustbee` at 0.26. E0's reading — that woolly, stalker and sunhawk
"never eat" — came from reading `underfed` (a fact about the _breeding gate_) as
a fact about food. They eat constantly. They are never **full**, which is a
different claim and points at a different fix. H5's supply-side prediction is
weaker than it looked.

**`underfed` is now the top blocker, not `too-young`.** 49% vs 41%, where E0 read
59% too-young / 37% underfed. The difference is skybloom leaving the denominator.
This strengthens H6 and further deflates H2.

#### What cause-of-death says, now that it prints

Nothing here was visible before W6, and it does not match the story in the
mechanism section.

| species | died of                      | reading                                             |
| ------- | ---------------------------- | --------------------------------------------------- |
| woolly  | **eaten 96%**                | predation, not starvation                           |
| hopper  | eaten 79–91%                 | predation                                           |
| mite    | eaten 57–78%, starved 17–35% | predation, some starvation                          |
| dustbee | eaten 53–59%                 | predation                                           |
| stalker | **starved 83–84%**           | the mid predator cannot make a living               |
| sunhawk | **aged 78–100%**             | the top predator dies of old age, having never bred |

So the meadow is not starving to death — it is being **eaten** to death, while
the two predators doing the eating fail in opposite ways. The sunhawk is the
starkest: nine founders across six runs, every one of them reaching the end of a
3800-second nominal lifespan without a single birth, and `underfed: 100%` the
whole way. It eats at 0.52/min and is never full enough to qualify.

That last row is worth its own hypothesis, because "dies of old age at
`underfed: 100%` while eating half a meal a minute" is arithmetic that should not
be possible unless `hungerRate` is outrunning `mealValue` for that species — see
H7.

#### Guardrails at baseline

`population-oscillates` 56–58% ✓, `world-stays-solid` 38–39% ✓,
`run-outlasts-maturity` 1.05 ✓. `species-richness-holds` 0/6 in every run ✗ —
there is no monoculture to guard against yet, because there is nothing left at
all. `lineages-advance` is 0.00 and failing now that skybloom is excluded; it
passed at 2.38 in E0 on that flower's 428 births.

`mate-stints-convert` passed on arm A (1.15 off 13 mite stints) and abstained on
arm B (2 stints total). Both are the honest answer for their sample.

### Work items falling out of the above

**W1–W8 landed in `9b0f90fe`.** They are kept below as the record of what was
wrong and why. The live queue is:

- **W9 — the blocker. Stop the sunhawk being coin-flipped out.** Stochastic
  extinction (issue #3291) fires on any species under 5 and grassland seeds the
  sunhawk at 3, so the top predator is deleted at a mean of t=500s and its
  maturity is 760s. Until this changes, `T_ext` measures that roll and no tuning
  experiment can be judged. **This is a design decision, not a repair** — the
  mechanic is deliberate, and there are at least three defensible answers (seed
  above the threshold, exempt a species that has never been above it, or make the
  roll depend on something other than a bare count). It belongs to whoever owns
  the game. The half that _is_ a straight repair — the death reporting as `aged`,
  which is what hid it — is done.
- ~~**W9a — re-measure the noise floor.**~~ Done, free, off E5 and E6's own arms:
  **30s**, not 135s. See below.
- **W10 — identify the 350 ceiling.** Peak population pinned at exactly 350 in all
  six E3 runs and 292–318 at baseline, while grazer starvation rose. Not
  `MAX_CREATURES` (1020). Something is binding and it converts extra births into
  hungrier grazers; that has to be understood before any experiment that raises
  the birth rate can be believed. The population series recorded by W1 is on the
  metrics object and is not printed yet — printing it would answer this without a
  new run.
- **W12 — the predator ablation (H8).** Run grassland with `stalker` and
  `sunhawk` at 0 and see whether the grazers hold. Not a shippable change — the
  one measurement that separates "predation is the constraint" from "maturity and
  the gate are". Everything else in this queue is downstream of its answer.
- **W11 — `no-headroom` tripled under E3 (4%→15%).** Animals qualifying on
  fullness and failing to afford the child points at `breedCost`. Cheap to test
  once `T_ext` works.

The original list, all landed:

- **W1.** `firstExtinctionSecond` + a coarse population series in `RunMetrics`;
  derive `T_ext`. Without it the primary metric does not exist and E1 cannot run.
  (H0)
- **W2.** `breedAtScale` in `TUNING_DEFAULTS` and `KNOBS`, applied where
  `bp.diet.breedAt` is read. **Multiplicative**, so the deliberate `breedAt: 1`
  non-breeders — nymphs that must metamorphose before breeding — stay
  non-breeding. Blocks E3, which is the highest-value experiment available.
  (H0b, H6)
- **W3.** `foraging-feeds-animals` should not be a bare median. It passed at 43%
  in E0 while three species sat at `underfed` 93–99%. Report the **worst**
  species alongside the median, or fail on any species below the bar — a food
  chain breaks at one link, and a median cannot see one link.
- **W4.** `lineages-advance` must exclude `isPlantLike` species. In E0 it passed
  at 2.38 on skybloom's 428 births while the six real animals managed four
  between them. As written it cannot detect the failure it exists to detect.
- **W5.** `mate-stints-convert` needs a minimum-sample guard. It passed on **two
  stints** in E0. A check that reports a confident number from n=2 is worse than
  a check that abstains.
- **W6.** Print cause-of-death in `--diagnose`. `RunMetrics.deaths` already
  carries it and the eval does not surface it; it is the one number that
  separates "starved" from "eaten", and those are opposite fixes.
- **W7.** A `species-richness` guardrail check, so monoculture cannot pass.
- **W8.** Fix the `micro-land` skill's `--set breedAt=0.5` example, which exits 2.

W3, W4 and W5 were worth doing before any tuning: three of the nine checks were
green for reasons that did not survive contact with a change, and tuning against
instruments that lie is how a week disappears. They cost one afternoon and
immediately overturned two of E0's conclusions — and W6, the smallest of them,
is what exposed the mechanic in E4 that had been invisible for the life of the
project.
