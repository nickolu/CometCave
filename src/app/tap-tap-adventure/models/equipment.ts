import { Item } from './item'

export type EquipmentSlotType = 'weapon' | 'armor' | 'accessory'

export type EquipmentSlots = {
  weapon: Item | null
  armor: Item | null
  accessory: Item | null
}

const WEAPON_KEYWORDS = ['sword', 'axe', 'dagger', 'bow', 'staff', 'blade', 'hammer', 'spear']
const ARMOR_KEYWORDS = ['armor', 'shield', 'helm', 'boots', 'cloak', 'robe', 'plate', 'mail']
const ACCESSORY_KEYWORDS = ['ring', 'amulet', 'charm', 'necklace', 'bracelet', 'trinket', 'pendant']

/**
 * Infer which equipment slot an item belongs to based on its name.
 */
export function getEquipmentSlot(item: Item): EquipmentSlotType {
  const name = item.name.toLowerCase()

  if (WEAPON_KEYWORDS.some(k => name.includes(k))) return 'weapon'
  if (ARMOR_KEYWORDS.some(k => name.includes(k))) return 'armor'
  if (ACCESSORY_KEYWORDS.some(k => name.includes(k))) return 'accessory'

  return 'accessory'
}
