import type { GameState } from '@/app/daily-card-game/domain/game/types'
import {
  buildSeedString,
  getRandomWeightedChoiceWithSeed,
  uuid,
} from '@/app/daily-card-game/domain/randomness'

import { implementedTags as tags } from './tags'

import type { TagState, TagType } from './types'

export function getRandomTag(game: GameState): TagType {
  const seed = buildSeedString([game.gameSeed, game.roundIndex.toString()])
  const randomTagType = getRandomWeightedChoiceWithSeed({
    seed,
    weightedOptions: Object.values(tags).reduce(
      (acc, tagType) => {
        acc[tagType.tagType] = tagType.minimumAnte
        return acc
      },
      {} as Record<TagType, number>
    ),
  })
  return randomTagType ?? 'uncommon'
}

export function initializeTag(tagType: TagType): TagState {
  return {
    id: uuid(),
    tagType,
  }
}
