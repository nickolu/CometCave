/**
 * Material colors for the 3D cabinet. These are the look of objects in the
 * game world, not themeable chrome, so they live here instead of in design
 * tokens — the same exemption Micro Land's renderer has. The HUD around the
 * canvas is chrome and uses tokens.
 *
 * Placeholder look for the physics test: plain lit solids, no textures.
 */
export const PALETTE = {
  background: '#0a0b14',
  floor: '#232638',
  glassWall: '#8fa3ff',
  backWall: '#2c3048',
  pusher: '#4a5078',
  puck: '#e8b84a',
  chute: '#ffd166',
  gutter: '#ff5d73',
  arm: '#9aa3c7',
  ring: '#5ee6ff',
  ringHit: '#7dffb0',
  /** Hoop-La Cannon: a brass cannon, red-and-white hoops, the dotted arc. */
  brass: '#c9973a',
  hoop: '#ff5d73',
  hoopLabel: '#fff3c4',
  /** The on-table timing cue. */
  cue: '#fff3c4',
  obstacle: '#7f86ad',
  /** The Cairn: an icy floor and stone posts. */
  ice: '#3b5f73',
  stone: '#9a9384',
  /** The Bedtime Book: paper pages, a dark spine, ink words and white dreams. */
  page: '#e8dcc0',
  pageEdge: '#bfae8a',
  spine: '#1b1430',
  ribbon: '#c2185b',
  word: '#2f3f9e',
  dream: '#f7f5ff',
  dreamMark: '#e0a526',
  /** Redline: amber coins, with bonus coins a paler gold (and notched). */
  amber: '#f08a24',
  bonus: '#ffd98a',
  /** Gravity Assist: silver coins, dark meteorites, a pale moon. */
  silver: '#c9d1e3',
  meteorite: '#4a3b36',
  meteoriteMark: '#ff9a5c',
  moon: '#e6e9f5',
  moonMark: '#a7aec7',
  /** Comet Homecoming: the pale-blue core with a gold star cap. */
  core: '#9fd8ff',
  coreMark: '#ffd166',
  /** Moonstone Porch: glowing pale-blue moonstones, a glass jar, the crane. */
  moonstone: '#a9cbff',
  moonstoneMark: '#4b5fa8',
  moonstoneRim: '#f2f8ff',
  jar: '#bfe4ff',
  jarLid: '#c9973a',
  crane: '#d96b4a',
  craneRail: '#5a6080',
  chocolate: '#6b3a22',
  chocolateMark: '#3f1f10',
  truffle: '#2e1810',
  cherry: '#d7263d',
  /** Bramble's Midnight Snack: the bakery belt and oven, and Bramble itself. */
  belt: '#5a4a6e',
  beltRidge: '#3d3150',
  oven: '#b5654a',
  ovenGlow: '#ffb35c',
  hatch: '#140c10',
  bramble: '#7b6bd6',
  brambleBelly: '#a99cf0',
  brambleMouth: '#2a0f2e',
  brambleTongue: '#ff8fb1',
  brambleCheek: '#ff9ec4',
  brambleEye: '#fffaf0',
  bramblePupil: '#1a1026',
  tooth: '#fffaf0',
  duck: '#ffd23f',
  duckBeak: '#ff8c42',
  bow: '#ff5fa2',
} as const
