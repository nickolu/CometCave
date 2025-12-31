import type { EffectContext } from '@/app/daily-card-game/domain/events/types'
import { getRandomBuyableCards } from '@/app/daily-card-game/domain/shop/utils'

import { VoucherDefinition, VoucherType } from './types'

export const overstock: VoucherDefinition = {
  type: 'overstock',
  name: 'Overstock',
  description: '+1 card slot available in shop (to 3 slots)',
  effects: [
    {
      event: { type: 'SHOP_BUY_VOUCHER', id: 'overstock' },
      priority: 1,
      apply: (ctx: EffectContext) => {
        ctx.game.shopState.maxCardsForSale += 1
        if (ctx.game.shopState.cardsForSale.length < ctx.game.shopState.maxCardsForSale) {
          const difference =
            ctx.game.shopState.maxCardsForSale - ctx.game.shopState.cardsForSale.length
          const newCards = getRandomBuyableCards(ctx.game, difference)
          ctx.game.shopState.cardsForSale.push(...newCards)
        }
      },
    },
  ],
  dependentVoucher: null,
}

export const overstockPlus: VoucherDefinition = {
  type: 'overstockPlus',
  name: 'Overstock Plus',
  description: '+1 card slot available in shop (to 4 slots)',
  effects: [
    {
      event: { type: 'SHOP_BUY_VOUCHER', id: 'overstockPlus' },
      priority: 1,
      apply: (ctx: EffectContext) => {
        ctx.game.shopState.maxCardsForSale += 1
      },
    },
  ],
  dependentVoucher: 'overstock',
}

export const clearanceSale: VoucherDefinition = {
  type: 'clearanceSale',
  name: 'Clearance Sale',
  description: 'All cards and packs in shop are 25% off',
  effects: [
    {
      event: { type: 'SHOP_BUY_VOUCHER', id: 'clearanceSale' },
      priority: 1,
      apply: (ctx: EffectContext) => {
        ctx.game.shopState.priceMultiplier = 0.75
      },
    },
  ],
  dependentVoucher: null,
}

export const liquidation: VoucherDefinition = {
  type: 'liquidation',
  name: 'Liquidation',
  description: 'All cards and packs in shop are 50% off',
  effects: [
    {
      event: { type: 'SHOP_BUY_VOUCHER', id: 'liquidation' },
      priority: 1,
      apply: (ctx: EffectContext) => {
        ctx.game.shopState.priceMultiplier = 0.5
      },
    },
  ],
  dependentVoucher: 'clearanceSale',
}

export const hone: VoucherDefinition = {
  type: 'hone',
  name: 'Hone',
  description: 'Foil, Holographic, and Polychrome cards appear 2x more often',
  effects: [
    {
      event: { type: 'SHOP_BUY_VOUCHER', id: 'hone' },
      priority: 1,
      apply: (ctx: EffectContext) => {
        // TODO: Implement hone effect
        throw new Error('Not implemented' + JSON.stringify(ctx))
      },
    },
  ],
  dependentVoucher: null,
}

export const glowUp: VoucherDefinition = {
  type: 'glowUp',
  name: 'Glow Up',
  description: 'Foil, Holographic, and Polychrome cards appear 4x more often',
  effects: [
    {
      event: { type: 'SHOP_BUY_VOUCHER', id: 'glowUp' },
      priority: 1,
      apply: (ctx: EffectContext) => {
        // TODO: Implement glow up effect
        throw new Error('Not implemented' + JSON.stringify(ctx))
      },
    },
  ],
  dependentVoucher: null,
}

export const rerollSurplus: VoucherDefinition = {
  type: 'rerollSurplus',
  name: 'Reroll Surplus',
  description: 'Rerolls cost $2 less',
  effects: [
    {
      event: { type: 'SHOP_BUY_VOUCHER', id: 'rerollSurplus' },
      priority: 1,
      apply: (ctx: EffectContext) => {
        // TODO: Implement reroll surplus effect
        throw new Error('Not implemented' + JSON.stringify(ctx))
      },
    },
  ],
  dependentVoucher: null,
}

export const rerollGlut: VoucherDefinition = {
  type: 'rerollGlut',
  name: 'Reroll Glut',
  description: 'Rerolls cost an additional $2 less',
  effects: [
    {
      event: { type: 'SHOP_BUY_VOUCHER', id: 'rerollGlut' },
      priority: 1,
      apply: (ctx: EffectContext) => {
        // TODO: Implement reroll glut effect
        throw new Error('Not implemented' + JSON.stringify(ctx))
      },
    },
  ],
  dependentVoucher: null,
}

export const crystalBall: VoucherDefinition = {
  type: 'crystalBall',
  name: 'Crystal Ball',
  description: '+1 consumable slot',
  effects: [
    {
      event: { type: 'SHOP_BUY_VOUCHER', id: 'crystalBall' },
      priority: 1,
      apply: (ctx: EffectContext) => {
        // TODO: Implement crystal ball effect
        throw new Error('Not implemented' + JSON.stringify(ctx))
      },
    },
  ],
  dependentVoucher: null,
}

export const omenGlobe: VoucherDefinition = {
  type: 'omenGlobe',
  name: 'Omen Globe',
  description: 'Spectral cards may appear in any of the Arcana Packs',
  effects: [
    {
      event: { type: 'SHOP_BUY_VOUCHER', id: 'omenGlobe' },
      priority: 1,
      apply: (ctx: EffectContext) => {
        // TODO: Implement omen globe effect
        throw new Error('Not implemented' + JSON.stringify(ctx))
      },
    },
  ],
  dependentVoucher: null,
}

export const telescope: VoucherDefinition = {
  type: 'telescope',
  name: 'Telescope',
  description: 'Celestial Packs always contain the Planet card for your most played poker hand',
  effects: [
    {
      event: { type: 'SHOP_BUY_VOUCHER', id: 'telescope' },
      priority: 1,
      apply: (ctx: EffectContext) => {
        // TODO: Implement telescope effect
        throw new Error('Not implemented' + JSON.stringify(ctx))
      },
    },
  ],
  dependentVoucher: null,
}

export const observatory: VoucherDefinition = {
  type: 'observatory',
  name: 'Observatory',
  description: 'Planet cards in your consumable area give X1.5 Mult for their specified poker hand',
  effects: [
    {
      event: { type: 'SHOP_BUY_VOUCHER', id: 'observatory' },
      priority: 1,
      apply: (ctx: EffectContext) => {
        // TODO: Implement observatory effect
        throw new Error('Not implemented' + JSON.stringify(ctx))
      },
    },
  ],
  dependentVoucher: null,
}

export const grabber: VoucherDefinition = {
  type: 'grabber',
  name: 'Grabber',
  description: 'Permanently gain +1 hand per round',
  effects: [
    {
      event: { type: 'SHOP_BUY_VOUCHER', id: 'grabber' },
      priority: 1,
      apply: (ctx: EffectContext) => {
        // TODO: Implement grabber effect
        throw new Error('Not implemented' + JSON.stringify(ctx))
      },
    },
  ],
  dependentVoucher: null,
}

export const nachoTong: VoucherDefinition = {
  type: 'nachoTong',
  name: 'Nacho Tong',
  description: 'Permanently gain an additional +1 hand per round',
  effects: [
    {
      event: { type: 'SHOP_BUY_VOUCHER', id: 'nachoTong' },
      priority: 1,
      apply: (ctx: EffectContext) => {
        // TODO: Implement nacho tong effect
        throw new Error('Not implemented' + JSON.stringify(ctx))
      },
    },
  ],
  dependentVoucher: null,
}

export const wasteful: VoucherDefinition = {
  type: 'wasteful',
  name: 'Wasteful',
  description: 'Permanently gain +1 discard each round',
  effects: [
    {
      event: { type: 'SHOP_BUY_VOUCHER', id: 'wasteful' },
      priority: 1,
      apply: (ctx: EffectContext) => {
        // TODO: Implement wasteful effect
        throw new Error('Not implemented' + JSON.stringify(ctx))
      },
    },
  ],
  dependentVoucher: null,
}

export const recyclomancy: VoucherDefinition = {
  type: 'recyclomancy',
  name: 'Recyclomancy',
  description: 'Permanently gain an additional +1 discard each round',
  effects: [
    {
      event: { type: 'SHOP_BUY_VOUCHER', id: 'recyclomancy' },
      priority: 1,
      apply: (ctx: EffectContext) => {
        // TODO: Implement recyclomancy effect
        throw new Error('Not implemented' + JSON.stringify(ctx))
      },
    },
  ],
  dependentVoucher: null,
}

export const tarotMerchant: VoucherDefinition = {
  type: 'tarotMerchant',
  name: 'Tarot Merchant',
  description: 'Tarot cards appear 2X more frequently in the shop',
  effects: [
    {
      event: { type: 'SHOP_BUY_VOUCHER', id: 'tarotMerchant' },
      priority: 1,
      apply: (ctx: EffectContext) => {
        // TODO: Implement tarot merchant effect
        throw new Error('Not implemented' + JSON.stringify(ctx))
      },
    },
  ],
  dependentVoucher: null,
}

export const tarotTycoon: VoucherDefinition = {
  type: 'tarotTycoon',
  name: 'Tarot Tycoon',
  description: 'Tarot cards appear 4X more frequently in the shop',
  effects: [
    {
      event: { type: 'SHOP_BUY_VOUCHER', id: 'tarotTycoon' },
      priority: 1,
      apply: (ctx: EffectContext) => {
        // TODO: Implement tarot tycoon effect
        throw new Error('Not implemented' + JSON.stringify(ctx))
      },
    },
  ],
  dependentVoucher: null,
}

export const planetMerchant: VoucherDefinition = {
  type: 'planetMerchant',
  name: 'Planet Merchant',
  description: 'Planet cards appear 2X more frequently in the shop',
  effects: [
    {
      event: { type: 'SHOP_BUY_VOUCHER', id: 'planetMerchant' },
      priority: 1,
      apply: (ctx: EffectContext) => {
        // TODO: Implement planet merchant effect
        throw new Error('Not implemented' + JSON.stringify(ctx))
      },
    },
  ],
  dependentVoucher: null,
}

export const planetTycoon: VoucherDefinition = {
  type: 'planetTycoon',
  name: 'Planet Tycoon',
  description: 'Planet cards appear 4X more frequently in the shop',
  effects: [
    {
      event: { type: 'SHOP_BUY_VOUCHER', id: 'planetTycoon' },
      priority: 1,
      apply: (ctx: EffectContext) => {
        // TODO: Implement planet tycoon effect
        throw new Error('Not implemented' + JSON.stringify(ctx))
      },
    },
  ],
  dependentVoucher: null,
}

export const seedMoney: VoucherDefinition = {
  type: 'seedMoney',
  name: 'Seed Money',
  description: 'Raise the cap on interest earned in each round to $10',
  effects: [
    {
      event: { type: 'SHOP_BUY_VOUCHER', id: 'seedMoney' },
      priority: 1,
      apply: (ctx: EffectContext) => {
        // TODO: Implement seed money effect
        throw new Error('Not implemented' + JSON.stringify(ctx))
      },
    },
  ],
  dependentVoucher: null,
}

export const moneyTree: VoucherDefinition = {
  type: 'moneyTree',
  name: 'Money Tree',
  description: 'Raise the cap on interest earned in each round to $20',
  effects: [
    {
      event: { type: 'SHOP_BUY_VOUCHER', id: 'moneyTree' },
      priority: 1,
      apply: (ctx: EffectContext) => {
        // TODO: Implement money tree effect
        throw new Error('Not implemented' + JSON.stringify(ctx))
      },
    },
  ],
  dependentVoucher: null,
}

export const blank: VoucherDefinition = {
  type: 'blank',
  name: 'Blank',
  description: 'Does nothing?',
  effects: [
    {
      event: { type: 'SHOP_BUY_VOUCHER', id: 'blank' },
      priority: 1,
      apply: (ctx: EffectContext) => {
        // TODO: Implement blank effect
        throw new Error('Not implemented' + JSON.stringify(ctx))
      },
    },
  ],
  dependentVoucher: null,
}

export const antimatter: VoucherDefinition = {
  type: 'antimatter',
  name: 'Antimatter',
  description: '+1 Joker slot',
  effects: [
    {
      event: { type: 'SHOP_BUY_VOUCHER', id: 'antimatter' },
      priority: 1,
      apply: (ctx: EffectContext) => {
        // TODO: Implement antimatter effect
        throw new Error('Not implemented' + JSON.stringify(ctx))
      },
    },
  ],
  dependentVoucher: null,
}

export const magicTrick: VoucherDefinition = {
  type: 'magicTrick',
  name: 'Magic Trick',
  description: 'Playing cards can be purchased from the shop',
  effects: [
    {
      event: { type: 'SHOP_BUY_VOUCHER', id: 'magicTrick' },
      priority: 1,
      apply: (ctx: EffectContext) => {
        // TODO: Implement magic trick effect
        throw new Error('Not implemented' + JSON.stringify(ctx))
      },
    },
  ],
  dependentVoucher: null,
}

export const illusion: VoucherDefinition = {
  type: 'illusion',
  name: 'Illusion',
  description: 'Playing cards in shop may have an Enhancement, Edition, and/or a Seal',
  effects: [
    {
      event: { type: 'SHOP_BUY_VOUCHER', id: 'illusion' },
      priority: 1,
      apply: (ctx: EffectContext) => {
        // TODO: Implement illusion effect
        throw new Error('Not implemented' + JSON.stringify(ctx))
      },
    },
  ],
  dependentVoucher: null,
}

export const hieroglyph: VoucherDefinition = {
  type: 'hieroglyph',
  name: 'Hieroglyph',
  description: '-1 Ante, -1 hand each round',
  effects: [
    {
      event: { type: 'SHOP_BUY_VOUCHER', id: 'hieroglyph' },
      priority: 1,
      apply: (ctx: EffectContext) => {
        // TODO: Implement hieroglyph effect
        throw new Error('Not implemented' + JSON.stringify(ctx))
      },
    },
  ],
  dependentVoucher: null,
}

export const petroglyph: VoucherDefinition = {
  type: 'petroglyph',
  name: 'Petroglyph',
  description: '-1 Ante, -1 discard each round',
  effects: [
    {
      event: { type: 'SHOP_BUY_VOUCHER', id: 'petroglyph' },
      priority: 1,
      apply: (ctx: EffectContext) => {
        // TODO: Implement petroglyph effect
        throw new Error('Not implemented' + JSON.stringify(ctx))
      },
    },
  ],
  dependentVoucher: null,
}

export const directorsCut: VoucherDefinition = {
  type: 'directorsCut',
  name: "Director's Cut",
  description: 'Reroll Boss Blind 1 time per Ante, $10 per roll',
  effects: [
    {
      event: { type: 'SHOP_BUY_VOUCHER', id: 'directorsCut' },
      priority: 1,
      apply: (ctx: EffectContext) => {
        // TODO: Implement directors cut effect
        throw new Error('Not implemented' + JSON.stringify(ctx))
      },
    },
  ],
  dependentVoucher: null,
}

export const retcon: VoucherDefinition = {
  type: 'retcon',
  name: 'Retcon',
  description: 'Reroll Boss Blind unlimited times, $10 per roll',
  effects: [
    {
      event: { type: 'SHOP_BUY_VOUCHER', id: 'retcon' },
      priority: 1,
      apply: (ctx: EffectContext) => {
        // TODO: Implement retcon effect
        throw new Error('Not implemented' + JSON.stringify(ctx))
      },
    },
  ],
  dependentVoucher: null,
}

export const paintBrush: VoucherDefinition = {
  type: 'paintBrush',
  name: 'Paint Brush',
  description: '+1 Hand Size',
  effects: [
    {
      event: { type: 'SHOP_BUY_VOUCHER', id: 'paintBrush' },
      priority: 1,
      apply: (ctx: EffectContext) => {
        // TODO: Implement paint brush effect
        throw new Error('Not implemented' + JSON.stringify(ctx))
      },
    },
  ],
  dependentVoucher: null,
}

export const palette: VoucherDefinition = {
  type: 'palette',
  name: 'Palette',
  description: '+1 Hand Size',
  effects: [
    {
      event: { type: 'SHOP_BUY_VOUCHER', id: 'palette' },
      priority: 1,
      apply: (ctx: EffectContext) => {
        // TODO: Implement palette effect
        throw new Error('Not implemented' + JSON.stringify(ctx))
      },
    },
  ],
  dependentVoucher: null,
}

export const implementedVouchers: VoucherType[] = [
  'overstock',
  'overstockPlus',
  'clearanceSale',
  'liquidation',
]

export const vouchers: Record<VoucherType, VoucherDefinition> = {
  overstock,
  overstockPlus,
  clearanceSale,
  liquidation,
  hone,
  glowUp,
  rerollSurplus,
  rerollGlut,
  crystalBall,
  omenGlobe,
  telescope,
  observatory,
  grabber,
  nachoTong,
  wasteful,
  recyclomancy,
  tarotMerchant,
  tarotTycoon,
  planetMerchant,
  planetTycoon,
  seedMoney,
  moneyTree,
  blank,
  antimatter,
  magicTrick,
  illusion,
  hieroglyph,
  petroglyph,
  directorsCut,
  retcon,
  paintBrush,
  palette,
}
/*
Vouchers

Hone
Hone
Foil, Holographic, and Polychrome cards appear 2x more often	
Glow Up
Glow Up
Foil, Holographic, and Polychrome cards appear 4x more often	Have at least 5 Joker cards with Foil, Holographic, or Polychrome (or Negative) effect	Polychrome on Jokers actually appears 3x more often for Hone and 7x more often for Glow Up
Reroll Surplus
Reroll Surplus
Rerolls cost $2 less	
Reroll Glut
Reroll Glut
Rerolls cost an additional $2 less	Reroll the shop a total of 100 times	
Crystal Ball
Crystal Ball
+1 consumable slot	
Omen Globe
Omen Globe
Spectral cards may appear in any of the Arcana Packs	Use a total of 25 Tarot cards from booster packs	Omen Globe has a 20% individual chance to replace the Tarot card with a Spectral card for every card in the Arcana Pack
Telescope
Telescope
Celestial Packs always contain the Planet card for your most played poker hand	
Observatory
Observatory
Planet cards in your consumable area give X1.5 Mult for their specified poker hand	Use a total of 25 Planet cards from booster packs	Telescope picks the higher tier hand in case of multiple most played hands
Grabber
Grabber
Permanently gain +1 hand per round	
Nacho Tong
Nacho Tong
Permanently gain an additional +1 hand per round	Play a total of 2500 cards	
Wasteful
Wasteful
Permanently gain +1 discard each round	
Recyclomancy
Recyclomancy
Permanently gain an additional +1 discard each round	Discard a total of 2500 cards	
Tarot Merchant
Tarot Merchant
Tarot cards appear 2X more frequently in the shop	
Tarot Tycoon
Tarot Tycoon
Tarot cards appear 4X more frequently in the shop	Buy a total of 50 Tarot cards from the shop	For details, see The Shop#Vouchers
Planet Merchant
Planet Merchant
Planet cards appear 2X more frequently in the shop	
Planet Tycoon
Planet Tycoon
Planet cards appear 4X more frequently in the shop	Buy a total of 50 Planet cards from the shop	For details, see The Shop#Vouchers
Seed Money
Seed Money
Raise the cap on interest earned in each round to $10	
Money Tree
Money Tree
Raise the cap on interest earned in each round to $20	Max out the interest per round earnings for ten consecutive rounds	Does nothing when playing the Green Deck.
Blank
Blank
Does nothing?	
Antimatter
Antimatter
+1 Joker slot	Redeem Blank 10 total times	The Antimatter Voucher is always displayed in game as if it was a negative edition and applies the same effect as negative Jokers
Magic Trick
Magic Trick
Playing cards can be purchased from the shop	
Illusion
Illusion
Playing cards in shop may have an Enhancement, Edition, and/or a Seal	Buy a total of 20 Playing cards from the shop	Illusion is currently (v1.0.1o-FULL) bugged, and cards in the shop cannot have seals, only enhancements and/or editions, and is unaffected by Hone/Glow Up.
Hieroglyph
Hieroglyph
-1 Ante,
-1 hand each round	
Petroglyph
Petroglyph
-1 Ante,
-1 discard each round	Reach Ante level 12	
Director's Cut
Director's Cut
Reroll Boss Blind 1 time per Ante, $10 per roll	
Retcon
Retcon
Reroll Boss Blind unlimited times, $10 per roll	Discover 25 Blinds	
Paint Brush
Paint Brush
+1 Hand Size	
Palette
Palette
+1 Hand Size again	Reduce your hand size down to 5 cards
*/
