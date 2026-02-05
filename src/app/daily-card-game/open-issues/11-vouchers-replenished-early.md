## Vouchers should only be replenished at the start of a new round (first shop after small blind)

### Reproduction steps:

1. complete a small blind and go to the shop
2. buy the voucher
3. proceed and complete the big blind and go to the shop
4. observe the voucher

### Expected

No voucher should be present

### Actual

A new voucher is loaded in the shop

### Issue status

Fixed

### Fix details

Modified voucher generation in `src/app/daily-card-game/domain/game/reduce-game.ts` in the BLIND_REWARDS_END event handler to only generate a new voucher when the completed blind is a small blind. This ensures vouchers are only replenished at the start of a new round.
