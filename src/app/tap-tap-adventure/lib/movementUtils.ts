export interface Vec2 { x: number; y: number }

export function euclidean(a: Vec2, b: Vec2): number {
  return Math.sqrt((b.x - a.x) ** 2 + (b.y - a.y) ** 2)
}

export function moveToward(current: Vec2, target: Vec2, stepSize: number = 1): Vec2 {
  const dist = euclidean(current, target)
  if (dist <= stepSize) return { ...target }
  const dx = target.x - current.x
  const dy = target.y - current.y
  return {
    x: current.x + (dx / dist) * stepSize,
    y: current.y + (dy / dist) * stepSize,
  }
}

export function hasArrived(current: Vec2, target: Vec2, threshold: number = 1.5): boolean {
  return euclidean(current, target) <= threshold
}
