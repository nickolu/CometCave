export function getJokerSellValue(
  jokerDefinition: { price: number },
  jokerState: { bonusSellValue: number }
): number {
  return Math.floor(jokerDefinition.price / 2) + jokerState.bonusSellValue
}

export function getConsumableSellValue(consumableDefinition: { price: number }): number {
  return Math.floor(consumableDefinition.price / 2)
}
