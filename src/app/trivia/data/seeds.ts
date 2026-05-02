/**
 * Seed system for generating unique trivia questions.
 *
 * Per-category seed lists live in ./seeds/. This file assembles them
 * into the keyed map consumed by lib/trivia/generateQuestion.ts.
 */

import { GENERAL_KNOWLEDGE_SEEDS } from './seeds/09-general-knowledge'
import { BOOKS_SEEDS } from './seeds/10-books'
import { FILM_SEEDS } from './seeds/11-film'
import { MUSIC_SEEDS } from './seeds/12-music'
import { MUSICALS_SEEDS } from './seeds/13-musicals'
import { TELEVISION_SEEDS } from './seeds/14-television'
import { VIDEO_GAMES_SEEDS } from './seeds/15-video-games'
import { BOARD_GAMES_SEEDS } from './seeds/16-board-games'
import { SCIENCE_SEEDS } from './seeds/17-science'
import { COMPUTERS_SEEDS } from './seeds/18-computers'
import { MATHEMATICS_SEEDS } from './seeds/19-mathematics'
import { MYTHOLOGY_SEEDS } from './seeds/20-mythology'
import { SPORTS_SEEDS } from './seeds/21-sports'
import { GEOGRAPHY_SEEDS } from './seeds/22-geography'
import { HISTORY_SEEDS } from './seeds/23-history'
import { POLITICS_SEEDS } from './seeds/24-politics'
import { ART_SEEDS } from './seeds/25-art'
import { CELEBRITIES_SEEDS } from './seeds/26-celebrities'
import { ANIMALS_SEEDS } from './seeds/27-animals'
import { VEHICLES_SEEDS } from './seeds/28-vehicles'
import { COMICS_SEEDS } from './seeds/29-comics'
import { GADGETS_SEEDS } from './seeds/30-gadgets'
import { ANIME_SEEDS } from './seeds/31-anime'
import { CARTOONS_SEEDS } from './seeds/32-cartoons'

export { getOpenTDBCategoryName } from './seeds/categoryNames'
export { MODIFIERS } from './seeds/modifiers'

export const CATEGORIZED_SEEDS: Record<number, string[]> = {
  9: GENERAL_KNOWLEDGE_SEEDS,
  10: BOOKS_SEEDS,
  11: FILM_SEEDS,
  12: MUSIC_SEEDS,
  13: MUSICALS_SEEDS,
  14: TELEVISION_SEEDS,
  15: VIDEO_GAMES_SEEDS,
  16: BOARD_GAMES_SEEDS,
  17: SCIENCE_SEEDS,
  18: COMPUTERS_SEEDS,
  19: MATHEMATICS_SEEDS,
  20: MYTHOLOGY_SEEDS,
  21: SPORTS_SEEDS,
  22: GEOGRAPHY_SEEDS,
  23: HISTORY_SEEDS,
  24: POLITICS_SEEDS,
  25: ART_SEEDS,
  26: CELEBRITIES_SEEDS,
  27: ANIMALS_SEEDS,
  28: VEHICLES_SEEDS,
  29: COMICS_SEEDS,
  30: GADGETS_SEEDS,
  31: ANIME_SEEDS,
  32: CARTOONS_SEEDS,
}
