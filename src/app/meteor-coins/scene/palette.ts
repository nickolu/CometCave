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
  /** The on-table timing cue. */
  cue: '#fff3c4',
  obstacle: '#7f86ad',
  moonstone: '#efe6cf',
  moonstoneMark: '#6f7fae',
  chocolate: '#6b3a22',
  chocolateMark: '#3f1f10',
  truffle: '#2e1810',
  cherry: '#d7263d',
  duck: '#ffd23f',
  duckBeak: '#ff8c42',
  bow: '#ff5fa2',
} as const
