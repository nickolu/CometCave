import {
  changingLineDescriptions_01_08,
  hexagramDescriptions_01_08,
} from './hexagrams/hexagrams-01-08'
import {
  changingLineDescriptions_09_16,
  hexagramDescriptions_09_16,
} from './hexagrams/hexagrams-09-16'
import {
  changingLineDescriptions_17_24,
  hexagramDescriptions_17_24,
} from './hexagrams/hexagrams-17-24'
import {
  changingLineDescriptions_25_32,
  hexagramDescriptions_25_32,
} from './hexagrams/hexagrams-25-32'
import {
  changingLineDescriptions_33_40,
  hexagramDescriptions_33_40,
} from './hexagrams/hexagrams-33-40'
import {
  changingLineDescriptions_41_48,
  hexagramDescriptions_41_48,
} from './hexagrams/hexagrams-41-48'
import {
  changingLineDescriptions_49_56,
  hexagramDescriptions_49_56,
} from './hexagrams/hexagrams-49-56'
import {
  changingLineDescriptions_57_64,
  hexagramDescriptions_57_64,
} from './hexagrams/hexagrams-57-64'
import { HexagramDefinition } from './types'

// Combine all hexagram descriptions
export const hexagramDescriptions: Record<HexagramDefinition['number'], string> = {
  ...hexagramDescriptions_01_08,
  ...hexagramDescriptions_09_16,
  ...hexagramDescriptions_17_24,
  ...hexagramDescriptions_25_32,
  ...hexagramDescriptions_33_40,
  ...hexagramDescriptions_41_48,
  ...hexagramDescriptions_49_56,
  ...hexagramDescriptions_57_64,
}

// Combine all changing line descriptions
export const changingLineDescriptions: Record<HexagramDefinition['number'], string[]> = {
  ...changingLineDescriptions_01_08,
  ...changingLineDescriptions_09_16,
  ...changingLineDescriptions_17_24,
  ...changingLineDescriptions_25_32,
  ...changingLineDescriptions_33_40,
  ...changingLineDescriptions_41_48,
  ...changingLineDescriptions_49_56,
  ...changingLineDescriptions_57_64,
}
