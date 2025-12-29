## Vouchers appear that have already been purchase

### Reproduction steps:

1. purchase a voucher from the shop
2. keep playing

### Expected

Jokers should only appear once in the shop, and should not appear if owned

### Actual

on occassion the same joker appears multiple times in the shop

### Issue status

Fixed - Redesigned getRandomBuyableCards (utils.ts:220-256) with simpler, more robust logic:
1. Filter out cards already in the shop (lines 220-236) - prevents duplicates when Overstock voucher adds cards
2. Use shuffle-and-take approach instead of deduplication (lines 246-250) - simpler and guarantees uniqueness
This fixes both the initial duplicate issue and the Overstock voucher duplicate issue.
