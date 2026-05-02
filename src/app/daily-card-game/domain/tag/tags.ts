import type { EffectContext } from '@/app/daily-card-game/domain/events/types'
import { getRandomCommonJoker, getRandomRareJoker, getRandomUncommonJoker, initializeJoker } from '@/app/daily-card-game/domain/joker/utils'
import { buildSeedString, getRandomNumberWithSeed } from '@/app/daily-card-game/domain/randomness'
import { getRandomBossBlind } from '@/app/daily-card-game/domain/round/boss-blinds'

import { TagDefinition, TagType } from './types'

const uncommon: TagDefinition = {
  tagType: 'uncommon',
  name: 'Uncommon',
  benefit: 'The next shop will have a free Uncommon Joker.',
  minimumAnte: 1,
  effects: [
    {
      event: { type: 'SHOP_OPEN' },
      priority: 1,
      apply: (ctx: EffectContext) => {
        const randomUncommonJoker = getRandomUncommonJoker(ctx.game)
        const jokerState = initializeJoker(randomUncommonJoker, ctx.game)
        ctx.game.shopState.guaranteedForSaleItems.push({
          type: 'jokerCard',
          card: jokerState,
          price: 0,
        })
        // remove the first uncommon tag from owned tags
        const uncommonTag = ctx.game.tags.find(tag => tag.tagType === 'uncommon')
        if (uncommonTag) {
          ctx.game.tags = ctx.game.tags.filter(tag => tag.id !== uncommonTag.id)
        }
      },
    },
  ],
}

const rare: TagDefinition = {
  tagType: 'rare',
  name: 'Rare',
  benefit: 'The next shop will have a free Rare Joker.',
  minimumAnte: 1,
  effects: [
    {
      event: { type: 'SHOP_OPEN' },
      priority: 1,
      apply: (ctx: EffectContext) => {
        const randomRareJoker = getRandomRareJoker(ctx.game)
        if (randomRareJoker) {
          const jokerState = initializeJoker(randomRareJoker, ctx.game)
          ctx.game.shopState.guaranteedForSaleItems.push({
            type: 'jokerCard',
            card: jokerState,
            price: 0,
          })
        }
        const rareTag = ctx.game.tags.find(tag => tag.tagType === 'rare')
        if (rareTag) {
          ctx.game.tags = ctx.game.tags.filter(tag => tag.id !== rareTag.id)
        }
      },
    },
  ],
}

const negative: TagDefinition = {
  tagType: 'negative',
  name: 'Negative',
  benefit:
    'The next base edition Joker you find in a Shop becomes Negative (+1 joker slot) and free.',
  minimumAnte: 1,
  effects: [
    {
      event: { type: 'SHOP_OPEN' },
      priority: 1,
      apply: (ctx: EffectContext) => {
        const randomJoker = getRandomCommonJoker(ctx.game, 'negative')
        if (randomJoker) {
          const jokerState = initializeJoker(randomJoker, ctx.game)
          jokerState.edition = 'negative'
          ctx.game.shopState.guaranteedForSaleItems.push({
            type: 'jokerCard',
            card: jokerState,
            price: 0,
          })
          ctx.game.maxJokers += 1
        }
        const negTag = ctx.game.tags.find(tag => tag.tagType === 'negative')
        if (negTag) {
          ctx.game.tags = ctx.game.tags.filter(tag => tag.id !== negTag.id)
        }
      },
    },
  ],
}

const foil: TagDefinition = {
  tagType: 'foil',
  name: 'Foil',
  benefit: 'The next base edition Joker you find in a Shop becomes Foil (+50 Chips) and free.',
  minimumAnte: 1,
  effects: [
    {
      event: { type: 'SHOP_OPEN' },
      priority: 1,
      apply: (ctx: EffectContext) => {
        const randomJoker = getRandomCommonJoker(ctx.game, 'foil')
        if (randomJoker) {
          const jokerState = initializeJoker(randomJoker, ctx.game)
          jokerState.edition = 'foil'
          ctx.game.shopState.guaranteedForSaleItems.push({
            type: 'jokerCard',
            card: jokerState,
            price: 0,
          })
        }
        const foilTag = ctx.game.tags.find(tag => tag.tagType === 'foil')
        if (foilTag) {
          ctx.game.tags = ctx.game.tags.filter(tag => tag.id !== foilTag.id)
        }
      },
    },
  ],
}

const holographic: TagDefinition = {
  tagType: 'holographic',
  name: 'Holographic',
  benefit:
    'The next base edition Joker you find in a Shop becomes Holographic (+10 Mult) and free.',
  minimumAnte: 1,
  effects: [
    {
      event: { type: 'SHOP_OPEN' },
      priority: 1,
      apply: (ctx: EffectContext) => {
        const randomJoker = getRandomCommonJoker(ctx.game, 'holographic')
        if (randomJoker) {
          const jokerState = initializeJoker(randomJoker, ctx.game)
          jokerState.edition = 'holographic'
          ctx.game.shopState.guaranteedForSaleItems.push({
            type: 'jokerCard',
            card: jokerState,
            price: 0,
          })
        }
        const holoTag = ctx.game.tags.find(tag => tag.tagType === 'holographic')
        if (holoTag) {
          ctx.game.tags = ctx.game.tags.filter(tag => tag.id !== holoTag.id)
        }
      },
    },
  ],
}

const polychrome: TagDefinition = {
  tagType: 'polychrome',
  name: 'Polychrome',
  benefit:
    'The next base edition Joker you find in a Shop becomes Polychrome (X1.5 Mult) and free.',
  minimumAnte: 1,
  effects: [
    {
      event: { type: 'SHOP_OPEN' },
      priority: 1,
      apply: (ctx: EffectContext) => {
        const randomJoker = getRandomCommonJoker(ctx.game, 'polychrome')
        if (randomJoker) {
          const jokerState = initializeJoker(randomJoker, ctx.game)
          jokerState.edition = 'polychrome'
          ctx.game.shopState.guaranteedForSaleItems.push({
            type: 'jokerCard',
            card: jokerState,
            price: 0,
          })
        }
        const polyTag = ctx.game.tags.find(tag => tag.tagType === 'polychrome')
        if (polyTag) {
          ctx.game.tags = ctx.game.tags.filter(tag => tag.id !== polyTag.id)
        }
      },
    },
  ],
}

const investment: TagDefinition = {
  tagType: 'investment',
  name: 'Investment',
  benefit: 'Gain $25 after defeating the next Boss Blind.',
  minimumAnte: 1,
  effects: [
    {
      event: { type: 'SHOP_OPEN' },
      priority: 1,
      apply: (ctx: EffectContext) => {
        // Check if the boss blind was just completed (roundIndex advanced)
        const prevRound = ctx.game.rounds[ctx.game.roundIndex - 1]
        if (prevRound && prevRound.bossBlind.status === 'completed') {
          ctx.game.money += 25
          const investmentTag = ctx.game.tags.find(tag => tag.tagType === 'investment')
          if (investmentTag) {
            ctx.game.tags = ctx.game.tags.filter(tag => tag.id !== investmentTag.id)
          }
        }
      },
    },
  ],
}

const voucher: TagDefinition = {
  tagType: 'voucher',
  name: 'Voucher',
  benefit: 'Adds a Voucher to the next Shop.',
  minimumAnte: 1,
  effects: [],
}

const boss: TagDefinition = {
  tagType: 'boss',
  name: 'Boss',
  benefit: 'Re-rolls the next Boss Blind.',
  minimumAnte: 1,
  effects: [
    {
      event: { type: 'BOSS_BLIND_SELECTED' },
      priority: 0,
      apply: (ctx: EffectContext) => {
        const round = ctx.game.rounds[ctx.game.roundIndex]
        const seed = buildSeedString([ctx.game.gameSeed, ctx.game.roundIndex.toString(), 'boss-reroll'])
        const newBossBlind = getRandomBossBlind(ctx.game.roundIndex + 1, seed)
        round.bossBlindName = newBossBlind.name
        const bossTag = ctx.game.tags.find(tag => tag.tagType === 'boss')
        if (bossTag) {
          ctx.game.tags = ctx.game.tags.filter(tag => tag.id !== bossTag.id)
        }
      },
    },
  ],
}

const standard: TagDefinition = {
  tagType: 'standard',
  name: 'Standard',
  benefit: 'Immediately open a free Mega Standard Pack.',
  minimumAnte: 2,
  effects: [],
}

const charm: TagDefinition = {
  tagType: 'charm',
  name: 'Charm',
  benefit: 'Immediately open a free Mega Arcana Pack.',
  minimumAnte: 1,
  effects: [],
}

const meteor: TagDefinition = {
  tagType: 'meteor',
  name: 'Meteor',
  benefit: 'Immediately open a free Mega Celestial Pack.',
  minimumAnte: 2,
  effects: [],
}

const buffoon: TagDefinition = {
  tagType: 'buffoon',
  name: 'Buffoon',
  benefit: 'Immediately open a free Mega Buffoon Pack.',
  minimumAnte: 2,
  effects: [],
}

const handy: TagDefinition = {
  tagType: 'handy',
  name: 'Handy',
  benefit: 'Gain $1 for each hand played this run.',
  minimumAnte: 2,
  effects: [
    {
      event: { type: 'SHOP_OPEN' },
      priority: 1,
      apply: (ctx: EffectContext) => {
        ctx.game.money += ctx.game.handsPlayed
        const handyTag = ctx.game.tags.find(tag => tag.tagType === 'handy')
        if (handyTag) {
          ctx.game.tags = ctx.game.tags.filter(tag => tag.id !== handyTag.id)
        }
      },
    },
  ],
}

const garbage: TagDefinition = {
  tagType: 'garbage',
  name: 'Garbage',
  benefit: 'Gain $1 for each unused discard this run.',
  minimumAnte: 2,
  effects: [
    {
      event: { type: 'SHOP_OPEN' },
      priority: 1,
      apply: (ctx: EffectContext) => {
        ctx.game.money += ctx.game.gamePlayState.remainingDiscards
        const garbageTag = ctx.game.tags.find(tag => tag.tagType === 'garbage')
        if (garbageTag) {
          ctx.game.tags = ctx.game.tags.filter(tag => tag.id !== garbageTag.id)
        }
      },
    },
  ],
}

const ethereal: TagDefinition = {
  tagType: 'ethereal',
  name: 'Ethereal',
  benefit: 'Immediately open a free Spectral Pack.',
  minimumAnte: 2,
  effects: [],
}

const coupon: TagDefinition = {
  tagType: 'coupon',
  name: 'Coupon',
  benefit: 'In the next shop, initial Jokers, Consumables Cards and Booster Packs are free ($0).',
  minimumAnte: 1,
  effects: [],
}

const double: TagDefinition = {
  tagType: 'double',
  name: 'Double',
  benefit: 'Gives a copy of the next Tag selected (excluding Double Tags).',
  minimumAnte: 1,
  effects: [],
}

const juggle: TagDefinition = {
  tagType: 'juggle',
  name: 'Juggle',
  benefit: '+3 Hand Size for the next round only.',
  minimumAnte: 1,
  effects: [
    {
      event: { type: 'SHOP_OPEN' },
      priority: 1,
      apply: (ctx: EffectContext) => {
        ctx.game.handSizeModifier += 3
        const juggleTag = ctx.game.tags.find(tag => tag.tagType === 'juggle')
        if (juggleTag) {
          ctx.game.tags = ctx.game.tags.filter(tag => tag.id !== juggleTag.id)
        }
      },
    },
  ],
}

const d6: TagDefinition = {
  tagType: 'd6',
  name: 'D6',
  benefit: 'In the next Shop, Rerolls start at $0.',
  minimumAnte: 1,
  effects: [
    {
      event: { type: 'SHOP_OPEN' },
      priority: 1,
      apply: (ctx: EffectContext) => {
        ctx.game.shopState.freeRerolls += 100
        const d6Tag = ctx.game.tags.find(tag => tag.tagType === 'd6')
        if (d6Tag) {
          ctx.game.tags = ctx.game.tags.filter(tag => tag.id !== d6Tag.id)
        }
      },
    },
  ],
}

const topUp: TagDefinition = {
  tagType: 'topUp',
  name: 'Top-up',
  benefit: 'Create up to 2 Common Jokers (if you have space).',
  minimumAnte: 2,
  effects: [
    {
      event: { type: 'SHOP_OPEN' },
      priority: 1,
      apply: (ctx: EffectContext) => {
        const jokersToAdd = Math.min(2, ctx.game.maxJokers - ctx.game.jokers.length)
        for (let i = 0; i < jokersToAdd; i++) {
          const jokerDef = getRandomCommonJoker(ctx.game, String(i))
          if (jokerDef) {
            const jokerState = initializeJoker(jokerDef, ctx.game)
            ctx.game.jokers.push(jokerState)
          }
        }
        const topUpTag = ctx.game.tags.find(tag => tag.tagType === 'topUp')
        if (topUpTag) {
          ctx.game.tags = ctx.game.tags.filter(tag => tag.id !== topUpTag.id)
        }
      },
    },
  ],
}

const speed: TagDefinition = {
  tagType: 'speed',
  name: 'Speed',
  benefit: "Gives $5 for each Blind you've skipped this run.",
  minimumAnte: 1,
  effects: [],
}

const orbital: TagDefinition = {
  tagType: 'orbital',
  name: 'Orbital',
  benefit: 'Upgrades a specified random Poker Hand by three levels.',
  minimumAnte: 2,
  effects: [
    {
      event: { type: 'SHOP_OPEN' },
      priority: 1,
      apply: (ctx: EffectContext) => {
        const handIds = Object.keys(ctx.game.pokerHands)
        const seed = buildSeedString([ctx.game.gameSeed, ctx.game.roundIndex.toString(), 'orbital'])
        const randomIndex = getRandomNumberWithSeed(seed, 0, handIds.length - 1)
        const handId = handIds[randomIndex]
        ctx.game.pokerHands[handId as keyof typeof ctx.game.pokerHands].level += 3
        const orbitalTag = ctx.game.tags.find(tag => tag.tagType === 'orbital')
        if (orbitalTag) {
          ctx.game.tags = ctx.game.tags.filter(tag => tag.id !== orbitalTag.id)
        }
      },
    },
  ],
}

const economy: TagDefinition = {
  tagType: 'economy',
  name: 'Economy',
  benefit: 'Doubles your money (adds a maximum of $40).',
  minimumAnte: 1,
  effects: [
    {
      event: { type: 'SHOP_OPEN' },
      priority: 1,
      apply: (ctx: EffectContext) => {
        const gain = Math.min(ctx.game.money, 40)
        ctx.game.money += gain
        const economyTag = ctx.game.tags.find(tag => tag.tagType === 'economy')
        if (economyTag) {
          ctx.game.tags = ctx.game.tags.filter(tag => tag.id !== economyTag.id)
        }
      },
    },
  ],
}

export const tags: Record<TagType, TagDefinition> = {
  uncommon,
  rare,
  negative,
  foil,
  holographic,
  polychrome,
  investment,
  voucher,
  boss,
  standard,
  charm,
  meteor,
  buffoon,
  handy,
  garbage,
  ethereal,
  coupon,
  double,
  juggle,
  d6,
  topUp,
  speed,
  orbital,
  economy,
}
export const implementedTags: Partial<Record<TagType, TagDefinition>> = {
  uncommon,
  rare,
  d6,
  coupon,
  economy,
  juggle,
  handy,
  garbage,
  topUp,
  orbital,
  investment,
  boss,
  polychrome,
  holographic,
  foil,
  negative,
}

/* Tags

Tag	Name	Benefit	Notes	Ante
Uncommon tag	
Uncommon
The next shop will have a free Uncommon Joker.	
The Joker is extra generated, and guaranteed to appear in next shop, which is not affected by Vouchers that relatively lower the weight of Jokers in Shop (see The Shop#Vouchers), or certain Challenges that Jokers' spawn rate is set to 0. Can be stacked with Edition Tags, generating a free Joker with Editions.

1
Rare tag	
Rare
The next shop will have a free Rare Joker.	1
Negative tag	
Negative
The next base edition Joker you find in a Shop becomes Negative (+1 joker slot) and free.	
If there are no base edition Jokers in the next shop, these tags will instead be stored. Works with Uncommon and Rare Tag if the generated Joker doesn't have an Edition naturally. Can be stacked on one shop until there are no base edition Jokers.

2+
Foil tag	
Foil
The next base edition Joker you find in a Shop becomes Foil (+50 Chips) and free.	1
Holographic tag	
Holographic
The next base edition Joker you find in a Shop becomes Holographic (+10 Mult) and free.	1
Polychrome tag	
Polychrome
The next base edition Joker you find in a Shop becomes Polychrome (X1.5 Mult) and free.	1
Investment tag	
Investment
Gain $25 after defeating the next Boss Blind.	
Can be stacked on one Boss Blind, each adding additional $25 bonus.

1
Voucher tag	
Voucher
Adds a Voucher to the next Shop.	
Can be stacked on one shop until all available vouchers appear (excluding bought vouchers and upgrades of unbought vouchers). Added vouchers do not carry over to later shops in the ante.

1
Boss tag	
Boss
Re-rolls the next Boss Blind.	If the Director's Cut Director's Cut has been redeemed, using the Boss tag to re-roll the next Boss Blind will also use up the one Re-Roll option.	1
Standard tag	
Standard
Immediately open a free Mega Standard Pack.	
Other effects of opening Booster Packs (like Red Card Red Card and Hallucination Hallucination) can be activated as normal.

2+
Charm tag	
Charm
Immediately open a free Mega Arcana Pack.	1
Meteor tag	
Meteor
Immediately open a free Mega Celestial Pack.	2+
Buffoon tag	
Buffoon
Immediately open a free Mega Buffoon Pack.	2+
Handy tag	
Handy
Gain $1 for each hand played this run.		2+
Garbage tag	
Garbage
Gain $1 for each unused discard this run.		2+
Ethereal tag	
Ethereal
Immediately open a free Spectral Pack.	It is the only one among Pack-related Tags that does not give a Mega pack.
Other effects of opening Booster Packs (like Red Card Red Card and Hallucination Hallucination) can be activated as normal.

2+
Coupon tag	
Coupon
In the next shop, initial Jokers, Consumables Cards and Booster Packs are free ($0).	
Other parts of the shop (such as Vouchers and Items generated after rerolls) keep their usual costs.

1
Double tag	
Double
Gives a copy of the next Tag selected (excluding Double Tags).	
Can be stacked on one Tag earned, each adding one additional copy of (instead of doubling) that Tag.

1
Juggle tag	
Juggle
+3 Hand Size for the next round only.	
Can be stacked multiple times on the same round, each adding an additional +3 Hand size.

1
D6 tag	
D6
In the next Shop, Rerolls start at $0.	
The price will go up $1 per Reroll as normal.

1
Top-up tag	
Top-up
Create up to 2 Common Jokers (if you have space).	
The Jokers created cannot have Stickers, like Eternal/Perishable/Rental, even at higher stakes.

2+
Speed tag	
Speed
Gives $5 for each Blind you've skipped this run.	
Guaranteed to give at least $5, as it includes the Blind skipped to gain this tag.

1
Orbital tag	
Orbital
Upgrades a specified random Poker Hand by three levels.	
The hand can be a secret hand if it has already been played in this run.

2+
Economy tag	
Economy
Doubles your money (adds a maximum of $40).	
If your balance is negative your money is not doubled, instead giving you $0 and essentially wasting the tag.

1

*/
