## Using the tarot card "the magician" not working from a tarot pack

### Reproduction steps:

1. open a tarot pack from the shop
2. select two cards by clicking them
3. select the magician
4. click 'use'
5. start the next blind
6. view the deck

### Expected

The previously selected cards should have the 'lucky' enchantment applied in the full deck, remaining deck, and hands (whereever they appear)

### Actual

The cards selected in the pack appear to have no enchantment applied
A duplicate card appeared in the hand (this may be unrelated/coincidence)


### Issue status

Fixed - Moved the cleanup code (clearing selectedCardIds and closing pack) to AFTER effect dispatching in both SHOP_USE_TAROT_CARD_FROM_PACK (reduce-game.ts:486-490) and SHOP_USE_CELESTIAL_CARD_FROM_PACK (reduce-game.ts:533-537). Previously, selectedCardIds was cleared BEFORE The Magician's effect ran, so it had no target cards to enchant. Now effects run first, then cleanup happens.
