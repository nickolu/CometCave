## When selecting "buy and use" when selecting the fool in the shop, it's added to consumables when it should not

### Reproduction steps:

1. select "the fool" joker in the shop
2. select "buy and use"

### Expected

The last tarot or celestial used should be added to consumables

### Actual

The fool card is added to consumables instead of the last used tarot or celestial card

### Notes

likely related to /open-issues/06-the-fool-doesnt-work.md

### Issue status

Fixed - Updated useBuyableTarotCard and useBuyableCelestialCard (utils.ts:141, utils.ts:83) to add cards to consumablesUsed instead of consumables. Modified The Fool's effect (tarot-cards.ts:30-37) to exclude The Fool when searching for the last used card. Updated isPlayable check (tarot-cards.ts:12-25) to prevent using The Fool twice in a row - it can only be used if the most recent card is NOT The Fool.
