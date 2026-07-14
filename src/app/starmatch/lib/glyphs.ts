/* ---------------------------------------------------------------------------
   Starmatch — glyph pool & player identity
   Cosmic / celestial / natural emoji so decks feel like star charts, not
   clip-art. Shuffled and sliced per match, so no two rounds look alike.
   -------------------------------------------------------------------------- */

export type DiffKey = 'easy' | 'medium' | 'cosmic'

export interface Diff {
  /** projective-plane order (must be prime): guarantees exactly one shared glyph */
  order: number
  label: string
  /** glyphs per chart = order + 1 */
  sym: number
}

export const DIFFS: Record<DiffKey, Diff> = {
  easy: { order: 3, label: 'Nebula', sym: 4 },
  medium: { order: 5, label: 'Stellar', sym: 6 },
  cosmic: { order: 7, label: 'Cosmic', sym: 8 },
}

export const DIFF_ORDER: DiffKey[] = ['easy', 'medium', 'cosmic']

/* A cosmic bestiary of signs. Needs >= order*order+order+1 = 57 for Cosmic. */
export const GLYPHS: string[] = [
  '🪐', '⭐', '🌙', '☄️', '🌟', '✨', '🌈', '🔮',
  '🚀', '🛸', '🌌', '🌠', '☀️', '🌛', '🌚', '⚡',
  '🔥', '💧', '❄️', '🌊', '🌸', '🌵', '🍄', '🍀',
  '🌴', '🌲', '🐚', '🦋', '🐙', '🐢', '🦉', '🦄',
  '🐉', '🕊️', '🔱', '🧿', '💎', '👁️', '🗝️', '🔔',
  '🏔️', '🌋', '🪷', '🌻', '🌼', '🍁', '🦩', '🦚',
  '🐳', '🐬', '🦈', '🌾', '🪶', '⚓', '🧭', '🛰️',
  '🪁', '🎐', '🌀', '🐝', '🦕', '🌷', '🪸', '🌰',
]

/* Player accent colors — CometCave palette tokens (defined in globals.css).
   Kept as CSS-var references so DOM inline styles resolve them and the color
   system stays single-sourced; the confetti canvas resolves them to concrete
   values at draw time. */
export const PLAYER_COLORS = [
  'var(--sm-c0)', // neon mint
  'var(--sm-c1)', // cyan
  'var(--sm-c2)', // gold
  'var(--sm-c3)', // pink
  'var(--sm-c4)', // purple
  'var(--sm-c5)', // coral
  'var(--sm-c6)', // blue
  'var(--sm-c7)', // lime
]

export const PLAYER_GLYPHS = ['🪐', '⭐', '🌙', '☄️', '🚀', '🛸', '🔮', '🌟']

export const MAX_PLAYERS = PLAYER_COLORS.length
