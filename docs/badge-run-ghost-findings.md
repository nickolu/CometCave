# Badge Run — Ghost Rivals & Pool Contention Findings

**Date:** 2026-08-27  
**Evaluator:** Automated agent (B-3.5 gate)  
**Harness:** `npm run eval:badge-run -- --lobbies 200`

---

## Metrics (200 lobbies, 8 drafters × 6 rounds)

| Metric | Value |
|---|---|
| Pool exhaustion rate | 0.0% |
| Contention rate (denials / pick attempts) | 0.0% |
| Denial rate (denials / all rounds) | 0.0% |
| Avg board diversity | 33.5 unique units / lobby (out of 149) |

---

## Root Cause Analysis

The pool is **too deep** relative to 8-drafter demand:

| Tier | Units | Copies/unit | Total copies | 8-lobby demand |
|------|-------|-------------|--------------|----------------|
| T1 | 52 | 20 | 1,040 | ~8 |
| T2 | 39 | 16 | 624 | ~16 |
| T3 | 50 | 12 | 600 | ~16 |
| T4 | 4 | 9 | 36 | ~6 |
| T5 | 4 | 6 | 24 | ~2 |
| **Total** | **149** | | **2,324** | **48** |

**Pool utilization: 2.1%.** Even T5 (the rarest tier) has 24 copies vs ~2 picks — no scarcity possible.

The ghost replay system is technically correct. The heuristic bot drafts plausibly (T5 > T4 > T3 > T2 > T1 preference, with kin synergy tiebreaking). The mechanism is sound; the copy counts are the gap.

---

## Recommendation: Modified GO

**Proceed with the contested-pool / ghost-rival model**, with one fix before Epic 5:

### Copy count revision (required before Epic 5 begins)

Target 25–35% pool utilization per lobby. Suggested counts:

| Tier | Current | Proposed |
|------|---------|----------|
| T1 | 20 | 4 |
| T2 | 16 | 3 |
| T3 | 12 | 2 |
| T4 | 9 | 2 |
| T5 | 6 | 1 |

Projected utilization at proposed counts: 48 / 437 ≈ **11%** — still light, but T5 (4 copies total) and T4 (8 copies total) would create real scarcity at top tiers, which is where drafting decisions matter most.

If 11% still feels too shallow, increase draft length from 6 rounds to 9–12 rounds. At 12 rounds: 96 picks / 437 copies = **22% utilization**, with T5 fully contested in most lobbies.

### What this means for Epic 5

- **Keep** the contested pool and ghost rival model
- **Update** `TIER_COPIES` in `domain/draft/pool.ts` before wiring up the UI
- **Keep** #3854 (rival scouting panel) in scope
- Blitz remains the secondary mode, not the primary

### No-go trigger

If the proposed copy counts + extended draft rounds (9+) still show < 10% T5 contention after re-evaluation, rescope to solo run: drop #3854, Blitz becomes primary.

---

*Ghost replay system verified working. Decision logs faithfully reconstruct draft sequences. Pool contention model is structurally sound — copy count tuning is the only required change.*
