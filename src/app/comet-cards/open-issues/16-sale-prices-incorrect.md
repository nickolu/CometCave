## Selling cards should reward less than the price to buy the card. Review the sale prices and how they should relate to purchase prices

### Reproduction steps:

n/a

### Expected

n/a

### Actual

n/a

### Issue status

Fixed

### Fix details

Extracted sell price logic into `sell-utils.ts` with `getJokerSellValue()` and `getConsumableSellValue()`. Both return `floor(price/2)` as the base sell value, ensuring sell price is always less than buy price. Jokers additionally include `bonusSellValue` from game effects (e.g., Gift Card joker), which is intentional Balatro behavior. See commit 78d0319.
