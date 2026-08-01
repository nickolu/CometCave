/**
 * Pixel art for the summon loader.
 *
 * Hand-drawn stand-ins shown while the model is drawing the real thing —
 * creatures in the size range the real ones come back in, and land built from
 * the world's own material colors. Asset data, like the creature and material
 * palettes next door, which is why the colors are literal.
 *
 * Eyes are bright rather than dark: the loader assembles these out of falling
 * grains, and a dark pixel disappears against the panel on the way down.
 */
import { MATERIALS } from '@/app/micro-land/domain/config/materials'

export interface LoaderShape {
  /** Maps a character in `rows` to a color. `.` is empty. */
  palette: Record<string, string>
  /** What the eye takes on while blinking — the body color around it. */
  blink: string
  /** All rows must be the same length. */
  rows: string[]
}

export const LOADER_CREATURE_SHAPES: LoaderShape[] = [
  // Snail — shell behind, foot along the ground.
  {
    palette: { d: '#e0a83c', s: '#ffd166', b: '#5eead4', e: '#e6fff7' },
    blink: '#5eead4',
    rows: [
      '...ddd....',
      '..dsssd..b',
      '..ds.sd.b.',
      '..dsssd.bb',
      '...ddd.beb',
      '.bbbbbbbbb',
      '..bbbbbbb.',
    ],
  },
  // Moth — wings out, fat little body.
  {
    palette: { w: '#c084fc', v: '#8b5cf6', b: '#ffd166', e: '#e6fff7' },
    blink: '#ffd166',
    rows: [
      '.v.....v.',
      'vwwv.vwwv',
      'wwwwbwwww',
      '.wwwbwww.',
      '..wwbww..',
      '...beb...',
      '...b.b...',
    ],
  },
  // Fish — tail on the left, facing right like everything else here.
  {
    palette: { f: '#5eead4', t: '#2dd4bf', e: '#e6fff7' },
    blink: '#5eead4',
    rows: [
      't....fff..',
      'tt..ffffff',
      'tttfffefff',
      'ttffffffff',
      'tttfffffff',
      'tt..ffffff',
      't....fff..',
    ],
  },
  // Beetle — round back, legs splayed.
  {
    palette: { h: '#ff6b9d', l: '#b23a63', e: '#e6fff7' },
    blink: '#ff6b9d',
    // Short enough that prettier would fold it onto one line, which stops the
    // drawing from being a drawing.
    // prettier-ignore
    rows: [
      '..hhhhh..',
      '.hhhhhhh.',
      'hhhhhhheh',
      '.hhhhhhh.',
      '.l.l.l.l.',
      'l.......l',
    ],
  },
]

/** Land in the world's own colors, so the grains fall as real dirt and water. */
const TERRAIN_PALETTE = {
  g: MATERIALS.grass.color,
  d: MATERIALS.dirt.color,
  s: MATERIALS.stone.color,
  w: MATERIALS.water.color,
}

export const LOADER_TERRAIN_SHAPES: LoaderShape[] = [
  // Floating island, trailing a waterfall.
  {
    palette: TERRAIN_PALETTE,
    blink: TERRAIN_PALETTE.g,
    rows: [
      '......gggggggg......',
      '.....dddddddddd.....',
      '.....ssssssssss.....',
      '......ssssssss......',
      '.......ssssss.......',
      '........ssss........',
      '.........ss.........',
      '.........w..........',
      '..........w.........',
    ],
  },
  // A mountain with a cave hollowed out of it.
  {
    palette: TERRAIN_PALETTE,
    blink: TERRAIN_PALETTE.s,
    rows: [
      '.........gg.........',
      '........gddg........',
      '.......gddddg.......',
      '......gddddddg......',
      '.....gdd....ddg.....',
      '....gdd......ddg....',
      '..gddddddddddddddg..',
      '.ssssssssssssssssss.',
    ],
  },
  // Low ground with two pools in it.
  {
    palette: TERRAIN_PALETTE,
    blink: TERRAIN_PALETTE.d,
    rows: [
      '..gggg...gggg...ggg.',
      '.dddddwwwddddwwwdddd',
      '.dddddwwwddddwwwdddd',
      '.dddddddddddddddddd.',
      '..ssssssssssssssss..',
    ],
  },
]
