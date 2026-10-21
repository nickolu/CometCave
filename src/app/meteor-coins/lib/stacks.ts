/**
 * What counts as a tower, for The Cairn: coins resting on a post, above its
 * top. Pure, so the rule is tested without physics.
 *
 * A coin counts when it's at rest (not falling past) and its center is over
 * the post, give or take a little — a coin hanging further out than that is
 * on its way off.
 */

/** How far past the post's edge a coin's center may sit and still count. */
export const TOWER_SLACK = 0.15
/** Faster than this up or down, a coin is falling, not resting. */
const RESTING_VY = 0.5

export type TowerPost = { x: number; z: number; radius: number; height: number }
export type CoinState = { x: number; y: number; z: number; vy: number }

/** Coins high on one post. `z` is where the post stands now (a post can ride the pusher). */
export function measureTower(post: TowerPost, coins: Iterable<CoinState>): number {
  let count = 0
  for (const c of coins) {
    if (c.y < post.height) continue
    if (Math.abs(c.vy) > RESTING_VY) continue
    if (Math.hypot(c.x - post.x, c.z - post.z) > post.radius + TOWER_SLACK) continue
    count++
  }
  return count
}

/**
 * Whether a coin landing at (x, z) is centered enough on a post to stay
 * stacked. Measured headless (30 coins onto three posts, aim error spread
 * evenly): within 0.15 of center about nine in ten stayed up; within 0.3,
 * about half.
 */
export const ON_POST_RADIUS = 0.3

export function landsOnPost(post: TowerPost, x: number, z: number): boolean {
  return Math.hypot(x - post.x, z - post.z) <= ON_POST_RADIUS
}
