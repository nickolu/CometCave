import { initializeTarotCard } from '@/app/daily-card-game/domain/consumable/utils'
import { dispatchEffects } from '@/app/daily-card-game/domain/events/dispatch-effects'
import type {
  CardDeselectedEvent,
  CardSelectedEvent,
  EffectContext,
  GameEvent,
} from '@/app/daily-card-game/domain/events/types'
import {
  dealCardsFromDrawPile,
  discardCardsFromHand,
  getCards,
  getSelectedCards,
} from '@/app/daily-card-game/domain/game/card-registry-utils'
import { HAND_SIZE, MAX_SELECTED_CARDS } from '@/app/daily-card-game/domain/game/constants'
import type { GameState } from '@/app/daily-card-game/domain/game/types'
import { collectEffects, getBlindDefinition } from '@/app/daily-card-game/domain/game/utils'
import { findHighestPriorityHand, pokerHands } from '@/app/daily-card-game/domain/hand/hands'
import { PokerHandDefinition } from '@/app/daily-card-game/domain/hand/types'
import { playingCards } from '@/app/daily-card-game/domain/playing-card/playing-cards'
import { PlayingCardState } from '@/app/daily-card-game/domain/playing-card/types'
import {
  buildSeedString,
  getRandomFloatWithSeed,
  uuid,
} from '@/app/daily-card-game/domain/randomness'
import { getInProgressBlind } from '@/app/daily-card-game/domain/round/blinds'
import { getRandomTarotCards } from '@/app/daily-card-game/domain/shop/utils'
import { getRandomVoucherType } from '@/app/daily-card-game/domain/voucher/utils'

export function handleCardSelected(draft: GameState, event: CardSelectedEvent) {
  const id = event.id
  const gamePlayState = draft.gamePlayState
  if (gamePlayState.selectedCardIds.includes(id)) return
  if (gamePlayState.selectedCardIds.length >= MAX_SELECTED_CARDS) return

  const selectedCardIds = [...gamePlayState.selectedCardIds, id]
  const selectedCards = getCards(draft as unknown as GameState, selectedCardIds)
  const selectedHandId = findHighestPriorityHand(selectedCards, draft.staticRules).hand

  gamePlayState.selectedCardIds = selectedCardIds
  gamePlayState.selectedHand = [selectedHandId, selectedCards]
}

export function handleCardDeselected(draft: GameState, event: CardDeselectedEvent) {
  const id = event.id
  const gamePlayState = draft.gamePlayState
  if (!gamePlayState.selectedCardIds.includes(id)) return

  const selectedCardIds = gamePlayState.selectedCardIds.filter(cardId => cardId !== id)
  const selectedCards = getCards(draft as unknown as GameState, selectedCardIds)

  let selectedHand: [PokerHandDefinition['id'], PlayingCardState[]] | undefined = undefined
  if (selectedCards.length > 0) {
    const selectedHandId = findHighestPriorityHand(selectedCards, draft.staticRules).hand
    selectedHand = [selectedHandId, selectedCards]
  }

  gamePlayState.selectedCardIds = selectedCardIds
  gamePlayState.selectedHand = selectedHand
}

export function handleDiscardSelectedCards(draft: GameState) {
  const gamePlayState = draft.gamePlayState

  // Find discarded cards before we clear selection
  const discardedCards = getCards(draft as unknown as GameState, gamePlayState.selectedCardIds)

  // Move selected cards from hand to discard pile
  discardCardsFromHand(draft as unknown as GameState, gamePlayState.selectedCardIds)

  draft.discardsPlayed += 1
  gamePlayState.selectedCardIds = []
  gamePlayState.selectedHand = undefined
  gamePlayState.cardsToScore = []
  gamePlayState.playedCardIds = []
  gamePlayState.remainingDiscards -= 1

  // refill immediately (this was previously orchestrated in useGameEvents)
  const cardsNeeded = HAND_SIZE - gamePlayState.handIds.length
  dealCardsFromDrawPile(draft as unknown as GameState, cardsNeeded)

  // Purple seal: add a tarot card for each discarded card with purple seal
  const purpleSealCount = discardedCards.filter(card => card.flags.seal === 'purple').length
  for (let i = 0; i < purpleSealCount; i++) {
    if (draft.consumables.length < draft.maxConsumables) {
      const randomTarotCardsSeed = buildSeedString([
        draft.gameSeed,
        draft.roundIndex.toString(),
        draft.shopState.rerollsUsed.toString(),
        'purpleSeal',
      ])
      draft.consumables.push(initializeTarotCard(getRandomTarotCards(1, randomTarotCardsSeed)[0]))
    }
  }
}

/**
 * Gets the probability multiplier based on game state.
 * e.g., "Oops! All 6s" joker doubles all probabilities.
 * TODO: remove specific joker reference from handler--rely on event based system
 */
function getProbabilityMultiplier(game: GameState): number {
  const hasOopsAll6s = game.jokers.some(j => j.jokerId === 'oopsAll6s')
  return hasOopsAll6s ? 2 : 1
}

/**
 * Checks if a lucky roll succeeds.
 * @param baseChance - The base chance as "1 in X" (e.g., 5 means 1 in 5 = 20%)
 * @param seed - Seed string for deterministic random
 * @param game - Game state to check for probability modifiers
 */
function checkLuckyRoll(baseChance: number, seed: string, game: GameState): boolean {
  const multiplier = getProbabilityMultiplier(game)
  // Base probability is 1/baseChance, multiplied by the modifier
  const probability = Math.min(1, (1 / baseChance) * multiplier)
  const roll = getRandomFloatWithSeed(seed)
  return roll < probability
}

function scoreCardOnce(
  draft: GameState,
  card: (typeof draft.gamePlayState.cardsToScore)[number],
  event: GameEvent
) {
  const gamePlayState = draft.gamePlayState

  let cardChips = playingCards[card.playingCardId].baseChips
  let cardMult = 0

  // Enchantments (additive)
  if (card.flags.enchantment === 'bonus') cardChips += 30
  if (card.flags.enchantment === 'mult') cardMult += 5

  // Editions (additive)
  if (card.flags.edition === 'foil') cardChips += 50
  if (card.flags.edition === 'holographic') cardMult += 10

  if (cardChips > 0) {
    draft.gamePlayState.scoringEvents.push({
      id: uuid(),
      type: 'chips',
      value: cardChips,
      source: playingCards[card.playingCardId].value,
    })
  }

  if (cardMult > 0) {
    draft.gamePlayState.scoringEvents.push({
      id: uuid(),
      type: 'mult',
      value: cardMult,
      source: playingCards[card.playingCardId].value,
    })
  }

  gamePlayState.score = {
    chips: gamePlayState.score.chips + cardChips,
    mult: gamePlayState.score.mult + cardMult,
  }

  // Polychrome edition: X1.5 Mult (multiplicative, applied after additive bonuses)
  if (card.flags.edition === 'polychrome') {
    gamePlayState.score.mult *= 1.5
    draft.gamePlayState.scoringEvents.push({
      id: uuid(),
      type: 'mult',
      operator: 'x',
      value: 1.5,
      source: playingCards[card.playingCardId].value,
    })
  }

  // Gold seal: earn $3 immediately when scored
  if (card.flags.seal === 'gold') {
    draft.money += 3
  }

  // Lucky enchantment: 1 in 5 chance for +20 Mult, 1 in 15 chance for $20
  // Both effects roll separately and can both trigger
  if (card.flags.enchantment === 'lucky') {
    const multSeed = buildSeedString([
      draft.gameSeed,
      card.id,
      'lucky-mult',
      String(draft.handsPlayed),
    ])
    const moneySeed = buildSeedString([
      draft.gameSeed,
      card.id,
      'lucky-money',
      String(draft.handsPlayed),
    ])

    if (checkLuckyRoll(5, multSeed, draft)) {
      draft.gamePlayState.scoringEvents.push({
        id: uuid(),
        type: 'mult',
        value: 20,
        source: 'Lucky',
      })
      gamePlayState.score.mult += 20
    }

    if (checkLuckyRoll(15, moneySeed, draft)) {
      draft.money += 20
    }
  }

  const currentBlind = getInProgressBlind(draft as unknown as GameState)
  if (!currentBlind) return

  const playedCards = draft.gamePlayState.selectedHand?.[1]
  const ctx: EffectContext = {
    event,
    game: draft as unknown as GameState,
    score: gamePlayState.score,
    playedCards,
    scoredCards: [card],
    round: draft.rounds[draft.roundIndex],
    bossBlind: draft.rounds[draft.roundIndex].bossBlind,
    jokers: draft.jokers,
    vouchers: draft.vouchers,
    tags: draft.tags,
  }
  dispatchEffects(event, ctx, collectEffects(ctx.game))
}

export function handleCardScored(draft: GameState, event: GameEvent) {
  const gamePlayState = draft.gamePlayState
  const currentCardToScore = gamePlayState.cardsToScore.shift()
  if (!currentCardToScore) return
  const scoredCardId = currentCardToScore.id
  const hasRedSeal = currentCardToScore.flags.seal === 'red'

  // Score the card (and score again if it has a red seal)
  scoreCardOnce(draft, currentCardToScore, event)
  if (hasRedSeal) {
    scoreCardOnce(draft, currentCardToScore, event)
  }

  // remove card from selection & hand UI (only once, regardless of red seal)
  gamePlayState.selectedCardIds = gamePlayState.selectedCardIds.filter(id => id !== scoredCardId)
  if (gamePlayState.selectedHand) {
    gamePlayState.selectedHand = [
      gamePlayState.selectedHand[0],
      gamePlayState.selectedHand[1].filter(card => card.id !== scoredCardId),
    ]
  }

  // remove scored card from hand
  gamePlayState.handIds = gamePlayState.handIds.filter(id => id !== scoredCardId)
}

export function handleHandScoringStart(draft: GameState, event: GameEvent) {
  const gamePlayState = draft.gamePlayState
  const selectedCards = getSelectedCards(draft as unknown as GameState)
  const { hand: playedHand, handCards: cardsToScore } = findHighestPriorityHand(
    selectedCards,
    draft.staticRules
  )
  gamePlayState.cardsToScore = cardsToScore
  gamePlayState.playedCardIds = gamePlayState.selectedCardIds

  gamePlayState.remainingHands -= 1

  const playedHandLevel = draft.pokerHands[playedHand].level - 1

  // ensure hand is no longer secret once played
  draft.pokerHands[playedHand].isSecret = false

  // increment the times the hand has been played
  draft.pokerHands[playedHand].timesPlayed += 1

  const handMult =
    pokerHands[playedHand].baseMult + pokerHands[playedHand].multIncreasePerLevel * playedHandLevel
  const handChips =
    pokerHands[playedHand].baseChips + pokerHands[playedHand].chipIncreasePerLevel * playedHandLevel

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
    tags: draft.tags,
  }
  dispatchEffects(event, ctx, collectEffects(ctx.game))
}

export function handleHandScoringDoneCardScoring(draft: GameState) {
  const currentBlind = getInProgressBlind(draft)
  if (!currentBlind) return
  const totalReward =
    getBlindDefinition(currentBlind.type, draft.rounds[draft.roundIndex]).baseReward +
    currentBlind.additionalRewards.reduce((acc, reward) => acc + reward[1], 0)
  draft.money += totalReward
  currentBlind.status = 'completed'
  draft.gamePhase = 'shop'
  // Only generate a new voucher after completing the small blind (start of new round)
  if (currentBlind.type === 'smallBlind') {
    draft.shopState.voucher = getRandomVoucherType(draft)
  }
  draft.gamePlayState.drawPileIds = draft.ownedCardIds
  draft.gamePlayState.remainingHands = draft.maxHands
  if (currentBlind.type === 'bossBlind') {
    draft.roundIndex += 1
  }
  draft.gamePlayState.scoringEvents = []
  draft.gamePlayState.remainingDiscards = draft.maxDiscards

  // Reset shop state for the new shop session
  draft.shopState.cardsForSale = []
  draft.shopState.packsForSale = []
  draft.shopState.rerollsUsed = 0
  draft.shopState.selectedCardId = null
}
