## Using the fool doesn't do anything

### Reproduction steps:

1. buy and use a celestial card
2. buy the fool from the shop
3. in the shop, select the fool from consumables
4. click "use"

### Expected

The last tarot or celestial used should be added to consumables

### Actual

The fool card is added to consumables instead of the last used tarot or celestial card

### Notes

likely related to /open-issues/05-the-fool-buy-and-use.md

### Issue status

Fixed - Modified The Fool's effect (tarot-cards.ts:30-37) to exclude The Fool when searching for the last used card. Updated isPlayable check (tarot-cards.ts:12-25) to prevent using The Fool if it was the most recent card used. The Fool now correctly creates a copy of the previously used non-Fool tarot/celestial card and cannot be spammed multiple times in a row.
