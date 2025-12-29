import { produce } from 'immer'

import { celestialCards } from '@/app/daily-card-game/domain/consumable/celestial-cards'
import { implementedTarotCards as tarotCards } from '@/app/daily-card-game/domain/consumable/tarot-cards'
import {
  initializeTarotCard,
  isCelestialCardState,
  isTarotCardState,
} from '@/app/daily-card-game/domain/consumable/utils'
import { dispatchEffects } from '@/app/daily-card-game/domain/events/dispatch-effects'
import type { EffectContext, GameEvent } from '@/app/daily-card-game/domain/events/types'
import { findHighestPriorityHand, pokerHands } from '@/app/daily-card-game/domain/hand/hands'
import type { PokerHandDefinition } from '@/app/daily-card-game/domain/hand/types'
import { jokers } from '@/app/daily-card-game/domain/joker/jokers'
import type { JokerState } from '@/app/daily-card-game/domain/joker/types'
import { isJokerState } from '@/app/daily-card-game/domain/joker/utils'
import type { PlayingCardState } from '@/app/daily-card-game/domain/playing-card/types'
import { isPlayingCardState } from '@/app/daily-card-game/domain/playing-card/utils'
import { buildSeedString, uuid } from '@/app/daily-card-game/domain/randomness'
import { getInProgressBlind } from '@/app/daily-card-game/domain/round/blinds'
import type { BlindState } from '@/app/daily-card-game/domain/round/types'
import { getPackDefinition, getRandomPacks } from '@/app/daily-card-game/domain/shop/packs'
import { getRandomBuyableCards, getRandomTarotCards } from '@/app/daily-card-game/domain/shop/utils'
import { VOUCHER_PRICE } from '@/app/daily-card-game/domain/voucher/constants'
import {
  getRandomVoucherType,
  initializeVoucherState,
} from '@/app/daily-card-game/domain/voucher/utils'
import { vouchers } from '@/app/daily-card-game/domain/voucher/vouchers'

import { HAND_SIZE, INTEREST_CALCULATION_FACTOR, MAX_SELECTED_CARDS } from './constants'
import { handleCardScored, handleHandScoringEnd } from './handlers'
import {
  collectEffects,
  getBlindDefinition,
  randomizeDeck,
  useBuyableCelestialCard,
  useBuyableTarotCard,
  useConsumableCelestialCard,
  useConsumableTarotCard,
} from './utils'

import type { GameState } from './types'

const blindIndices: Record<BlindState['type'], number> = {
  smallBlind: 0,
  bigBlind: 1,
  bossBlind: 2,
}

function removeJoker(draft: GameState, event: GameEvent, selectedJoker: JokerState) {
  draft.gamePlayState.selectedJokerId = undefined
  const ctx: EffectContext = {
    event,
    game: draft as unknown as GameState,
    score: draft.gamePlayState.score,
    playedCards: [],
    round: draft.rounds[draft.roundIndex],
    bossBlind: draft.rounds[draft.roundIndex].bossBlind,
    jokers: draft.jokers,
    vouchers: draft.vouchers,
  }
  // Collect effects *before* removing the joker so "on sold/removed" effects that live on the
  // removed joker itself still get a chance to run. Then dispatch *after* removal so effects
  // can observe the post-removal game state.
  const effectsBeforeRemoval = collectEffects(ctx.game)
  draft.jokers = draft.jokers.filter(joker => joker.id !== selectedJoker.id)
  ctx.jokers = draft.jokers
  dispatchEffects(event, ctx, effectsBeforeRemoval)
}

export function calculateInterest(draft: GameState): number {
  const currentMoney = draft.money
  const maxInterest = draft.maxInterest
  const interestCalculation = Math.floor(currentMoney / INTEREST_CALCULATION_FACTOR)
  return Math.min(interestCalculation, maxInterest)
}

export function reduceGame(game: GameState, event: GameEvent): GameState {
  return produce(game, draft => {
    switch (event.type) {
      /*
       * NAVIGATION EVENTS
       */

      case 'GAME_START': {
        draft.gamePhase = 'blindSelection'
        draft.shopState.voucher = getRandomVoucherType(draft)
        const ctx: EffectContext = {
          event,
          game: draft,
          score: draft.gamePlayState.score,
          playedCards: [],
          round: draft.rounds[draft.roundIndex],
          bossBlind: draft.rounds[draft.roundIndex].bossBlind,
          jokers: draft.jokers,
          vouchers: draft.vouchers,
        }
        dispatchEffects(event, ctx, collectEffects(ctx.game))
        return
      }
      case 'BACK_TO_MAIN_MENU': {
        draft.gamePhase = 'mainMenu'
        return
      }
      case 'DISPLAY_JOKERS': {
        draft.gamePhase = 'jokers'
        return
      }
      case 'DISPLAY_VOUCHERS': {
        draft.gamePhase = 'vouchers'
        return
      }
      case 'DISPLAY_TAROT_CARDS': {
        draft.gamePhase = 'tarotCards'
        return
      }
      case 'DISPLAY_CELESTIALS': {
        draft.gamePhase = 'celestialCards'
        return
      }
      case 'DISPLAY_BOSS_BLINDS': {
        draft.gamePhase = 'bossBlinds'
        return
      }

      /*
       * BLIND SELECTION EVENTS
       */

      case 'SMALL_BLIND_SELECTED': {
        const round = draft.rounds[draft.roundIndex]
        round.smallBlind.status = 'inProgress'
        draft.gamePhase = 'gameplay'
        draft.gamePlayState.remainingDeck = randomizeDeck({
          deck: draft.fullDeck,
          seed: draft.gameSeed,
          iteration: draft.roundIndex + blindIndices['smallBlind'],
        })
        return
      }
      case 'BIG_BLIND_SELECTED': {
        const round = draft.rounds[draft.roundIndex]
        round.bigBlind.status = 'inProgress'
        draft.gamePhase = 'gameplay'
        draft.gamePlayState.remainingDeck = randomizeDeck({
          deck: draft.fullDeck,
          seed: draft.gameSeed,
          iteration: draft.roundIndex + blindIndices['bigBlind'],
        })
        return
      }
      case 'BOSS_BLIND_SELECTED': {
        const round = draft.rounds[draft.roundIndex]
        round.bossBlind.status = 'inProgress'
        draft.gamePhase = 'gameplay'
        draft.gamePlayState.remainingDeck = randomizeDeck({
          deck: draft.fullDeck,
          seed: draft.gameSeed,
          iteration: draft.roundIndex + blindIndices['bossBlind'],
        })
        return
      }
      case 'BIG_BLIND_SKIPPED': {
        const round = draft.rounds[draft.roundIndex]
        round.bigBlind.status = 'skipped'
        return
      }
      case 'SMALL_BLIND_SKIPPED': {
        const round = draft.rounds[draft.roundIndex]
        round.smallBlind.status = 'skipped'
        return
      }

      /*
       * GAMEPLAY EVENTS
       */

      case 'HAND_DEALT': {
        if (draft.gamePlayState.dealtCards.length) return
        draft.gamePlayState.dealtCards = draft.gamePlayState.remainingDeck.slice(0, HAND_SIZE)
        draft.gamePlayState.remainingDeck = draft.gamePlayState.remainingDeck.slice(HAND_SIZE)
        return
      }
      case 'CARD_SELECTED': {
        const id = event.id
        const gamePlayState = draft.gamePlayState
        if (gamePlayState.selectedCardIds.includes(id)) return
        if (gamePlayState.selectedCardIds.length >= MAX_SELECTED_CARDS) return

        const selectedCardIds = [...gamePlayState.selectedCardIds, id]
        const selectedCards: PlayingCardState[] = gamePlayState.dealtCards.filter(card =>
          selectedCardIds.includes(card.id)
        )
        const selectedHandId = findHighestPriorityHand(selectedCards, draft.staticRules).hand

        gamePlayState.selectedCardIds = selectedCardIds
        gamePlayState.selectedHand = [selectedHandId, selectedCards]
        return
      }
      case 'CARD_DESELECTED': {
        const id = event.id
        const gamePlayState = draft.gamePlayState
        if (!gamePlayState.selectedCardIds.includes(id)) return

        const selectedCardIds = gamePlayState.selectedCardIds.filter(cardId => cardId !== id)
        const selectedCards = gamePlayState.dealtCards.filter(card =>
          selectedCardIds.includes(card.id)
        )

        let selectedHand: [PokerHandDefinition['id'], PlayingCardState[]] | undefined = undefined
        if (selectedCards.length > 0) {
          const selectedHandId = findHighestPriorityHand(selectedCards, draft.staticRules).hand
          selectedHand = [selectedHandId, selectedCards]
        }

        gamePlayState.selectedCardIds = selectedCardIds
        gamePlayState.selectedHand = selectedHand
        return
      }
      case 'DISCARD_SELECTED_CARDS': {
        const gamePlayState = draft.gamePlayState

        // Find discarded cards before we clear selection
        const discardedCards = gamePlayState.dealtCards.filter(card =>
          gamePlayState.selectedCardIds.includes(card.id)
        )

        const cardsToKeep = gamePlayState.dealtCards.filter(
          card => !gamePlayState.selectedCardIds.includes(card.id)
        )

        draft.discardsPlayed += 1
        gamePlayState.selectedCardIds = []
        gamePlayState.selectedHand = undefined
        gamePlayState.cardsToScore = []
        gamePlayState.playedCardIds = []
        gamePlayState.dealtCards = cardsToKeep
        gamePlayState.remainingDiscards -= 1

        // refill immediately (this was previously orchestrated in useGameEvents)
        const cardsToRefill = gamePlayState.remainingDeck.slice(
          0,
          HAND_SIZE - gamePlayState.dealtCards.length
        )
        gamePlayState.dealtCards = gamePlayState.dealtCards.concat(cardsToRefill)
        gamePlayState.remainingDeck = gamePlayState.remainingDeck.slice(cardsToRefill.length)

        // Purple seal: add a tarot card for each discarded card with purple seal
        const purpleSealCount = discardedCards.filter(card => card.flags.seal === 'purple').length
        for (let i = 0; i < purpleSealCount; i++) {
          if (draft.consumables.length < draft.maxConsumables) {
            draft.consumables.push(initializeTarotCard(getRandomTarotCards(draft, 1)[0]))
          }
        }

        return
      }

      case 'CARD_SCORED': {
        // Red seal handling is done inside handleCardScored
        handleCardScored(draft, event)
        return
      }
      case 'HAND_SCORING_START': {
        const gamePlayState = draft.gamePlayState
        const selectedCards = gamePlayState.dealtCards.filter(card =>
          gamePlayState.selectedCardIds.includes(card.id)
        )
        const { hand: playedHand, handCards: cardsToScore } = findHighestPriorityHand(
          selectedCards,
          draft.staticRules
        )
        gamePlayState.cardsToScore = cardsToScore
        gamePlayState.playedCardIds = selectedCards.map(card => card.id)

        gamePlayState.remainingHands -= 1

        const playedHandLevel = draft.pokerHands[playedHand].level - 1

        // ensure hand is no longer secret once played
        draft.pokerHands[playedHand].isSecret = false

        // increment the times the hand has been played
        draft.pokerHands[playedHand].timesPlayed += 1

        const handMult =
          pokerHands[playedHand].baseMult +
          pokerHands[playedHand].multIncreasePerLevel * playedHandLevel
        const handChips =
          pokerHands[playedHand].baseChips +
          pokerHands[playedHand].chipIncreasePerLevel * playedHandLevel

        if (handChips > 0) {
          draft.gamePlayState.scoringEvents.push({
            id: uuid(),
            type: 'chips',
            value: handChips,
            source: 'hand',
          })
        }

        if (handMult > 0) {
          draft.gamePlayState.scoringEvents.push({
            id: uuid(),
            type: 'mult',
            value: handMult,
            source: 'hand',
          })
        }

        gamePlayState.isScoring = true
        gamePlayState.score = { chips: handChips, mult: handMult }
        gamePlayState.selectedHand = [pokerHands[playedHand].id, selectedCards]
        draft.handsPlayed += 1

        const ctx: EffectContext = {
          event,
          game: draft,
          score: gamePlayState.score,
          playedCards: selectedCards,
          round: draft.rounds[draft.roundIndex],
          bossBlind: draft.rounds[draft.roundIndex].bossBlind,
          jokers: draft.jokers,
          vouchers: draft.vouchers,
        }
        dispatchEffects(event, ctx, collectEffects(ctx.game))
        return
      }
      case 'HAND_SCORING_DONE_CARD_SCORING': {
        const ctx: EffectContext = {
          event,
          game: draft,
          score: draft.gamePlayState.score,
          playedCards: draft.gamePlayState.selectedHand?.[1],
          round: draft.rounds[draft.roundIndex],
          bossBlind: draft.rounds[draft.roundIndex].bossBlind,
          jokers: draft.jokers,
          vouchers: draft.vouchers,
        }
        dispatchEffects(event, ctx, collectEffects(ctx.game))
        return
      }
      case 'HAND_SCORING_FINALIZE': {
        handleHandScoringEnd(draft, event)
        const ctx: EffectContext = {
          event,
          game: draft,
          score: draft.gamePlayState.score,
          playedCards: draft.gamePlayState.selectedHand?.[1],
          round: draft.rounds[draft.roundIndex],
          bossBlind: draft.rounds[draft.roundIndex].bossBlind,
          jokers: draft.jokers,
          vouchers: draft.vouchers,
        }
        dispatchEffects(event, ctx, collectEffects(ctx.game))
        return
      }
      case 'BLIND_REWARDS_START': {
        // Blue seal logic is handled in handleHandScoringEnd (before state is cleared)
        return
      }
      case 'BLIND_REWARDS_END': {
        const currentBlind = getInProgressBlind(draft)
        if (!currentBlind) return
        const totalReward =
          getBlindDefinition(currentBlind.type, draft.rounds[draft.roundIndex]).baseReward +
          currentBlind.additionalRewards.reduce((acc, reward) => acc + reward[1], 0)
        draft.money += totalReward
        currentBlind.status = 'completed'
        draft.gamePhase = 'shop'
        draft.shopState.voucher = getRandomVoucherType(draft)
        draft.gamePlayState.remainingDeck = draft.fullDeck
        draft.gamePlayState.remainingHands = draft.maxHands
        if (currentBlind.type === 'bossBlind') {
          draft.roundIndex += 1
        }
        draft.gamePlayState.scoringEvents = []
        draft.gamePlayState.remainingDiscards = draft.maxDiscards

        // Reset shop state for the new shop session
        draft.shopState.cardsForSale = getRandomBuyableCards(
          draft,
          draft.shopState.maxCardsForSale
        )
        draft.shopState.packsForSale = getRandomPacks(draft, 2)
        draft.shopState.rerollsUsed = 0
        draft.shopState.selectedCardId = null
        return
      }

      /*
       * SHOP EVENTS
       */

      case 'SHOP_OPEN': {
        // Shop inventory is now initialized in BLIND_REWARDS_END
        // This event is just for any additional shop opening logic if needed
        return
      }
      case 'SHOP_SELECT_BLIND': {
        draft.gamePhase = 'blindSelection'
        return
      }
      case 'SHOP_SELECT_PLAYING_CARD_FROM_PACK': {
        const id = event.id
        const card = draft.shopState.openPackState?.cards.find(card => card.card.id === id)
        if (!card) return
        if (!isPlayingCardState(card.card)) return
        draft.fullDeck.push(card.card)
        if (!draft.shopState.openPackState) return

        draft.shopState.openPackState.remainingCardsToSelect -= 1

        if (draft.shopState.openPackState.remainingCardsToSelect === 0) {
          draft.gamePhase = 'shop'
          draft.shopState.openPackState = null
        }
        return
      }
      case 'SHOP_SELECT_JOKER_FROM_PACK': {
        const id = event.id
        const buyableCard = draft.shopState.openPackState?.cards.find(card => card.card.id === id)
        if (!buyableCard) return
        if (!isJokerState(buyableCard.card)) return

        // Add the joker to the player's jokers
        draft.jokers.push(buyableCard.card)

        // Remove the card from the pack
        if (!draft.shopState.openPackState) return
        draft.shopState.openPackState.cards = draft.shopState.openPackState.cards.filter(
          card => card.card.id !== id
        )
        draft.shopState.openPackState.remainingCardsToSelect -= 1

        // Emit JOKER_ADDED event for effects that react to new jokers
        const jokerAddedEvent: GameEvent = { type: 'JOKER_ADDED' }
        const ctx: EffectContext = {
          event: jokerAddedEvent,
          game: draft as unknown as GameState,
          score: draft.gamePlayState.score,
          playedCards: [],
          round: draft.rounds[draft.roundIndex],
          bossBlind: draft.rounds[draft.roundIndex].bossBlind,
          jokers: draft.jokers,
          vouchers: draft.vouchers,
        }
        dispatchEffects(jokerAddedEvent, ctx, collectEffects(ctx.game))

        if (draft.shopState.openPackState.remainingCardsToSelect === 0) {
          draft.gamePhase = 'shop'
          draft.shopState.openPackState = null
        }
        return
      }
      case 'SHOP_USE_TAROT_CARD_FROM_PACK': {
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
        draft.shopState.openPackState.cards = draft.shopState.openPackState.cards.filter(
          card => card.card.id !== id
        )
        draft.shopState.openPackState.remainingCardsToSelect -= 1

        if (draft.shopState.openPackState.remainingCardsToSelect === 0) {
          draft.gamePhase = 'shop'
          draft.shopState.openPackState = null
          draft.gamePlayState.selectedCardIds = []
        }
        // Create effect context for dispatching effects
        const tarotCardUsedEvent: GameEvent = { type: 'TAROT_CARD_USED' }
        const ctx: EffectContext = {
          event: tarotCardUsedEvent,
          game: draft as unknown as GameState,
          score: draft.gamePlayState.score,
          playedCards: [],
          round: draft.rounds[draft.roundIndex],
          bossBlind: draft.rounds[draft.roundIndex].bossBlind,
          jokers: draft.jokers,
          vouchers: draft.vouchers,
        }

        // Dispatch the tarot card's own effects (e.g., enchantments from The Magician)
        dispatchEffects(tarotCardUsedEvent, ctx, tarotCards[tarotCard.tarotType].effects)

        // Also dispatch to other effects that react to TAROT_CARD_USED (jokers, vouchers, etc.)
        dispatchEffects(tarotCardUsedEvent, ctx, collectEffects(ctx.game))

        return
      }
      case 'SHOP_USE_CELESTIAL_CARD_FROM_PACK': {
        const id = event.id
        const buyableCard = draft.shopState.openPackState?.cards.find(card => card.card.id === id)
        if (!buyableCard) return
        if (!isCelestialCardState(buyableCard.card)) return
        const celestialCard = buyableCard.card

        // Add to consumablesUsed so The Fool and similar cards can reference it
        draft.consumablesUsed.push(celestialCard)

        // Remove the card from the pack
        if (!draft.shopState.openPackState) return
        draft.shopState.openPackState.cards = draft.shopState.openPackState.cards.filter(
          card => card.card.id !== id
        )
        draft.shopState.openPackState.remainingCardsToSelect -= 1

        if (draft.shopState.openPackState.remainingCardsToSelect === 0) {
          draft.gamePhase = 'shop'
          draft.shopState.openPackState = null
        }

        // Create effect context for dispatching effects
        const celestialCardUsedEvent: GameEvent = { type: 'CELESTIAL_CARD_USED' }
        const ctx: EffectContext = {
          event: celestialCardUsedEvent,
          game: draft as unknown as GameState,
          score: draft.gamePlayState.score,
          playedCards: [],
          round: draft.rounds[draft.roundIndex],
          bossBlind: draft.rounds[draft.roundIndex].bossBlind,
          jokers: draft.jokers,
          vouchers: draft.vouchers,
        }

        // Dispatch the celestial card's own effects (level up the poker hand)
        dispatchEffects(celestialCardUsedEvent, ctx, celestialCards[celestialCard.handId].effects)

        // Also dispatch to other effects that react to CELESTIAL_CARD_USED (jokers, vouchers, etc.)
        dispatchEffects(celestialCardUsedEvent, ctx, collectEffects(ctx.game))

        return
      }
      case 'SHOP_BUY_CARD': {
        const selectedCard = draft.shopState.cardsForSale.find(
          card => card.card.id === draft.shopState.selectedCardId
        )

        if (!selectedCard) return
        draft.money -= Math.floor(selectedCard.price * draft.shopState.priceMultiplier)
        const didAddJoker = isJokerState(selectedCard.card)
        if (isJokerState(selectedCard.card)) {
          draft.jokers.push(selectedCard.card)
        } else if (isPlayingCardState(selectedCard.card)) {
          draft.gamePlayState.dealtCards.push(selectedCard.card)
        } else if (isCelestialCardState(selectedCard.card)) {
          draft.consumables.push(selectedCard.card)
        } else if (isTarotCardState(selectedCard.card)) {
          draft.consumables.push(selectedCard.card)
        } else {
          throw new Error(`Unknown card type: ${selectedCard.card}`)
        }

        // Run effects before removing the card from `cardsForSale` so effects can inspect the
        // selected shop card via `selectedCardId` + `cardsForSale`.
        const ctx: EffectContext = {
          event,
          game: draft as unknown as GameState,
          score: draft.gamePlayState.score,
          playedCards: [],
          round: draft.rounds[draft.roundIndex],
          bossBlind: draft.rounds[draft.roundIndex].bossBlind,
          jokers: draft.jokers,
          vouchers: draft.vouchers,
        }
        dispatchEffects(event, ctx, collectEffects(ctx.game))

        // When a joker is purchased, also emit a more semantic lifecycle event so jokers can
        // react without needing to inspect shop selection state.
        if (didAddJoker) {
          const jokerAddedEvent: GameEvent = { type: 'JOKER_ADDED' }
          dispatchEffects(
            jokerAddedEvent,
            { ...ctx, event: jokerAddedEvent },
            collectEffects(ctx.game)
          )
        }

        draft.shopState.cardsForSale = draft.shopState.cardsForSale.filter(
          card => card.card.id !== selectedCard.card.id
        )
        return
      }
      case 'SHOP_BUY_AND_USE_CARD': {
        const selectedCardForSale = draft.shopState.cardsForSale.find(
          card => card.card.id === draft.shopState.selectedCardId
        )
        if (!selectedCardForSale) return
        draft.money -= Math.floor(selectedCardForSale.price * draft.shopState.priceMultiplier)
        if (isTarotCardState(selectedCardForSale.card)) {
          useBuyableTarotCard(draft)
        } else if (isCelestialCardState(selectedCardForSale.card)) {
          useBuyableCelestialCard(draft)
        }
        draft.shopState.cardsForSale = draft.shopState.cardsForSale.filter(
          card => card.card.id !== selectedCardForSale.card.id
        )
        return
      }
      case 'SHOP_SELECT_CARD': {
        const id = event.id
        if (draft.shopState.selectedCardId === id) return
        draft.shopState.selectedCardId = id
        return
      }
      case 'SHOP_DESELECT_CARD': {
        const id = event.id
        if (draft.shopState.selectedCardId !== id) return
        draft.shopState.selectedCardId = null
        return
      }
      case 'SHOP_REROLL': {
        draft.shopState.rerollsUsed += 1
        draft.shopState.cardsForSale = getRandomBuyableCards(draft, draft.shopState.maxCardsForSale)
        draft.money -= draft.shopState.baseRerollPrice + draft.shopState.rerollsUsed
        return
      }
      case 'SHOP_OPEN_PACK': {
        const id = event.id
        const pack = draft.shopState.packsForSale.find(pack => pack.id === id)
        if (!pack) return
        const packDefinition = getPackDefinition(pack.cards[0].type, pack.rarity)
        if (!pack) return
        draft.money -= packDefinition.price
        draft.shopState.packsForSale = draft.shopState.packsForSale.filter(pack => pack.id !== id)
        draft.gamePhase = 'packOpening'
        draft.shopState.openPackState = pack

        if (packDefinition.cardType === 'tarotCard') {
          draft.gamePlayState.remainingDeck = randomizeDeck({
            deck: draft.fullDeck,
            seed: buildSeedString([
              draft.gameSeed,
              draft.roundIndex.toString(),
              draft.shopState.rerollsUsed.toString(),
              'tarotCardOpenPack',
            ]),
            iteration: draft.roundIndex + blindIndices['smallBlind'],
          })
          draft.gamePlayState.dealtCards = draft.gamePlayState.remainingDeck.slice(0, HAND_SIZE)
        }
        return
      }
      case 'SHOP_BUY_VOUCHER': {
        const id = event.id
        const voucher = vouchers[id]
        if (!voucher) return
        draft.vouchers.push(initializeVoucherState(voucher))
        draft.shopState.voucher = null
        draft.money -= VOUCHER_PRICE

        const ctx: EffectContext = {
          event,
          game: draft,
          score: draft.gamePlayState.score,
          playedCards: [],
          round: draft.rounds[draft.roundIndex],
          bossBlind: draft.rounds[draft.roundIndex].bossBlind,
          jokers: draft.jokers,
          vouchers: draft.vouchers,
        }
        dispatchEffects(event, ctx, collectEffects(ctx.game))
        return
      }
      case 'PACK_OPEN_SKIP': {
        if (!draft.shopState.openPackState) return
        draft.gamePhase = 'shop'
        draft.shopState.openPackState = null
        return
      }

      /*
       * CONSUMABLE EVENTS
       */

      case 'CONSUMABLE_SELECTED': {
        const id = event.id
        const gamePlayState = draft.gamePlayState
        if (gamePlayState.selectedConsumable?.id === id) return
        gamePlayState.selectedConsumable = draft.consumables.find(
          consumable => consumable.id === id
        )
        return
      }
      case 'CONSUMABLE_DESELECTED': {
        const id = event.id
        const gamePlayState = draft.gamePlayState
        if (gamePlayState.selectedConsumable?.id !== id) return
        gamePlayState.selectedConsumable = undefined
        return
      }
      case 'CELESTIAL_CARD_USED': {
        useConsumableCelestialCard(draft, event)
        return
      }
      case 'TAROT_CARD_USED': {
        useConsumableTarotCard(draft, event)
        return
      }
      case 'CONSUMABLE_SOLD': {
        const selectedConsumable = game.gamePlayState.selectedConsumable
        const selectedConsumableDefinition = isCelestialCardState(selectedConsumable)
          ? celestialCards[selectedConsumable.handId]
          : isTarotCardState(selectedConsumable)
            ? tarotCards[selectedConsumable.tarotType]
            : undefined
        if (!selectedConsumableDefinition) return
        draft.consumables = draft.consumables.filter(
          consumable => consumable.id !== selectedConsumable?.id
        )
        draft.money += selectedConsumableDefinition.price
        draft.gamePlayState.selectedConsumable = undefined
        return
      }

      /*
       * JOKER EVENTS
       */
      case 'JOKER_SELECTED': {
        const id = event.id
        const gamePlayState = draft.gamePlayState
        if (gamePlayState.selectedJokerId === id) return
        gamePlayState.selectedJokerId = id
        return
      }
      case 'JOKER_DESELECTED': {
        const id = event.id
        const gamePlayState = draft.gamePlayState
        if (gamePlayState.selectedJokerId !== id) return
        gamePlayState.selectedJokerId = undefined
        return
      }
      case 'JOKER_SOLD': {
        const selectedJoker = draft.jokers.find(
          joker => joker.id === draft.gamePlayState.selectedJokerId
        )
        if (!selectedJoker) return
        draft.money += jokers[selectedJoker.jokerId].price
        removeJoker(draft, event, selectedJoker)
        return
      }
      case 'JOKER_ADDED': {
        return
      }
      case 'JOKER_REMOVED': {
        const selectedJoker = draft.jokers.find(
          joker => joker.id === draft.gamePlayState.selectedJokerId
        )
        if (!selectedJoker) return
        removeJoker(draft, event, selectedJoker)
        return
      }

      /*
       * NO-OP EVENTS
       */

      case 'ROUND_END': {
        return
      }

      default: {
        // Exhaustiveness guard in case GameEvent grows
        const _exhaustive: never = event
        return _exhaustive
      }
    }
  })
}
