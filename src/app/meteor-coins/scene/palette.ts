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
} as const
