## Using the tarot card "the magician" not working from a tarot pack

### Reproduction steps:

1. finish a blind to go to the shop
2. observe the jokers

### Expected

Jokers should only appear once in the shop, and should not appear if owned

### Actual

on occassion the same joker appears multiple times in the shop

### Issue status

Fixed - Added deduplication logic to getRandomBuyableCards (utils.ts:234-245). The function now removes duplicate indices and generates additional unique indices if needed, ensuring each card (including jokers) appears only once in the shop.
