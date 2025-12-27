import type { GameState } from '@/app/daily-card-game/domain/game/types'
import {
  buildSeedString,
  getRandomNumberWithSeed,
  uuid,
} from '@/app/daily-card-game/domain/randomness'

import { VoucherDefinition, VoucherState, VoucherType } from './types'
import { implementedVouchers, vouchers } from './vouchers'

export function initializeVoucherState(voucher: VoucherDefinition): VoucherState {
  return {
    id: uuid(),
    type: voucher.type,
  }
}

export function getRandomVoucherType(draft: GameState): VoucherType {
  const seed = buildSeedString([draft.gameSeed, draft.roundIndex.toString()])

  const validVoucherTypes = implementedVouchers.filter(voucherType => {
    const dependentVoucher = vouchers[voucherType].dependentVoucher
    return dependentVoucher === null || draft.vouchers.some(v => v.type === dependentVoucher)
  })

  const randomNumber = getRandomNumberWithSeed(seed, 0, Object.keys(validVoucherTypes).length - 1)
  return validVoucherTypes[randomNumber]
}
