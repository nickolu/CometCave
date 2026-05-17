# Round 002 — decision

**Round closed:** 2026-05-12
**Winner:** none (no arm cleared the promotion bar)
**Promoted into baseline:** no — baseline remains round-001 winner

## Scorecard

| Arm | Overall | factual μ | difficulty μ | concision μ | Easy ship | Medium ship | Hard ship |
| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| A baseline | 67.1% | 2.75 | 2.79 | 2.61 | 52.9% | 76.5% | 71.8% |
| B Haiku easy-specialist guard | 66.5% (-0.6) | 2.72 | 2.81 | 2.57 | 64.3% (+11.3) | 74.1% (-2.4) | 61.2% (-10.6) |
| C harden easy fact-source guidance | 60.7% (-6.3) | 2.67 | 2.77 | 2.56 | 51.2% (-1.8) | 65.9% (-10.6) | 65.1% (-6.7) |
| D strict grounding for Video Games + Computers | 62.5% (-4.6) | 2.66 | 2.80 | 2.52 | 59.6% (+6.7) | 70.0% (-6.5) | 58.0% (-13.8) |

## Reading

**B nailed its target but failed the overall bar.** Easy ship moved
+11.3 pp — within 0.5 pp of the predicted band — and difficulty μ on
the easy tier improved (2.42 → 2.54). The guard worked at exactly what
it was designed to catch. But the overall ship rate is flat (-0.6 pp),
and the medium / hard tiers each saw 2–10 pp regressions.

The hard tier regression in particular is hard to attribute to the
code: the guard only runs when `difficulty === 'easy'`, and there is
no shared state between cells. The most defensible interpretation is
sample noise — at 75 trials per tier, a 1 SD swing on a binomial with
p≈0.72 is ~5 pp; the observed -10.6 pp is ~2 SD and well inside the
"plausible single-sample bad draw" envelope. Round-001 saw similar
±5 pp noise on per-tier numbers between arms that should have been
identical.

**C and D were real regressions, not noise.** Both arms hurt the
fact-source pipeline in different directions:
- C's heavier easy guidance got Sonar to over-prune — fewer facts
  returned, more outer-loop retries, lower overall ship across all
  tiers.
- D's strict-grounding-by-category rule completely broke Computers
  (53.3% → 0%, factual μ → 0). Sonar couldn't satisfy the single-snippet
  rule for that category at all and emitted zero facts, draining the
  outer loop's 3 attempts and producing generation_failed for every
  Computers cell. Video Games saw a 0.07 lift in factual μ but no ship
  change.

The lesson from C and D: adding heavier rules to the Perplexity prompt
backfires unless the model can satisfy them. The prompt is already long
and rule-dense; piling on more "you MUST / SKIP THE FACT IF" instructions
makes Sonar conservative across the board.

## Promotion action

No formal promotion under the round-002 promotion bar. **However**, arm
B's Haiku-easy-specialist-guard code is present in `HEAD` (committed
in `85b0d5c` as part of the round-001/002 omnibus PR before this
analysis was written). Treat the current main as "pre-promotion / live
with B-002 code shipped." Two reasonable next moves:

1. **Re-baseline against HEAD** (which includes the guard) and decide
   retroactively. If overall ship at HEAD lands at ≥67%, B-002 is fine
   to keep. If it lands at ~63–66% across multiple fresh runs, the
   guard is paying a real overall cost and we should revert it.
2. **Revert B-002 now** if you want strict bar adherence. The code is
   small and removable.

The round's eval data alone doesn't justify keeping B-002; the call
hinges on whether the hard-tier regression was sample noise (likely)
or real (then ship-impacting). A fresh confirmatory eval is the
cheapest way to know.

## Open question — re-baseline?

The promotion rule blocked B mostly on its hard-tier regression, which
looks like noise. The clean way to settle this would be to re-run arm A
with a fresh sample at the same concurrency and see whether the
baseline holds at 67.1% overall / 71.8% hard. If a fresh baseline lands
at, say, 64% overall / 62% hard, then B-002 is the actual round winner
and the noise interpretation is correct. If a fresh baseline lands at
67%+ overall again, B has a real (unexplained) hard regression and
shouldn't ship.

The 5-trial sample size is too small for the precision we want from
per-tier comparisons. Round 003 should either bump to 8–10 trials or
ship a 2-baseline pre-flight check.

## Round 003 candidates

1. **Re-baseline arm A** at the same concurrency before launching any
   new arms — settles the round-002 B verdict, also establishes whether
   B should retroactively be promoted.
2. **B-002 with broader safety net** — keep the Haiku easy-specialist
   guard but add a single calibration trial: also run the guard on a
   sample of medium-tier draft to verify it doesn't reject things
   unnecessarily.
3. **Investigate Video Games factual μ 2.20** — separate from the
   D-002 dead-end. Probably wants seed-pool tightening or a category-
   specific construction prompt nudge, not a fact-source prompt rule.
4. **Bump eval trial count from 5 to 8–10** — make per-tier signal
   robust enough to read at 75-cell granularity.
