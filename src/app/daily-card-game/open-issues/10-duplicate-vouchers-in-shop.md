## Using the tarot card "the magician" not working from a tarot pack

### Reproduction steps:

1. finish a blind to go to the shop
2. observe the jokers

### Expected

Jokers should only appear once in the shop, and should not appear if owned

### Actual

on occassion the same joker appears multiple times in the shop

### Issue status

Fixed

### Fix details

Modified `getRandomVoucherType` in `src/app/daily-card-game/domain/voucher/utils.ts` to filter out owned vouchers before random selection. Changed return type to `VoucherType | null` to handle the case when all vouchers are owned or no valid vouchers are available.
