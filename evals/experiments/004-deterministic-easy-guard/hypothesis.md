# Round 004 — deterministic easy-tier guard

**Date:** 2026-05-17
**Baseline:** current main (post-round-003 revert; equivalent to round-001 winner code)
**Eval config:** full sweep (51 cells) × 5 trials, judge = `gpt-4o`, concurrency 2

## Motivation

Round 002 / 003 confirmed two things:

1. The easy-tier ship gap is real (~53% vs ~76% medium / ~72% hard) and
   driven by specialist-label answers slipping through as easy-tier.
2. Adding an inline Haiku call to address it (round-002 B / B-002)
   triggered a -7.5 pp hard regression we couldn't explain, plausibly
   from API rate-limit contention. Net negative; reverted in round 003.

Round 004 attacks the same easy-tier weakness without paying B-002's
hidden cost. Two parallel approaches:

## Arms

### A — baseline

Current `main` source. Fresh run alongside B/C to control for
rate-limit / time-of-day noise (lesson from rounds 002–003).

### B — deterministic heuristic easy-specialist guard

Add a synchronous heuristic check in `generateQuestion.ts` modelled on
`detectAnswerLeak` / `detectNumericAnswer`. Flags an easy draft's
`correct_answer` as "too specialist" if any of:

- Multi-word string ending in "Award" but containing a discipline word
  ("Grammy", "Oscar", "Emmy", "Tony", "Pulitzer") — likely a fragile
  full label.
- Contains a regnal suffix ("the Great", "the Younger", "the Elder",
  "I", "II", "III", … "XV") AND the base name appears as a known
  casual shorter form (we'll start with a small set: Constantine,
  Catherine, Frederick, Henry, Louis, Philip).
- Has "Productions", "Studios", "Pictures", "Records", "Publishing"
  in the last token — production-company / label names.
- Acronym (all caps, ≤5 chars, no spaces) AND the question text
  contains the spelled-out version — the answer is the acronym
  abbreviation, the question already gave it away to the spelled form.
- Ends with "Disorder", "Syndrome", "Phenomenon" — medical / scientific
  multi-word terms that fail the easy casual-naming bar.

When triggered, trigger a repair pass with the easy-specialist reason
(same downstream as B-002 did, just zero-cost detection). No LLM call.

### C — easy rule promoted to construction system prompt

Move the existing `EASY-DIFFICULTY REPOINT` block from the user
message in `constructQuestionFromFact` into the system prompt, where
Sonnet 4.6 follows instructions more reliably. The text body is
unchanged; only the position moves.

The hypothesis: easy-tier specialist answers ship today not because
the model doesn't know the rule, but because the rule competes with
many other rules in a long user-message prompt. Promoting it to system
makes it sticky.

## Predicted effect

- B: easy ship +3-6 pp. The heuristic list is narrow on purpose — high
  precision, lower recall than B-002's Haiku call. Should NOT regress
  hard since no LLM call is added.
- C: easy ship +2-5 pp. Less impactful than B because it relies on the
  model voluntarily complying; same risk profile as round-001 wins.

## Promotion rule

Same as previous rounds: winner beats A's overall ship by ≥3 pp with
no single dim regressing >2 pp. Both arms are low-risk; the
promotion bar is the constraint, not the cost.

## Round 004 budget

- 3 arms × ~30 min wall clock × $5 ≈ ~$15, ~1.5 h total.
