# Trivia generation experiments

A/B/C/D testing for the infinite-trivia generation pipeline. Each round
proposes one or more candidate changes against the current baseline,
runs the eval-trivia harness over a fixed cell distribution for each
arm, and promotes the winner into baseline if it beats the control.

The goal is a ratcheting effect: every promoted change is locked in as
the new floor, and the next round measures incremental wins on top.

## Layout

```
evals/experiments/
  README.md             — this file
  log.md                — running ledger of all experiments
  NNN-<slug>/
    hypothesis.md       — what change, why, predicted effect
    arms/
      <arm-id>/
        run.json        — eval-trivia output for this arm
        diff.patch      — the code change (empty for baseline)
    decision.md         — scorecard comparison + verdict
```

## Methodology

1. **Snapshot baseline.** Even when "current code" is the control, run a
   fresh eval against it in the same session as the candidate arms.
   Pipeline non-determinism (LLM temperature, fact-source variance) is
   the noise floor — using a stale `latest.json` mixes that noise across
   runs that aren't comparable.
2. **One variable per arm.** Each non-baseline arm changes exactly one
   thing — a single prompt edit, a single rule. If a change requires
   multiple touchpoints to be coherent, treat them as a single arm but
   note the touchpoints in `hypothesis.md`.
3. **Same cell distribution every arm.** The eval harness samples each
   `(category, difficulty)` cell N times. Use the same `--trials` count
   across all arms in a round; otherwise the comparison is unfair.
4. **Apply → run → revert.** Each arm is run from a clean baseline. Do
   not stack arm changes on top of each other within a round.
5. **Promotion rule.** Winner must beat baseline ship-eligible % by
   ≥3 percentage points without regressing any single dimension
   (factual / difficulty / concision) by more than 2 pp. If multiple
   arms qualify, prefer the simpler change.
6. **Persistence.** Every arm's `run.json` and the round's
   `decision.md` get committed. Promoted-arm diffs become real PRs;
   `evals/runs/latest.json` is updated to the promoted arm's run.

## Running an arm

```bash
# Default: full sweep, 5 trials per cell (~8 min)
npm run eval:trivia -- --trials 5

# Faster smoke for prompt-edit signal (~3 min)
npm run eval:trivia:smoke -- --trials 5
```

The harness writes the run JSON to `evals/runs/<timestamp>.json`. Copy
it into `evals/experiments/NNN-<slug>/arms/<arm-id>/run.json` after the
run finishes. Do **not** rely on `evals/runs/latest.json` mid-round —
each `eval:trivia` invocation overwrites it.

## Reading a scorecard

`run.json` contains:
- `summary.shipRate` — % of generations the judge would let through
- `summary.dims.{factual,difficulty,concision}` — per-dimension
  histograms (3=accept / 2=borderline / 1=fail)
- `summary.worst[]` — lowest-scoring questions with rationales

The headline metric is **shipRate**. Per-dimension breakdowns are
needed to spot tradeoffs (e.g. an arm that lifts concision but tanks
difficulty calibration).

## Required env

Same as the eval harness — see `evals/README.md`.
