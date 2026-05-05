import { uuid } from '@/app/comet-cards/domain/randomness'

import type { GameState } from '@/app/comet-cards/domain/game/types'
import type { VoucherType } from './types'

/**
 * Applies starting vouchers to game state during deck initialization.
 * This module intentionally avoids importing vouchers.ts to prevent
 * pulling in heavy shop/utils dependencies during the build.
 */
export function applyStartingVouchers(state: GameState, voucherTypes: VoucherType[]): GameState {
  const result = {
    ...state,
    vouchers: [
      ...state.vouchers,
      ...voucherTypes.map(type => ({ id: uuid(), type })),
    ],
    shopState: JSON.parse(JSON.stringify(state.shopState)),
    staticRules: { ...state.staticRules },
  }

  for (const vType of voucherTypes) {
    applyVoucherEffect(result, vType)
  }

  return result
}

function applyVoucherEffect(state: GameState, vType: VoucherType): void {
  switch (vType) {
    case 'crystalBall':
      state.maxConsumables += 1
      break
    case 'omenGlobe':
      state.staticRules.spectralInArcanaPacks = true
      break
    case 'telescope':
      state.staticRules.telescopeActive = true
      break
    case 'overstock':
    case 'overstockPlus':
      state.shopState.maxCardsForSale += 1
      break
    case 'tarotMerchant':
      state.shopState.tarotCard.multiplier *= 2
      break
    case 'tarotTycoon':
      state.shopState.tarotCard.multiplier *= 4
      break
    case 'planetMerchant':
      state.shopState.celestialMultiplier *= 2
      break
    case 'planetTycoon':
      state.shopState.celestialMultiplier *= 4
      break
    case 'grabber':
    case 'nachoTong':
      state.maxHands += 1
      state.gamePlayState.remainingHands += 1
      break
    case 'wasteful':
    case 'recyclomancy':
      state.maxDiscards += 1
      state.gamePlayState.remainingDiscards += 1
      break
    case 'antimatter':
      state.maxJokers += 1
      break
    case 'paintBrush':
    case 'palette':
      state.handSizeModifier += 1
      break
    case 'seedMoney':
      state.maxInterest = 10
      break
    case 'moneyTree':
      state.maxInterest = 20
      break
    // Other vouchers have shop-only effects that don't need init-time application
    default:
      break
  }
}
