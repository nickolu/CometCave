export function flipCoin(headsProbability = 0.5, tailsProbability = 0.5): boolean {
  const eventWeights = [
    { type: 0, weight: headsProbability },
    { type: 1, weight: tailsProbability },
  ]
  const totalWeight = eventWeights.reduce((sum, entry) => sum + entry.weight, 0)
  const rand = Math.random() * totalWeight
  let acc = 0
  let roll = 0
  for (let i = 0; i < eventWeights.length; i++) {
    acc += eventWeights[i].weight
    if (rand < acc) {
      roll = eventWeights[i].type
      break
    }
  }
  return Boolean(roll)
}
