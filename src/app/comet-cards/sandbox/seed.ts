import { createGameStateWithDeck } from '@/app/comet-cards/domain/game/default-game-state'
import type { GameState } from '@/app/comet-cards/domain/game/types'
import { jokers as jokerRegistry } from '@/app/comet-cards/domain/joker/jokers'
import type { JokerDefinition, JokerState } from '@/app/comet-cards/domain/joker/types'
import { initializeJoker } from '@/app/comet-cards/domain/joker/utils'
import { bossBlinds } from '@/app/comet-cards/domain/round/boss-blinds'
import { implementedTags } from '@/app/comet-cards/domain/tag/tags'
import type { TagType } from '@/app/comet-cards/domain/tag/types'
import { initializeTag } from '@/app/comet-cards/domain/tag/utils'
import type { VoucherType } from '@/app/comet-cards/domain/voucher/types'
import { initializeVoucherState } from '@/app/comet-cards/domain/voucher/utils'
import { vouchers as voucherRegistry } from '@/app/comet-cards/domain/voucher/vouchers'

export interface SandboxConfig {
  deckId: string
  jokerIds: string[]
  jokerEdition: JokerState['edition']
  vouchers: VoucherType[]
  tags: TagType[]
  forcedBossBlindName?: string
  ante: number
  money: number
  maxHands: number
  maxDiscards: number
  maxJokers: number
}

export const defaultSandboxConfig: SandboxConfig = {
  deckId: 'pokerDeck',
  jokerIds: [],
  jokerEdition: 'normal',
  vouchers: [],
  tags: [],
  forcedBossBlindName: undefined,
  ante: 1,
  money: 50,
  maxHands: 4,
  maxDiscards: 3,
  maxJokers: 5,
}

export function buildSandboxState(config: SandboxConfig): GameState {
  // Deep-clone: createGameStateWithDeck shallow-spreads a module-level state,
  // so nested fields like `rounds` and `pokerHands` would otherwise be shared
  // across sandbox sessions and leak mutations.
  const state = structuredClone(createGameStateWithDeck(config.deckId))

  state.gamePhase = 'blindSelection'
  state.money = config.money
  state.maxHands = config.maxHands
  state.maxDiscards = config.maxDiscards
  state.maxJokers = config.maxJokers
  state.gamePlayState.remainingHands = config.maxHands
  state.gamePlayState.remainingDiscards = config.maxDiscards

  const targetAnte = Math.max(0, Math.min(config.ante, state.rounds.length - 1))
  state.roundIndex = targetAnte

  if (config.forcedBossBlindName) {
    state.rounds[targetAnte].bossBlindName = config.forcedBossBlindName
  }

  state.jokers = config.jokerIds
    .map(id => jokerRegistry[id])
    .filter((def): def is JokerDefinition => Boolean(def))
    .map(def => {
      const joker = initializeJoker(def, state)
      joker.edition = config.jokerEdition
      return joker
    })

  state.vouchers = config.vouchers
    .map(type => voucherRegistry[type])
    .filter(Boolean)
    .map(def => initializeVoucherState(def))

  state.tags = config.tags
    .filter(tag => implementedTags[tag])
    .map(tag => initializeTag(tag))

  return state
}

export function listJokerOptions(): {
  id: string
  name: string
  rarity: string
  description: string
}[] {
  return Object.values(jokerRegistry)
    .map(j => ({ id: j.id, name: j.name, rarity: j.rarity, description: j.description }))
    .sort((a, b) => a.name.localeCompare(b.name))
}

export function listVoucherOptions(): { type: VoucherType; name: string; description: string }[] {
  return Object.values(voucherRegistry)
    .map(v => ({ type: v.type, name: v.name, description: v.description }))
    .sort((a, b) => a.name.localeCompare(b.name))
}

export function listTagOptions(): { type: TagType; name: string; benefit: string }[] {
  return Object.values(implementedTags)
    .filter((t): t is NonNullable<typeof t> => Boolean(t))
    .map(t => ({ type: t.tagType, name: t.name, benefit: t.benefit }))
    .sort((a, b) => a.name.localeCompare(b.name))
}

export function listBossBlindOptions(): { name: string; description: string; minimumAnte: number }[] {
  return [...bossBlinds]
    .sort((a, b) => a.name.localeCompare(b.name))
    .map(b => ({ name: b.name, description: b.description, minimumAnte: b.minimumAnte }))
}
