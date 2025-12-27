import type { Effect } from '@/app/daily-card-game/domain/events/types'

export type VoucherType =
  | 'overstock'
  | 'overstockPlus'
  | 'clearanceSale'
  | 'liquidation'
  | 'hone'
  | 'glowUp'
  | 'rerollSurplus'
  | 'rerollGlut'
  | 'crystalBall'
  | 'omenGlobe'
  | 'telescope'
  | 'observatory'
  | 'grabber'
  | 'nachoTong'
  | 'wasteful'
  | 'recyclomancy'
  | 'tarotMerchant'
  | 'tarotTycoon'
  | 'planetMerchant'
  | 'planetTycoon'
  | 'seedMoney'
  | 'moneyTree'
  | 'blank'
  | 'antimatter'
  | 'magicTrick'
  | 'illusion'
  | 'hieroglyph'
  | 'petroglyph'
  | 'directorsCut'
  | 'retcon'
  | 'paintBrush'
  | 'palette'

export interface VoucherState {
  id: string
  type: VoucherType
}

export interface VoucherDefinition {
  type: VoucherType
  name: string
  description: string
  effects: Effect[]
  dependentVoucher: VoucherType | null
}

/*
Vouchers
Base Voucher	Upgraded Voucher	Note(s)
Name	Effect	Name	Effect	Unlock condition	
Overstock
Overstock
+1 card slot available in shop (to 3 slots)	
Overstock Plus
Overstock Plus
+1 card slot available in shop (to 4 slots)	Spend a total of $2500 at the shop	Also immediately restocks any empty card slots in the Shop when purchased
Clearance Sale
Clearance Sale
All cards and packs in shop are 25% off	
Liquidation
Liquidation
All cards and packs in shop are 50% off	Redeem at least 10 Voucher cards in one run	Also reduces the sell value of your present jokers

Prices are rounded half down
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
