# Round 004 — decision

**Round closed:** 2026-05-18
**Winner:** none (no arm cleared the promotion bar)
**Promoted into baseline:** no — baseline remains current `main`

## Scorecard

| Arm | Overall | factual μ | difficulty μ | concision μ | Easy | Medium | Hard |
| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| A baseline | 71.3% | 2.79 | 2.85 | 2.63 | 70.6% | 78.8% | 64.3% |
| B heuristic guard | 71.4% (+0.1) | 2.80 | 2.86 | 2.66 | 63.5% (-7.1) | 78.8% (=) | 71.8% (+7.5) |
| C easy-rule in system prompt | 72.3% (+1.1) | 2.76 | 2.86 | 2.64 | 69.9% (-0.7) | 71.8% (-7.1) | 75.3% (+11.0) |

## Reading

**Baseline shift is the biggest story.** R002 A baseline was 67.1% and
R004 A baseline is 71.3% — a +4.2 pp drift over 10 days *without any
generator code change*. Easy went from 52.9% to 70.6% (+17.6 pp). This
is either (a) the duplicate-answer backstop reshaping seed walks as
the saved pool grew, (b) Perplexity / Anthropic model behavior drift,
or (c) just sample variance. Whatever the cause, the easy-tier
weakness we set out to fix in round 004 had largely closed before we
started.

**Arm B fired zero times.** The heuristic patterns (regnal forms, "X
Award" multi-words, production-company tails, leaked acronyms,
scientific tails) matched none of the 255 generated questions. The
current pipeline is producing answers that simply don't trip any of my
patterns — possibly because the duplicate-answer backstop has been
diverting away from those failure modes, possibly because the current
DIFFICULTY_GUIDANCE is sufficient. Net effect on quality: zero. The
observed ±7 pp per-tier swings are noise.

**Arm C inched overall up +1.1 pp** by moving the easy-tier rule into
the system prompt. Doesn't clear the +3 pp bar, but the easy-tier
difficulty μ tick (2.68 → 2.71) suggests the mechanism works modestly.
Probably the right direction but not the right size; would need to
either combine with other changes or run at 8-10 trials before it can
demonstrate a real win.

**Per-tier signal is unreadable at 5 trials × 75 cells.** Across all
rounds 002-004 we've seen per-tier swings of ±7-11 pp between
arms that should be statistically identical or close to it. That's the
noise floor at n=75 per tier (1 SD ≈ 5 pp for binomial with p≈0.72).
Only the overall column (n=255, 1 SD ≈ 3 pp) is reliable for
promotion calls.

## Action

1. No code change promoted. Working tree reverted to baseline.
2. **Update promotion methodology**: stop reading per-tier as signal
   at 5-trial scale. Bump default trials to 8-10 starting in round 005
   if we want per-tier judgments to mean anything.
3. **Update latest.json** to round-004 baseline so future evals
   compare against the current state of the pipeline, not the
   10-day-old R002 baseline.

## Round 005 candidates

The easy-tier specifically is no longer the obvious weak spot — hard
tier (64.3%) is now the weakest by a meaningful margin. Plus we have
methodology homework.

1. **Investigate hard-tier weakness.** What's driving hard 64.3%?
   Pull worst hard examples from R004 A and look for patterns
   (Sonar grounding quality on niche topics? Construction prompt
   under-specifying hard guidance? Reviewer too strict on hard?).
2. **Bump trial count to 8** as the new default for round 005+.
   Cost ~$8/arm. Per-tier SE drops from ~5 pp to ~3.5 pp.
3. **Combine C with one more change** — system-prompt easy rule moved
   the overall +1.1 pp directionally. Stacked with something targeting
   hard or factual could be enough to clear the bar.
