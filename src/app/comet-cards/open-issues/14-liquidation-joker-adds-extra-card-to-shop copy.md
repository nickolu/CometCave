## Buying the liquidation joker causes a new card to be added to the shop (like overstock)

### Reproduction steps:

1. buy the clearance sale joker
2. buy the liquidation joker

### Expected

prices should be reduced 50%, no new card should appear in the shop

### Actual

A new card appears in the shop as if the overstock joker was purchased

### Issue status

Fixed - Updated `dispatchEffects` in `events/dispatch-effects.ts` to match on both event `type` and `id` fields. Previously only `type` was checked, so buying any voucher would re-trigger ALL voucher effects (e.g., overstock adding extra shop cards).

### Fix details

- `dispatch-effects.ts`: Filter now checks `id` equality when both the effect's event and the dispatched event have an `id` field
