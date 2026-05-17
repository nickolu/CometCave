# Experiment log

One row per round. `winner` is the arm promoted into baseline (or `none`
if no arm cleared the promotion bar). `Δ ship` is the winner's
ship-eligible % minus the baseline arm's ship %.

| Round | Date | Hypothesis | Arms | Winner | Δ ship | Notes |
| --- | --- | --- | --- | --- | --- | --- |
| 001 | 2026-05-07 | Concision is the dominant gate driver — test prompt edits to address it | A 57.5% · B 67.1% · C 64.2% · D 63.0% | **B** | **+9.6 pp** | Concision μ +0.20 (target hit). All three non-baseline arms beat baseline. C lost by 2.9 pp — construction-time fix > review-time fix. |
| 002 | 2026-05-12 | Close the easy-tier ship gap (52.9% vs 76.5% medium) | A 67.1% · B 66.5% · C 60.7% · D 62.5% | none | — | B hit its target (easy +11.3 pp) but failed overall due to suspected-noise hard regression. C/D both real regressions — fact-source prompt is rule-saturated. Re-baseline pending. |
| 003 | 2026-05-12 | Re-baseline HEAD ×2 to settle whether R002 B's hard regression was noise | run1 65.3% · run2 64.0% (HEAD code with B-002 guard) vs R002 A 67.1% | **revert B-002** | -1.8 pp overall | Hard regression confirmed real (-7.5 pp mean over 3 samples). Guard mechanism works (lifts easy difficulty μ +0.10) but pays an unexplained tax on hard. Code reverted; type machinery kept for future reuse. |
