import { ON_POST_RADIUS, TOWER_SLACK, landsOnPost, measureTower } from './stacks'

const POST = { x: 2, z: 0.5, radius: 0.7, height: 0.8 }
const coin = (dx: number, y: number, vy = 0) => ({ x: POST.x + dx, y, z: POST.z, vy })

describe('measureTower', () => {
  it('counts resting coins above the post', () => {
    expect(measureTower(POST, [coin(0, 0.89), coin(0.2, 1.07), coin(-0.1, 1.25)])).toBe(3)
  })

  it('ignores coins on the floor, off to the side, or falling past', () => {
    expect(measureTower(POST, [coin(0, 0.09)])).toBe(0)
    expect(measureTower(POST, [coin(POST.radius + TOWER_SLACK + 0.05, 0.89)])).toBe(0)
    expect(measureTower(POST, [coin(0, 2, -6)])).toBe(0)
  })
})

describe('landsOnPost', () => {
  it('is true only near the post center', () => {
    expect(landsOnPost(POST, POST.x + ON_POST_RADIUS * 0.9, POST.z)).toBe(true)
    expect(landsOnPost(POST, POST.x + ON_POST_RADIUS * 1.1, POST.z)).toBe(false)
  })
})
