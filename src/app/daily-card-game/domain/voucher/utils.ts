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

export function getRandomVoucherType(draft: GameState): VoucherType | null {
  const seed = buildSeedString([draft.gameSeed, draft.roundIndex.toString()])

  // Get owned voucher types
  const ownedVoucherTypes = draft.vouchers.map(v => v.type)

  const validVoucherTypes = implementedVouchers.filter(voucherType => {
    // Filter out already-owned vouchers
    if (ownedVoucherTypes.includes(voucherType)) return false

    // Check if dependency is met
    const dependentVoucher = vouchers[voucherType].dependentVoucher
    return dependentVoucher === null || draft.vouchers.some(v => v.type === dependentVoucher)
  })

  // If no valid vouchers available, return null
  if (validVoucherTypes.length === 0) return null

  const randomNumber = getRandomNumberWithSeed(seed, 0, validVoucherTypes.length - 1)
  return validVoucherTypes[randomNumber]
}
