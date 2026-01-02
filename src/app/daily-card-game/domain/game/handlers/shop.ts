import { Draft } from 'immer'

import {
  getPackDefinition,
  getRandomPacks,
  removeCardFromPack,
} from '@/app/daily-card-game/domain/booster-pack/utils'
import { celestialCards } from '@/app/daily-card-game/domain/consumable/celestial-cards'
import { tarotCards } from '@/app/daily-card-game/domain/consumable/tarot-cards'
import {
  isCelestialCardState,
  isTarotCardState,
} from '@/app/daily-card-game/domain/consumable/utils'
import { dispatchEffects } from '@/app/daily-card-game/domain/events/dispatch-effects'
import type {
  GameEvent,
  ShopBuyCardEvent,
  ShopBuyVoucherEvent,
  ShopOpenPackEvent,
  ShopSelectJokerFromPackEvent,
  ShopSelectPlayingCardFromPackEvent,
  ShopUseCelestialCardFromPackEvent,
  ShopUseSpectralCardFromPackEvent,
  ShopUseTarotCardFromPackEvent,
} from '@/app/daily-card-game/domain/events/types'
import {
  addOwnedCard,
  dealCardsFromDrawPile,
} from '@/app/daily-card-game/domain/game/card-registry-utils'
import { HAND_SIZE } from '@/app/daily-card-game/domain/game/constants'
import type { GameState } from '@/app/daily-card-game/domain/game/types'
import {
  collectEffects,
  getEffectContext,
  populateTags,
  shuffleCardIds,
} from '@/app/daily-card-game/domain/game/utils'
import { isJokerState } from '@/app/daily-card-game/domain/joker/utils'
import { isPlayingCardState } from '@/app/daily-card-game/domain/playing-card/utils'
import { buildSeedString } from '@/app/daily-card-game/domain/randomness'
import { blindIndices, getNextBlind } from '@/app/daily-card-game/domain/round/blinds'
import { getRandomBuyableCards } from '@/app/daily-card-game/domain/shop/utils'
import { spectralCards } from '@/app/daily-card-game/domain/spectral/spectal-cards'
import { isSpectralCardState } from '@/app/daily-card-game/domain/spectral/utils'
import { VOUCHER_PRICE } from '@/app/daily-card-game/domain/voucher/constants'
import { initializeVoucherState } from '@/app/daily-card-game/domain/voucher/utils'
import { vouchers } from '@/app/daily-card-game/domain/voucher/vouchers'

export function handleShopOpen(draft: GameState, event: GameEvent) {
  draft.shopState.isOpen = true
  // dispatch first to use any tag effects
  const ctx = getEffectContext(draft, event)
  dispatchEffects(event, ctx, collectEffects(ctx.game))

  // Add guaranteed for sale items to the shop, up to the limit of maxCardsForSale
  for (const item of draft.shopState.guaranteedForSaleItems) {
    if (draft.shopState.cardsForSale.length < draft.shopState.maxCardsForSale) {
      draft.shopState.cardsForSale.push(item)
    }
  }
  // Clear guaranteed items after adding them
  draft.shopState.guaranteedForSaleItems = []
  // If there are still slots available, add random cards to the shop
  const randomBuyableCardsSeed = buildSeedString([
    draft.gameSeed,
    draft.roundIndex.toString(),
    draft.shopState.rerollsUsed.toString(),
    draft.shopState.voucher ?? '0',
  ])
  if (draft.shopState.cardsForSale.length < draft.shopState.maxCardsForSale) {
    const additionalCards = getRandomBuyableCards(
      draft,
      draft.shopState.maxCardsForSale - draft.shopState.cardsForSale.length,
      randomBuyableCardsSeed
    )
    draft.shopState.cardsForSale.push(...additionalCards)
  }
  draft.shopState.packsForSale = getRandomPacks(draft, 2)
}

export function handleShopSelectBlind(draft: GameState) {
  draft.shopState.isOpen = false
  draft.gamePhase = 'blindSelection'
  populateTags(draft)
}

export function handleShopSelectPlayingCardFromPack(
  draft: GameState,
  event: ShopSelectPlayingCardFromPackEvent
) {
  const id = event.id
  const card = draft.shopState.openPackState?.cards.find(card => card.card.id === id)
  if (!card) return
  if (!isPlayingCardState(card.card)) return
  addOwnedCard(draft as unknown as GameState, card.card)
  if (!draft.shopState.openPackState) return

  draft.shopState.openPackState.remainingCardsToSelect -= 1

  if (draft.shopState.openPackState.remainingCardsToSelect === 0) {
    draft.gamePhase = 'shop'
    draft.shopState.openPackState = null
  }
}

export function handleShopSelectJokerFromPack(
  draft: GameState,
  event: ShopSelectJokerFromPackEvent
) {
  const id = event.id
  const buyableCard = draft.shopState.openPackState?.cards.find(card => card.card.id === id)
  if (!buyableCard) return
  if (!isJokerState(buyableCard.card)) return

  // Add the joker to the player's jokers
  draft.jokers.push(buyableCard.card)

  // Remove the card from the pack
  if (!draft.shopState.openPackState) return
  removeCardFromPack(draft.shopState.openPackState, id)

  // Emit JOKER_ADDED event for effects that react to new jokers
  const jokerAddedEvent: GameEvent = { type: 'JOKER_ADDED' }
  const ctx = getEffectContext(draft, event)
  dispatchEffects(jokerAddedEvent, ctx, collectEffects(ctx.game))

  if (draft.shopState.openPackState.remainingCardsToSelect === 0) {
    draft.gamePhase = 'shop'
    draft.shopState.openPackState = null
  }
}

export function handleShopUseTarotCardFromPack(
  draft: GameState,
  event: ShopUseTarotCardFromPackEvent
) {
  const id = event.id
  const buyableCard = draft.shopState.openPackState?.cards.find(card => card.card.id === id)
  if (!buyableCard) return
  if (!isTarotCardState(buyableCard.card)) return
  const tarotCard = buyableCard.card
  if (tarotCard.tarotType === 'notImplemented') return

  // Add to consumablesUsed so The Fool and similar cards can reference it
  draft.consumablesUsed.push(tarotCard)

  // Remove the card from the pack
  if (!draft.shopState.openPackState) return
  removeCardFromPack(draft.shopState.openPackState, id)

  const isLastCardToSelect = draft.shopState.openPackState.remainingCardsToSelect === 0

  // Create effect context for dispatching effects
  const tarotCardUsedEvent: GameEvent = { type: 'TAROT_CARD_USED' }
  const ctx = getEffectContext(draft, event)

  // Dispatch the tarot card's own effects (e.g., enchantments from The Magician)
  dispatchEffects(tarotCardUsedEvent, ctx, tarotCards[tarotCard.tarotType].effects)

  // Also dispatch to other effects that react to TAROT_CARD_USED (jokers, vouchers, etc.)
  dispatchEffects(tarotCardUsedEvent, ctx, collectEffects(ctx.game))

  // Clean up after effects have been applied
  draft.gamePlayState.selectedCardIds = []
  if (isLastCardToSelect) {
    draft.gamePhase = 'shop'
    draft.shopState.openPackState = null
  }
}

export function handleShopUseCelestialCardFromPack(
  draft: GameState,
  event: ShopUseCelestialCardFromPackEvent
) {
  const id = event.id
  const buyableCard = draft.shopState.openPackState?.cards.find(card => card.card.id === id)
  if (!buyableCard) return
  if (!isCelestialCardState(buyableCard.card)) return
  const celestialCard = buyableCard.card

  // Add to consumablesUsed so The Fool and similar cards can reference it
  draft.consumablesUsed.push(celestialCard)

  // Remove the card from the pack
  if (!draft.shopState.openPackState) return
  removeCardFromPack(draft.shopState.openPackState, id)

  const isLastCardToSelect = draft.shopState.openPackState.remainingCardsToSelect === 0

  // Create effect context for dispatching effects
  const celestialCardUsedEvent: GameEvent = { type: 'CELESTIAL_CARD_USED' }
  const ctx = getEffectContext(draft, event)

  // Dispatch the celestial card's own effects (level up the poker hand)
  dispatchEffects(celestialCardUsedEvent, ctx, celestialCards[celestialCard.handId].effects)

  // Also dispatch to other effects that react to CELESTIAL_CARD_USED (jokers, vouchers, etc.)
  dispatchEffects(celestialCardUsedEvent, ctx, collectEffects(ctx.game))

  // Clean up after effects have been applied
  if (isLastCardToSelect) {
    draft.gamePhase = 'shop'
    draft.shopState.openPackState = null
    draft.gamePlayState.selectedCardIds = []
  }
}

export function handleShopUseSpectralCardFromPack(
  draft: GameState,
  event: ShopUseSpectralCardFromPackEvent
) {
  const id = event.id
  const buyableCard = draft.shopState.openPackState?.cards.find(card => card.card.id === id)
  if (!buyableCard) return
  if (!isSpectralCardState(buyableCard.card)) return
  const spectralCard = buyableCard.card

  // Remove the card from the pack
  if (!draft.shopState.openPackState) return
  removeCardFromPack(draft.shopState.openPackState, id)

  const isLastCardToSelect = draft.shopState.openPackState.remainingCardsToSelect === 0

  // Create effect context for dispatching effects
  const spectralCardUsedEvent: GameEvent = { type: 'SPECTRAL_CARD_USED' }
  const ctx = getEffectContext(draft, event)

  // Dispatch the spectral card's own effects
  const spectralCardDefinition = spectralCards[spectralCard.spectralType]
  if (spectralCardDefinition && spectralCardDefinition.effects) {
    dispatchEffects(spectralCardUsedEvent, ctx, spectralCardDefinition.effects)
  }

  // Also dispatch to other effects that react to SPECTRAL_CARD_USED (jokers, vouchers, etc.)
  dispatchEffects(spectralCardUsedEvent, ctx, collectEffects(ctx.game))

  // Clean up after effects have been applied
  if (isLastCardToSelect) {
    draft.gamePhase = 'shop'
    draft.shopState.openPackState = null
    draft.gamePlayState.selectedCardIds = []
  }
}

export function handleShopBuyCard(draft: GameState, event: ShopBuyCardEvent) {
  const selectedCard = draft.shopState.cardsForSale.find(
    card => card.card.id === draft.shopState.selectedCardId
  )

  if (!selectedCard) return
  draft.money -= Math.floor(selectedCard.price * draft.shopState.priceMultiplier)
  const didAddJoker = isJokerState(selectedCard.card)
  if (isJokerState(selectedCard.card)) {
    draft.jokers.push(selectedCard.card)
  } else if (isPlayingCardState(selectedCard.card)) {
    draft.gamePlayState.handIds.push(selectedCard.card.id)
    addOwnedCard(draft as unknown as GameState, selectedCard.card)
  } else if (isCelestialCardState(selectedCard.card)) {
    draft.consumables.push(selectedCard.card)
  } else if (isTarotCardState(selectedCard.card)) {
    draft.consumables.push(selectedCard.card)
  } else {
    throw new Error(`Unknown card type: ${selectedCard.card}`)
  }

  // Run effects before removing the card from `cardsForSale` so effects can inspect the
  // selected shop card via `selectedCardId` + `cardsForSale`.
  const ctx = getEffectContext(draft, event)
  dispatchEffects(event, ctx, collectEffects(ctx.game))

  // When a joker is purchased, also emit a more semantic lifecycle event so jokers can
  // react without needing to inspect shop selection state.
  if (didAddJoker) {
    const jokerAddedEvent: GameEvent = { type: 'JOKER_ADDED' }
    dispatchEffects(jokerAddedEvent, { ...ctx, event: jokerAddedEvent }, collectEffects(ctx.game))
  }

  draft.shopState.cardsForSale = draft.shopState.cardsForSale.filter(
    card => card.card.id !== selectedCard.card.id
  )
}

export function handleShopBuyAndUseCard(draft: GameState) {
  const selectedCardForSale = draft.shopState.cardsForSale.find(
    card => card.card.id === draft.shopState.selectedCardId
  )
  if (!selectedCardForSale) return
  draft.money -= Math.floor(selectedCardForSale.price * draft.shopState.priceMultiplier)
  if (isTarotCardState(selectedCardForSale.card)) {
    handleUseBuyableTarotCard(draft)
  } else if (isCelestialCardState(selectedCardForSale.card)) {
    handleUseBuyableCelestialCard(draft)
  }
  draft.shopState.cardsForSale = draft.shopState.cardsForSale.filter(
    card => card.card.id !== selectedCardForSale.card.id
  )
}

export function handleShopReroll(draft: GameState) {
  draft.shopState.rerollsUsed += 1
  const randomBuyableCardsSeed = buildSeedString([
    draft.gameSeed,
    draft.roundIndex.toString(),
    draft.shopState.rerollsUsed.toString(),
  ])
  draft.shopState.cardsForSale = getRandomBuyableCards(
    draft,
    draft.shopState.maxCardsForSale,
    randomBuyableCardsSeed
  )
  draft.money -= draft.shopState.baseRerollPrice + draft.shopState.rerollsUsed
}

export function handleShopOpenPack(draft: GameState, event: ShopOpenPackEvent) {
  const id = event.id
  const pack = draft.shopState.packsForSale.find(pack => pack.id === id)
  if (!pack) return
  const packDefinition = getPackDefinition(pack.cards[0].type, pack.rarity)
  if (!pack) return
  draft.money -= Math.floor(packDefinition.price * draft.shopState.priceMultiplier)
  draft.shopState.packsForSale = draft.shopState.packsForSale.filter(pack => pack.id !== id)
  draft.gamePhase = 'packOpening'
  draft.shopState.openPackState = pack
  const nextBlind = getNextBlind(draft)

  if (packDefinition.cardType === 'tarotCard') {
    const seed = buildSeedString([
      draft.gameSeed,
      draft.roundIndex.toString(),
      draft.shopState.rerollsUsed.toString(),
      nextBlind?.type.toString() ?? '0',
      'tarotCardOpenPack',
    ])
    draft.gamePlayState.drawPileIds = shuffleCardIds({
      cardIds: draft.ownedCardIds,
      seed: seed,
      iteration: draft.roundIndex + blindIndices[nextBlind?.type ?? 'smallBlind'],
    })
    dealCardsFromDrawPile(draft, HAND_SIZE)
  }
  if (packDefinition.cardType === 'spectralCard') {
    draft.gamePlayState.drawPileIds = shuffleCardIds({
      cardIds: draft.ownedCardIds,
      seed: buildSeedString([
        draft.gameSeed,
        draft.roundIndex.toString(),
        draft.shopState.rerollsUsed.toString(),
        nextBlind?.type.toString() ?? '0',
        'spectralCardOpenPack',
      ]),
      iteration: draft.roundIndex + blindIndices[nextBlind?.type ?? 'smallBlind'],
    })
    dealCardsFromDrawPile(draft as unknown as GameState, HAND_SIZE)
  }
}

export function handleShopBuyVoucher(draft: GameState, event: ShopBuyVoucherEvent) {
  const id = event.id
  const voucher = vouchers[id]
  if (!voucher) return
  draft.vouchers.push(initializeVoucherState(voucher))
  draft.shopState.voucher = null
  draft.money -= VOUCHER_PRICE

  const ctx = getEffectContext(draft, event)
  dispatchEffects(event, ctx, collectEffects(ctx.game))
}

export function handleUseBuyableTarotCard(draft: Draft<GameState>): void {
  const tarotCardId = draft.shopState.selectedCardId
  if (!tarotCardId) return
  const tarotCard = draft.shopState.cardsForSale.find(card => card.card.id === tarotCardId)
  if (!tarotCard) return
  if (isTarotCardState(tarotCard.card)) {
    // Add to consumablesUsed so The Fool and similar cards can reference it
    draft.consumablesUsed.push(tarotCard.card)
    // See note in `handleUseBuyableCelestialCard`: buy+use triggers a shop event, but tarot effects
    // are keyed off `TAROT_CARD_USED`.
    const usedEvent: GameEvent = { type: 'TAROT_CARD_USED' }
    dispatchEffects(
      usedEvent,
      {
        event: usedEvent,
        game: draft,
        score: draft.gamePlayState.score,
        playedCards: [],
        round: draft.rounds[draft.roundIndex],
        bossBlind: draft.rounds[draft.roundIndex].bossBlind,
        jokers: draft.jokers,
        vouchers: draft.vouchers,
        tags: draft.tags,
      },
      tarotCards[tarotCard.card.tarotType].effects
    )
  }
}

export function handleUseBuyableCelestialCard(draft: Draft<GameState>): void {
  const celestialCardId = draft.shopState.selectedCardId
  if (!celestialCardId) return
  const celestialCard = draft.shopState.cardsForSale.find(card => card.card.id === celestialCardId)
  if (!celestialCard) return
  if (isCelestialCardState(celestialCard.card)) {
    // Add to consumablesUsed so The Fool and similar cards can reference it
    draft.consumablesUsed.push(celestialCard.card)
    // Important: `dispatchEffects` matches by `event.type`. When buying + using in the shop,
    // the triggering event is typically `SHOP_BUY_AND_USE_CARD`, but the card's effects are
    // keyed off `CELESTIAL_CARD_USED`.
    const usedEvent: GameEvent = { type: 'CELESTIAL_CARD_USED' }
    dispatchEffects(
      usedEvent,
      {
        event: usedEvent,
        game: draft,
        score: draft.gamePlayState.score,
        playedCards: [],
        round: draft.rounds[draft.roundIndex],
        bossBlind: draft.rounds[draft.roundIndex].bossBlind,
        jokers: draft.jokers,
        vouchers: draft.vouchers,
        tags: draft.tags,
      },
      celestialCards[celestialCard.card.handId].effects
    )
  }
}
