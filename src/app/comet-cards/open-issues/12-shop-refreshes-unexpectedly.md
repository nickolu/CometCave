## After buying all jokers in the shop, the booster packs and cards for sale are regenerated unexpectedly

### Reproduction steps:

1. play game with seed '2026-01-02'
2. skip the small blind
3. play and beat the big blind
4. buy all booster packs in the shop
5. buy all the jokers in the shop (there should be two jokers for sale) so that the Cards for Sale is empty

### Expected

There should no longer be booster packs or cards for sale in the shop

### Actual

The booster packs and cards for sale are regenerated

### Issue status

fixed

### Fix details

- createed a shop state variable 'isOpen' to track if the shop is open between blinds
- use the new shop state variable to determine whether to init the shop when the shop UI loads
