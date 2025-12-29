## Stencil joker applied twice

### Reproduction steps:

1. purchase the stencil joker
2. play a hand
3. observe the scoring events log

### Expected

stencil joker effect should only appear once in the logs (applied only once)

### Actual

stencil joker appears twice in the logs (not confirmed if its applied twice or not)

### Example

in scoring events log, this appears:

```
Joker Stencil: mult x 3
Hand Score: 30 x 66
Joker Stencil: mult x 3
```

### Issue status

Fixed - Removed duplicate dispatchEffects() call from HAND_SCORING_FINALIZE case (reduce-game.ts:344-346). The handleHandScoringEnd() function already dispatches effects internally, so the second dispatch was causing all joker effects to apply twice.
