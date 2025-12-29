## Liquidation voucher available without purchasing clearance voucher

### Reproduction steps:
1. play game with seed: 2025-12-29
2. play to round 3/8 without buying any vouchers and beat the small blind
3. observe the voucher in the shop

### Expected 
Liquidation voucher should not be appear in the shop if prerequesiste voucher is not owned (clearance)

### Actual
Liquidation voucher is for sale despite not having purchased clearance voucher

### Issue status
Fixed - Set liquidation voucher's dependentVoucher to 'clearanceSale' (vouchers.ts:74). Liquidation voucher will now only appear after purchasing Clearance Sale voucher.