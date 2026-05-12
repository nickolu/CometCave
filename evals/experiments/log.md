# Experiment log

One row per round. `winner` is the arm promoted into baseline (or `none`
if no arm cleared the promotion bar). `Δ ship` is the winner's
ship-eligible % minus the baseline arm's ship %.

| Round | Date | Hypothesis | Arms | Winner | Δ ship | Notes |
| --- | --- | --- | --- | --- | --- | --- |
| 001 | 2026-05-07 | Concision is the dominant gate driver — test prompt edits to address it | A 57.5% · B 67.1% · C 64.2% · D 63.0% | **B** | **+9.6 pp** | Concision μ +0.20 (target hit). All three non-baseline arms beat baseline. C lost by 2.9 pp — construction-time fix > review-time fix. |
