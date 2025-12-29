## Using the liquidation or clearance sale vouchers has no impact on pack prices

### Reproduction steps:

1. buy the clearance sale voucher and/or liquidation voucher
2. review the pack prices

### Expected

Pack prices should be discounted

### Actual

Pack prices remain the same

### Notes

similar to to /open-issues/01-price-reduction-vouchers.md

### Issue status

Fixed - Applied priceMultiplier to pack prices in three places: display price (booster-packs.tsx:27, 45), affordability check (booster-packs.tsx:27-28), and actual money deduction (reduce-game.ts:623). Pack prices now correctly show and apply the 25% or 50% discount from Clearance Sale and Liquidation vouchers.
