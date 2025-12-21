'use client'

import { create } from 'zustand'

import type { GamePhase, GameState } from '@/app/daily-card-game/domain/game/types'

import { defaultGameState } from './domain/game/default-game-state'
import { findHighestPriorityHand, hands } from './domain/hand/hands'
import { PokerHand } from './domain/hand/types'
import { PlayingCard } from './domain/playing-card/types'
import { getInProgressBlind } from './domain/round/blinds'

const HAND_SIZE = 7

export interface DailyCardGameStore {
  game: GameState
  setGame: (game: GameState) => void
  clearGame: () => void
  setGamePhase: (gamePhase: GamePhase) => void
  dealHand: () => void
  selectCard: (id: string) => void
  deselectCard: (id: string) => void
  discardSelectedCards: () => void
  dealCards: (count: number) => void
  refillHand: () => void
  handScoringStart: () => void
  handScoringEnd: () => void
  cardScored: (cardId: string) => void
  selectSmallBlind: () => void
  selectBigBlind: () => void
  selectBossBlind: () => void
  addMoney: (amount: number) => void
  setBlindCompleted: () => void
}

export const useDailyCardGameStore = create<DailyCardGameStore>()(set => ({
  game: defaultGameState,
  setGame: game => set({ game }),
  clearGame: () => set({ game: defaultGameState }),
  setGamePhase: (gamePhase: GamePhase) => set(state => ({ game: { ...state.game, gamePhase } })),
  addMoney: (amount: number) =>
    set(state => ({ game: { ...state.game, money: state.game.money + amount } })),
  selectSmallBlind: () =>
    set(state => {
      const currentRoundIndex = state.game.roundIndex
      const currentRound = state.game.rounds[currentRoundIndex]
      const newRounds = [...state.game.rounds]
      newRounds[currentRoundIndex] = {
        ...currentRound,
        smallBlind: { ...currentRound.smallBlind, status: 'inProgress' },
      }
      return {
        game: {
          ...state.game,
          rounds: newRounds,
          gamePhase: 'gameplay',
        },
      }
    }),
  selectBigBlind: () =>
    set(state => {
      const currentRoundIndex = state.game.roundIndex
      const currentRound = state.game.rounds[currentRoundIndex]
      const newRounds = [...state.game.rounds]
      newRounds[currentRoundIndex] = {
        ...currentRound,
        bigBlind: { ...currentRound.bigBlind, status: 'inProgress' },
      }
      return {
        game: {
          ...state.game,
          rounds: newRounds,
          gamePhase: 'gameplay',
        },
      }
    }),
  selectBossBlind: () =>
    set(state => {
      const currentRoundIndex = state.game.roundIndex
      const currentRound = state.game.rounds[currentRoundIndex]
      const newRounds = [...state.game.rounds]
      newRounds[currentRoundIndex] = {
        ...currentRound,
        bossBlind: { ...currentRound.bossBlind, status: 'inProgress' },
      }
      return {
        game: {
          ...state.game,
          rounds: newRounds,
          gamePhase: 'gameplay',
        },
      }
    }),
  dealHand: () =>
    set(state => {
      if (state.game.gamePlayState.dealtCards.length) {
        return state
      }
      return {
        game: {
          ...state.game,
          gamePlayState: {
            ...state.game.gamePlayState,
            dealtCards: state.game.gamePlayState.remainingDeck.slice(0, HAND_SIZE),
            remainingDeck: state.game.gamePlayState.remainingDeck.slice(HAND_SIZE),
          },
        },
      }
    }),
  dealCards: (count: number) =>
    set(state => {
      const gamePlayState = state.game.gamePlayState
      const shouldDeal = gamePlayState.dealtCards.length + count <= HAND_SIZE
      const dealtCards = gamePlayState.dealtCards.concat(
        gamePlayState.remainingDeck.slice(0, count)
      )
      const remainingDeck = gamePlayState.remainingDeck.slice(count)

      if (shouldDeal) {
        return {
          game: {
            ...state.game,
            gamePlayState: {
              ...gamePlayState,
              dealtCards,
              remainingDeck,
            },
          },
        }
      }
      throw new Error('Not enough cards to deal')
    }),
  refillHand: () =>
    set(state => {
      const gamePlayState = state.game.gamePlayState
      const cardsToRefill = gamePlayState.remainingDeck.slice(
        0,
        HAND_SIZE - gamePlayState.dealtCards.length
      )
      return {
        game: {
          ...state.game,
          gamePlayState: {
            ...state.game.gamePlayState,
            dealtCards: state.game.gamePlayState.dealtCards.concat(cardsToRefill),
            remainingDeck: gamePlayState.remainingDeck.slice(cardsToRefill.length),
          },
        },
      }
    }),
  selectCard: (id: string) =>
    set(state => {
      const gamePlayState = state.game.gamePlayState
      const selectedCardIds = [...gamePlayState.selectedCardIds, id]
      const selectedCards = gamePlayState.dealtCards.filter(card =>
        selectedCardIds.includes(card.id)
      )
      console.log('selectedCards', selectedCards)
      const selectedHandId = findHighestPriorityHand(selectedCards).hand
      console.log('selectedHandId', selectedHandId)
      const selectedHand = hands[selectedHandId]
      console.log('selectedHand', selectedHand)
      return {
        game: {
          ...state.game,
          gamePlayState: {
            ...state.game.gamePlayState,
            selectedCardIds: [...state.game.gamePlayState.selectedCardIds, id],
            selectedHand: [
              selectedHand,
              gamePlayState.dealtCards.filter(card => selectedCardIds.includes(card.id)),
            ],
          },
        },
      }
    }),
  deselectCard: (id: string) =>
    set(state => {
      const gamePlayState = state.game.gamePlayState
      const selectedCardIds = gamePlayState.selectedCardIds.filter(cardId => cardId !== id)
      const selectedCards = gamePlayState.dealtCards.filter(card =>
        selectedCardIds.includes(card.id)
      )
      let selectedHand: [PokerHand, PlayingCard[]] | undefined = undefined
      if (selectedCards.length === 0) {
        selectedHand = undefined
      } else {
        const selectedHandId = findHighestPriorityHand(selectedCards).hand
        selectedHand = [hands[selectedHandId], selectedCards]
      }
      console.log('selectedHand', selectedHand)
      return {
        game: {
          ...state.game,
          gamePlayState: {
            ...state.game.gamePlayState,
            selectedCardIds: state.game.gamePlayState.selectedCardIds.filter(
              cardId => cardId !== id
            ),
            selectedHand,
          },
        },
      }
    }),
  discardSelectedCards: () =>
    set(state => {
      const gameState = state.game
      const gamePlayState = gameState.gamePlayState
      const cardsToDiscard = gamePlayState.dealtCards.filter(card =>
        gamePlayState.selectedCardIds.includes(card.id)
      )
      const cardsToKeep = gamePlayState.dealtCards.filter(
        card => !gamePlayState.selectedCardIds.includes(card.id)
      )
      console.log('cardsToDiscard', cardsToDiscard)
      console.log('cardsToKeep', cardsToKeep)
      return {
        game: {
          ...gameState,
          discardsPlayed: gameState.discardsPlayed + 1,
          gamePlayState: {
            ...gamePlayState,
            selectedCardIds: [],
            dealtCards: cardsToKeep,
            remainingDiscards: gamePlayState.remainingDiscards - 1,
          },
        },
      }
    }),
  cardScored: (cardId: string) => {
    set(state => {
      const gamePlayState = state.game.gamePlayState
      const currentCardToScoreId = cardId
      const currentCardToScore = gamePlayState.dealtCards.find(
        card => card.id === currentCardToScoreId
      )
      if (!currentCardToScore) {
        return state
      }
      const scoreState = gamePlayState.score
      const additionalRewards: [string, number][] = []

      let cardChips = currentCardToScore.baseChips
      let cardMult = 1
      if (currentCardToScore.modifier === 'bonus') {
        cardChips += 10
      }
      if (currentCardToScore.modifier === 'mult') {
        cardMult += 5
      }
      if (currentCardToScore.isFoil) {
        cardMult += 5
      }
      if (currentCardToScore.isHolographic) {
        cardMult += 50
      }
      const newScore = {
        chips: scoreState.chips + cardChips,
        mult: scoreState.mult + cardMult,
      }

      if (currentCardToScore.stamp === 'gold') {
        additionalRewards.push(['goldStamp', 3])
      }

      const currentRoundIndex = state.game.roundIndex

      const currentBlind = getInProgressBlind(state.game)
      if (!currentBlind) {
        return state
      }

      const currentRound = state.game.rounds[currentRoundIndex]
      const updatedBlind = {
        ...currentBlind,
        additionalRewards: [...currentBlind.additionalRewards, ...additionalRewards],
      }
      const updatedRound = {
        ...currentRound,
        [updatedBlind.type]: updatedBlind,
      }
      const newRounds = [...state.game.rounds]
      newRounds[currentRoundIndex] = updatedRound

      const nextSelectedCardIds = gamePlayState.selectedCardIds.filter(
        idToKeep => idToKeep !== currentCardToScoreId
      )
      const nextSelectedHand: [PokerHand, PlayingCard[]] | undefined = gamePlayState.selectedHand
        ? [
            gamePlayState.selectedHand[0],
            gamePlayState.selectedHand[1].filter(card => card.id !== currentCardToScoreId),
          ]
        : undefined

      return {
        game: {
          ...state.game,
          rounds: newRounds,
          gamePlayState: {
            ...state.game.gamePlayState,
            score: newScore,
            selectedCardIds: nextSelectedCardIds,
            selectedHand: nextSelectedHand,
            dealtCards: gamePlayState.dealtCards.filter(card => card.id !== currentCardToScoreId),
          },
        },
      }
    })
  },
  handScoringStart: () => {
    set(state => {
      const gamePlayState = state.game.gamePlayState
      const selectedCards = gamePlayState.dealtCards.filter(card =>
        gamePlayState.selectedCardIds.includes(card.id)
      )
      const playedHand = findHighestPriorityHand(selectedCards).hand

      const playedHandLevel = state.game.pokerHands[playedHand].level
      const handMult = hands[playedHand].baseMult * playedHandLevel
      const handChips = hands[playedHand].baseChips * playedHandLevel

      return {
        game: {
          ...state.game,
          gamePlayState: {
            ...gamePlayState,
            isScoring: true,
            score: {
              chips: handChips,
              mult: handMult,
            },
            selectedHand: [hands[playedHand], selectedCards],
          },
        },
      }
    })
  },
  setBlindCompleted: () => {
    set(state => {
      const currentBlind = getInProgressBlind(state.game)
      if (!currentBlind) {
        throw new Error('No current blind found')
      }
      const newRounds = [...state.game.rounds]
      newRounds[state.game.roundIndex] = {
        ...state.game.rounds[state.game.roundIndex],
        [currentBlind.type]: { ...currentBlind, status: 'completed' },
      }
      return {
        game: {
          ...state.game,
          rounds: newRounds,
        },
      }
    })
  },
  setGameOver: () => {
    set(state => {
      return {
        game: {
          ...state.game,
        },
      }
    })
  },
  updateBlindScore: (
    roundIndex: number,
    blindType: 'smallBlind' | 'bigBlind' | 'bossBlind',
    score: number
  ) => {
    set(state => {
      const newRounds = [...state.game.rounds]
      newRounds[roundIndex] = {
        ...state.game.rounds[roundIndex],
        [blindType]: { ...state.game.rounds[roundIndex][blindType], score },
      }
      return {
        game: {
          ...state.game,
          rounds: newRounds,
        },
      }
    })
  },
  setBlindWon: () => {
    set(state => {
      return {
        game: {
          ...state.game,
          gamePhase: 'blindRewards',
          gamePlayState: {
            ...state.game.gamePlayState,
            isScoring: false,
          },
        },
      }
    })
  },
  playNextHandInBlind: () => {
    set(state => {
      const cardsToRefill = state.game.gamePlayState.remainingDeck.slice(
        0,
        HAND_SIZE - state.game.gamePlayState.dealtCards.length
      )
      return {
        game: {
          ...state.game,
          gamePhase: 'gameplay',
          gamePlayState: {
            ...state.game.gamePlayState,
            isScoring: false,
            remainingHands: state.game.gamePlayState.remainingHands - 1,
            dealtCards: state.game.gamePlayState.dealtCards.concat(cardsToRefill),
            remainingDeck: state.game.gamePlayState.remainingDeck.slice(cardsToRefill.length),
            score: {
              chips: 0,
              mult: 0,
            },
          },
        },
      }
    })
  },
  handScoringEnd: () => {
    set(state => {
      const gamePlayState = state.game.gamePlayState

      // if score is less than the ante, the game is over (player lost)
      // if score is greater or equal to the ante, proceed to the shop
      // add score from blind to total score either way

      const currentRoundIndex = state.game.roundIndex
      const currentBlind = getInProgressBlind(state.game)

      if (!currentBlind) {
        return state
      }
      const blindScore =
        currentBlind.score +
        state.game.gamePlayState.score.chips * state.game.gamePlayState.score.mult

      const newTotalScore = state.game.totalScore + blindScore

      if (!currentBlind) {
        throw new Error('No current blind found')
      }

      const currentAnte =
        currentBlind.anteMultiplier * state.game.rounds[currentRoundIndex].baseAnte
      const currentRound = state.game.rounds[currentRoundIndex]
      const newRounds = [...state.game.rounds]

      // Update the blind score
      newRounds[currentRoundIndex] = {
        ...currentRound,
        [currentBlind.type]: { ...currentBlind, score: blindScore },
      }

      // The player is out of hands and didn't beat the ante, game over
      if (blindScore < currentAnte && gamePlayState.remainingHands === 0) {
        return {
          game: {
            ...state.game,
            gamePlayState: {
              ...gamePlayState,
              isScoring: false,
            },
            gamePhase: 'gameOver',
            totalScore: newTotalScore,
          },
        }
      }

      // The player beat the ante, proceed to the blind won screen
      if (blindScore >= currentAnte) {
        return {
          game: {
            ...state.game,
            rounds: newRounds,
            totalScore: newTotalScore,
            gamePhase: 'blindRewards',
            gamePlayState: {
              ...gamePlayState,
              isScoring: false,
              remainingHands: gamePlayState.remainingHands - 1,
              dealtCards: [],
              remainingDeck: state.game.fullDeck,
              score: {
                chips: 0,
                mult: 0,
              },
            },
          },
        }
      }

      // The player didn't beat the ante, but still has hands left, refill hand and proceed to the next round
      const cardsToRefill = gamePlayState.remainingDeck.slice(
        0,
        HAND_SIZE - gamePlayState.dealtCards.length
      )

      return {
        game: {
          ...state.game,
          rounds: newRounds,
          totalScore: newTotalScore,
          gamePhase: 'gameplay',
          gamePlayState: {
            ...gamePlayState,
            isScoring: false,
            remainingHands: gamePlayState.remainingHands - 1,
            dealtCards: gamePlayState.dealtCards.concat(cardsToRefill),
            remainingDeck: gamePlayState.remainingDeck.slice(cardsToRefill.length),
            score: {
              chips: 0,
              mult: 0,
            },
          },
        },
      }
    })
  },
}))
