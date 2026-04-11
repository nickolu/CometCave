export type SkillCategory = 'combat' | 'survival' | 'utility' | 'exploration'

export type SkillEffectType = 'stat_bonus' | 'percentage_bonus' | 'flat_bonus' | 'special'

export type SkillEffect = {
  type: SkillEffectType
  target: string // what it modifies: 'maxHp', 'attack', 'defense', 'flee_chance', 'heal_rate', 'shop_discount', 'loot_chance', 'mana_regen', 'gold_bonus', 'combo_rate', 'spell_cost', 'damage_low_hp', 'poison_resist', 'auto_walk_speed', 'luck', 'all_stats'
  value: number // amount or percentage
}

export type SkillRequirement = {
  type: 'achievement' | 'level' | 'distance' | 'combats_won'
  value: string | number // achievement ID or numeric threshold
}

export type Skill = {
  id: string
  name: string
  description: string
  icon: string
  category: SkillCategory
  effect: SkillEffect
  requirement: SkillRequirement
}
