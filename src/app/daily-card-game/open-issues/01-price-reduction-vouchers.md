## Liquidation voucher doesn't have any effect

### Reproduction steps:
1. purchase the clearance sale voucher
2. observe prices 

### Expected 
Prices in the shop should be reduced by 25%

### Actual
Prices are the same

### Issue status
Fixed - Updated shop.tsx:90 and shop.tsx:98 to display discounted prices using `Math.floor(selectedCard.price * game.shopState.priceMultiplier)`
