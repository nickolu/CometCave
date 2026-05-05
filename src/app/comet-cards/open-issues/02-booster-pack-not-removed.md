## Booster pack isn't removed after purchase

### Reproduction steps:

1. from the shop view, buy/open a pack
2. select cards from the pack until you return to the shop view

### Expected

The selected pack should be removed and the card shop should have one fewer pack than it did previously

### Actual

The selected pack remains in the shop (or was replenished)

### Issue status

Fixed - Moved pack/card generation from SHOP_OPEN to BLIND_REWARDS_END (reduce-game.ts:382-386). Packs are now only generated when starting a new shop session, not when returning from pack opening.
