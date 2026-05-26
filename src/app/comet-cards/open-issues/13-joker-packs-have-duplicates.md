## Sometimes joker packs can include cards you already own

### Reproduction steps:

1. own a joker
2. open a lot of joker booster packs

### Expected

The booster packs should not contain owned jokers, or jokers presently in the shop (there's a joker that will allow duplicatest to appear but its not implemented yet)

### Actual

The pack may contain jokers the user owns or in the shop

### Issue status

Fixed - Modified `getRandomJokers` in `shop/utils.ts` to accept an `excludeIds` parameter. Updated `initializePackState` in `booster-pack/utils.ts` to pass owned joker IDs and shop joker IDs as exclusions when generating joker pack contents.

### Fix details

- `shop/utils.ts`: `getRandomJokers()` now filters the joker pool by `excludeIds` before random selection
- `booster-pack/utils.ts`: Collects owned joker IDs (`game.jokers`) and shop joker IDs (`game.shopState.cardsForSale`) and passes them to `getRandomJokers`
