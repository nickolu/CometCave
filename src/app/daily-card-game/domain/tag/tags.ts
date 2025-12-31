import type { EffectContext } from '@/app/daily-card-game/domain/events/types'
import { getRandomUncommonJoker, initializeJoker } from '@/app/daily-card-game/domain/joker/utils'

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
  effects: [],
}

const negative: TagDefinition = {
  tagType: 'negative',
  name: 'Negative',
  benefit:
    'The next base edition Joker you find in a Shop becomes Negative (+1 joker slot) and free.',
  minimumAnte: 1,
  effects: [],
}

const foil: TagDefinition = {
  tagType: 'foil',
  name: 'Foil',
  benefit: 'The next base edition Joker you find in a Shop becomes Foil (+50 Chips) and free.',
  minimumAnte: 1,
  effects: [],
}

const holographic: TagDefinition = {
  tagType: 'holographic',
  name: 'Holographic',
  benefit:
    'The next base edition Joker you find in a Shop becomes Holographic (+10 Mult) and free.',
  minimumAnte: 1,
  effects: [],
}

const polychrome: TagDefinition = {
  tagType: 'polychrome',
  name: 'Polychrome',
  benefit:
    'The next base edition Joker you find in a Shop becomes Polychrome (X1.5 Mult) and free.',
  minimumAnte: 1,
  effects: [],
}

const investment: TagDefinition = {
  tagType: 'investment',
  name: 'Investment',
  benefit: 'Gain $25 after defeating the next Boss Blind.',
  minimumAnte: 1,
  effects: [],
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
  effects: [],
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
  effects: [],
}

const garbage: TagDefinition = {
  tagType: 'garbage',
  name: 'Garbage',
  benefit: 'Gain $1 for each unused discard this run.',
  minimumAnte: 2,
  effects: [],
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
  effects: [],
}

const d6: TagDefinition = {
  tagType: 'd6',
  name: 'D6',
  benefit: 'In the next Shop, Rerolls start at $0.',
  minimumAnte: 1,
  effects: [],
}

const topUp: TagDefinition = {
  tagType: 'topUp',
  name: 'Top-up',
  benefit: 'Create up to 2 Common Jokers (if you have space).',
  minimumAnte: 2,
  effects: [],
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
  effects: [],
}

const economy: TagDefinition = {
  tagType: 'economy',
  name: 'Economy',
  benefit: 'Doubles your money (adds a maximum of $40).',
  minimumAnte: 1,
  effects: [],
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
