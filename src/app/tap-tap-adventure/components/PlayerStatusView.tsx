'use client'

import { useState } from 'react'
import { useGameStore } from '@/app/tap-tap-adventure/hooks/useGameStore'
import { getReputationTier, ReputationTier } from '@/app/tap-tap-adventure/lib/contextBuilder'
import { calculateDay, levelProgress, stepsToNextLevel, stepsRequiredForLevel } from '@/app/tap-tap-adventure/lib/leveling'
import { getRegion } from '@/app/tap-tap-adventure/config/regions'
import { getDifficultyMode } from '@/app/tap-tap-adventure/config/difficultyModes'
import { SKILLS } from '@/app/tap-tap-adventure/config/skills'
import { EquipmentSlotType } from '@/app/tap-tap-adventure/models/equipment'
import { FantasyCharacter } from '@/app/tap-tap-adventure/models/character'
import { getMountDisplayName } from '@/app/tap-tap-adventure/lib/mountUtils'
import { getSkillBonus } from '@/app/tap-tap-adventure/lib/skillTracker'
import { MountNamingModal } from '@/app/tap-tap-adventure/components/MountNamingModal'
import { MOUNT_PERSONALITY_INFO } from '@/app/tap-tap-adventure/config/mounts'

interface PlayerStatusViewProps {
  onClose: () => void
}

const REPUTATION_TIER_COLORS: Record<ReputationTier, string> = {
  'Wanted Criminal': 'text-red-400',
  Infamous: 'text-red-400',
  Disreputable: 'text-orange-400',
  Unknown: 'text-slate-400',
  Respected: 'text-blue-400',
  Renowned: 'text-purple-400',
  Legendary: 'text-amber-400',
  'Living Legend': 'text-yellow-300',
}

const REPUTATION_TIER_BG: Record<ReputationTier, string> = {
  'Wanted Criminal': 'bg-red-500',
  Infamous: 'bg-red-400',
  Disreputable: 'bg-orange-400',
  Unknown: 'bg-slate-400',
  Respected: 'bg-blue-400',
  Renowned: 'bg-purple-400',
  Legendary: 'bg-amber-400',
  'Living Legend': 'bg-yellow-300',
}

const SLOT_LABELS: Record<EquipmentSlotType, string> = {
  weapon: 'Weapon',
  armor: 'Armor',
  accessory: 'Accessory',
}

const SLOT_ICONS: Record<EquipmentSlotType, string> = {
  weapon: 'ATK',
  armor: 'DEF',
  accessory: 'LCK',
}

const MOUNT_RARITY_COLORS: Record<string, string> = {
  common: 'text-slate-300 border-slate-500',
  uncommon: 'text-green-300 border-green-500',
  rare: 'text-blue-300 border-blue-500',
  legendary: 'text-yellow-300 border-yellow-500',
}

function SectionCard({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="bg-[#1e1f30] border border-slate-700/50 rounded-lg p-4 space-y-3">
      <h3 className="text-sm font-bold uppercase tracking-wider text-slate-400 border-b border-slate-700/50 pb-2">
        {title}
      </h3>
      {children}
    </div>
  )
}

function StatBar({
  label,
  current,
  max,
  color,
}: {
  label: string
  current: number
  max: number
  color: string
}) {
  const pct = max > 0 ? Math.round((current / max) * 100) : 0
  return (
    <div>
      <div className="flex justify-between text-sm mb-1">
        <span className="text-slate-300">{label}</span>
        <span className="font-bold text-white">
          {current} / {max}
        </span>
      </div>
      <div className="h-2.5 bg-slate-700 rounded-full overflow-hidden">
        <div
          className={`h-full rounded-full transition-all duration-300 ${color}`}
          style={{ width: `${pct}%` }}
        />
      </div>
    </div>
  )
}

function getMetaBonusDescriptions(bonuses: ReturnType<typeof useGameStore.getState>['getMetaBonuses'] extends () => infer R ? R : never): string[] {
  const lines: string[] = []
  if (bonuses.bonusHp > 0) lines.push(`+${bonuses.bonusHp} Max HP`)
  if (bonuses.bonusStrength > 0) lines.push(`+${bonuses.bonusStrength} Strength`)
  if (bonuses.bonusIntelligence > 0) lines.push(`+${bonuses.bonusIntelligence} Intelligence`)
  if (bonuses.bonusLuck > 0) lines.push(`+${bonuses.bonusLuck} Luck`)
  if (bonuses.bonusGold > 0) lines.push(`+${bonuses.bonusGold} Starting Gold`)
  if (bonuses.bonusMana > 0) lines.push(`+${bonuses.bonusMana} Max Mana`)
  if (bonuses.healRateMultiplier > 1) lines.push(`${Math.round((bonuses.healRateMultiplier - 1) * 100)}% Heal Rate Bonus`)
  if (bonuses.xpMultiplier > 1) lines.push(`${Math.round((bonuses.xpMultiplier - 1) * 100)}% XP Bonus`)
  if (bonuses.shopDiscount > 0) lines.push(`${bonuses.shopDiscount}% Shop Discount`)
  if (bonuses.lootBonusChance > 0) lines.push(`${bonuses.lootBonusChance}% Loot Bonus`)
  return lines
}

export function PlayerStatusView({ onClose }: PlayerStatusViewProps) {
  const { getSelectedCharacter, getMetaBonuses: getMetaBonusesFn, setMount } = useGameStore()
  const [showRenameModal, setShowRenameModal] = useState(false)

  const character = getSelectedCharacter()
  if (!character) return null

  const distance = character.distance ?? 0
  const level = character.level ?? 1
  const day = calculateDay(distance)
  const progress = levelProgress(distance)
  const stepsNeeded = stepsToNextLevel(level)
  const stepsIntoLevel = distance - stepsRequiredForLevel(level)
  const hp = character.hp ?? character.maxHp ?? 100
  const maxHp = character.maxHp ?? 100
  const mana = character.mana ?? character.maxMana ?? 20
  const maxMana = character.maxMana ?? 20
  const reputation = character.reputation ?? 0
  const reputationTier = getReputationTier(reputation)
  const region = getRegion(character.currentRegion ?? 'green_meadows')
  const difficultyMode = getDifficultyMode(character.difficultyMode ?? 'normal')
  const metaBonuses = getMetaBonusesFn()
  const metaBonusDescriptions = getMetaBonusDescriptions(metaBonuses)
  const equipment = character.equipment ?? { weapon: null, armor: null, accessory: null }
  const spellbook = character.spellbook ?? []
  const unlockedSkillIds = new Set(character.unlockedSkills ?? [])
  const unlockedSkills = SKILLS.filter(s => unlockedSkillIds.has(s.id))
  const mount = character.activeMount

  // Reputation bar position: reputation range is -100 to 200, total 300
  const repBarPct = Math.max(0, Math.min(100, ((reputation + 100) / 300) * 100))

  // Equipment stat bonuses from each piece
  const getEquipmentBonuses = (char: FantasyCharacter) => {
    const eq = char.equipment ?? { weapon: null, armor: null, accessory: null }
    let str = 0, int = 0, lck = 0, cha = 0
    for (const item of [eq.weapon, eq.armor, eq.accessory]) {
      if (item?.effects) {
        str += item.effects.strength ?? 0
        int += item.effects.intelligence ?? 0
        lck += item.effects.luck ?? 0
        cha += item.effects.charisma ?? 0
      }
    }
    return { strength: str, intelligence: int, luck: lck, charisma: cha }
  }

  // Mount bonuses
  const getMountBonuses = () => {
    if (!mount) return { strength: 0, intelligence: 0, luck: 0, charisma: 0 }
    return {
      strength: mount.bonuses.strength ?? 0,
      intelligence: mount.bonuses.intelligence ?? 0,
      luck: mount.bonuses.luck ?? 0,
      charisma: 0,
    }
  }

  const equipBonuses = getEquipmentBonuses(character)
  const mountStatBonuses = getMountBonuses()

  const getSkillStatBonuses = () => {
    const strBonus = getSkillBonus(unlockedSkills, 'strength')
    const intBonus = getSkillBonus(unlockedSkills, 'intelligence')
    const lckBonus = getSkillBonus(unlockedSkills, 'luck')
    const chaBonus = getSkillBonus(unlockedSkills, 'charisma')
    const allBonus = getSkillBonus(unlockedSkills, 'all_stats')
    return {
      strength: strBonus.flat + allBonus.flat,
      intelligence: intBonus.flat + allBonus.flat,
      luck: lckBonus.flat + allBonus.flat,
      charisma: chaBonus.flat + allBonus.flat,
    }
  }
  const skillBonuses = getSkillStatBonuses()

  const baseStr = character.strength - equipBonuses.strength - mountStatBonuses.strength - metaBonuses.bonusStrength - skillBonuses.strength
  const baseInt = character.intelligence - equipBonuses.intelligence - mountStatBonuses.intelligence - metaBonuses.bonusIntelligence - skillBonuses.intelligence
  const baseLck = character.luck - equipBonuses.luck - mountStatBonuses.luck - metaBonuses.bonusLuck - skillBonuses.luck
  const baseCha = character.charisma - equipBonuses.charisma - mountStatBonuses.charisma - skillBonuses.charisma

  const formatBonus = (base: number, equip: number, mountB: number, meta: number, skill: number) => {
    const parts: string[] = [`${base} base`]
    if (equip > 0) parts.push(`+${equip} equip`)
    if (mountB > 0) parts.push(`+${mountB} mount`)
    if (meta > 0) parts.push(`+${meta} eternal`)
    if (skill > 0) parts.push(`+${skill} skills`)
    return parts.join(', ')
  }

  return (
    <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm overflow-hidden flex flex-col">
      {/* Fixed header with close button */}
      <div className="shrink-0 bg-[#1a1b2e] border-b border-slate-700/50 px-4 py-3 flex items-center justify-between">
        <h2 className="text-lg font-bold text-white">Character Status</h2>
        <button
          onClick={onClose}
          className="px-3 py-1.5 text-sm font-semibold rounded border border-slate-600 bg-[#2a2b3f] hover:bg-[#3a3c56] text-slate-200 transition-colors"
        >
          Close
        </button>
      </div>

      {/* Scrollable content */}
      <div className="flex-1 overflow-y-auto bg-[#1a1b2e]">
        <div className="max-w-2xl mx-auto px-4 py-4 space-y-4">
          {/* Header section */}
          <SectionCard title="Character">
            <div className="space-y-2">
              <div className="flex items-center gap-3 flex-wrap">
                <span className="text-xl font-bold text-white">{character.name}</span>
                <span className="text-sm text-slate-400">
                  {character.race} {character.class}
                </span>
              </div>
              {character.classData?.description && (
                <p className="text-xs text-slate-500 italic">{character.classData.description}</p>
              )}
              <div className="flex flex-wrap gap-3 text-sm">
                <span className="text-orange-300">
                  Level {level}
                  <span className="text-xs text-slate-500 ml-1">
                    ({stepsIntoLevel}/{stepsNeeded} to next)
                  </span>
                </span>
                <span className="text-slate-400">Day {day}</span>
                <span className="text-slate-400">{distance} km</span>
              </div>
              <div className="flex items-center gap-2">
                <span className="text-emerald-300 text-sm">
                  {region.icon} {region.name}
                </span>
              </div>
              {/* Level progress bar */}
              <div className="h-1.5 bg-slate-700 rounded-full overflow-hidden">
                <div
                  className="h-full bg-orange-400 rounded-full transition-all"
                  style={{ width: `${progress * 100}%` }}
                />
              </div>
            </div>
          </SectionCard>

          {/* Core Stats */}
          <SectionCard title="Core Stats">
            <div className="space-y-3">
              <StatBar label="HP" current={hp} max={maxHp} color="bg-green-500" />
              <StatBar label="Mana" current={mana} max={maxMana} color="bg-blue-500" />

              <div className="grid grid-cols-2 gap-3 pt-1">
                <div className="bg-[#161723] rounded-lg p-3 border border-slate-700/30">
                  <div className="text-xs text-slate-500 mb-1">Strength</div>
                  <div className="text-xl font-bold text-purple-300">{character.strength}</div>
                  <div className="text-[10px] text-slate-500 mt-0.5">
                    {formatBonus(baseStr, equipBonuses.strength, mountStatBonuses.strength, metaBonuses.bonusStrength, skillBonuses.strength)}
                  </div>
                </div>
                <div className="bg-[#161723] rounded-lg p-3 border border-slate-700/30">
                  <div className="text-xs text-slate-500 mb-1">Intelligence</div>
                  <div className="text-xl font-bold text-blue-300">{character.intelligence}</div>
                  <div className="text-[10px] text-slate-500 mt-0.5">
                    {formatBonus(baseInt, equipBonuses.intelligence, mountStatBonuses.intelligence, metaBonuses.bonusIntelligence, skillBonuses.intelligence)}
                  </div>
                </div>
                <div className="bg-[#161723] rounded-lg p-3 border border-slate-700/30">
                  <div className="text-xs text-slate-500 mb-1">Luck</div>
                  <div className="text-xl font-bold text-yellow-300">{character.luck}</div>
                  <div className="text-[10px] text-slate-500 mt-0.5">
                    {formatBonus(baseLck, equipBonuses.luck, mountStatBonuses.luck, metaBonuses.bonusLuck, skillBonuses.luck)}
                  </div>
                </div>
                <div className="bg-[#161723] rounded-lg p-3 border border-slate-700/30">
                  <div className="text-xs text-slate-500 mb-1">Charisma</div>
                  <div className="text-xl font-bold text-pink-400">{character.charisma}</div>
                  <div className="text-[10px] text-slate-500 mt-0.5">
                    {formatBonus(baseCha, equipBonuses.charisma, mountStatBonuses.charisma, 0, skillBonuses.charisma)}
                  </div>
                </div>
                <div className="bg-[#161723] rounded-lg p-3 border border-slate-700/30">
                  <div className="text-xs text-slate-500 mb-1">Gold</div>
                  <div className="text-xl font-bold text-yellow-400">{character.gold}</div>
                </div>
              </div>
            </div>
          </SectionCard>

          {/* Reputation */}
          <SectionCard title="Reputation">
            <div className="space-y-2">
              <div className="flex items-center gap-2">
                <span className={`text-lg font-bold ${REPUTATION_TIER_COLORS[reputationTier]}`}>
                  {reputationTier}
                </span>
                <span className="text-sm text-slate-400">({reputation})</span>
              </div>
              {/* Reputation bar: -100 to 200 */}
              <div className="relative h-3 bg-slate-700 rounded-full overflow-hidden">
                <div
                  className={`absolute h-full rounded-full transition-all ${REPUTATION_TIER_BG[reputationTier]}`}
                  style={{ width: `${repBarPct}%` }}
                />
              </div>
              <div className="flex justify-between text-[10px] text-slate-500">
                <span>-100</span>
                <span>0</span>
                <span>100</span>
                <span>200</span>
              </div>
            </div>
          </SectionCard>

          {/* Equipment */}
          <SectionCard title="Equipment">
            <div className="space-y-2">
              {(['weapon', 'armor', 'accessory'] as EquipmentSlotType[]).map(slot => {
                const item = equipment[slot]
                return (
                  <div
                    key={slot}
                    className="bg-[#161723] border border-slate-700/30 p-3 rounded-lg flex items-center gap-3"
                  >
                    <span className="text-xs font-bold text-indigo-400 bg-indigo-900/30 px-2 py-1 rounded shrink-0">
                      {SLOT_ICONS[slot]}
                    </span>
                    <div className="min-w-0">
                      <div className="text-xs text-slate-500 uppercase">{SLOT_LABELS[slot]}</div>
                      {item ? (
                        <>
                          <div className="font-bold text-white text-sm truncate">{item.name}</div>
                          {item.effects && (
                            <div className="text-xs text-emerald-400">
                              {Object.entries(item.effects)
                                .filter(([, v]) => v !== undefined && v !== 0)
                                .map(([k, v]) => `+${v} ${k.charAt(0).toUpperCase() + k.slice(1)}`)
                                .join(', ')}
                            </div>
                          )}
                        </>
                      ) : (
                        <div className="text-sm text-slate-500 italic">Empty</div>
                      )}
                    </div>
                  </div>
                )
              })}
            </div>
          </SectionCard>

          {/* Spellbook */}
          <SectionCard title="Spellbook">
            {spellbook.length === 0 ? (
              <p className="text-sm text-slate-500 italic">No spells learned</p>
            ) : (
              <div className="space-y-2">
                {spellbook.map(spell => (
                  <div
                    key={spell.id}
                    className="bg-[#161723] border border-slate-700/30 p-3 rounded-lg"
                  >
                    <div className="flex items-center justify-between">
                      <span className="font-bold text-sm text-white">{spell.name}</span>
                      <div className="flex items-center gap-2 text-xs">
                        <span className="text-violet-400 capitalize">{spell.school}</span>
                        <span className="text-blue-300">{spell.manaCost} MP</span>
                      </div>
                    </div>
                    <p className="text-xs text-slate-400 mt-1">{spell.description}</p>
                  </div>
                ))}
              </div>
            )}
          </SectionCard>

          {/* Active Mount */}
          <SectionCard title="Active Mount">
            {!mount ? (
              <p className="text-sm text-slate-500 italic">No mount</p>
            ) : (
              <>
              <div className={`bg-[#161723] border rounded-lg p-3 ${MOUNT_RARITY_COLORS[mount.rarity] ?? 'border-slate-700/30 text-slate-300'}`}>
                <div className="flex items-center gap-2 mb-2">
                  <span className="text-2xl">{mount.icon}</span>
                  <div>
                    <div className="font-bold text-sm">{getMountDisplayName(mount)}</div>
                    {mount.customName && (
                      <div className="text-[10px] text-slate-500 italic">{mount.name}</div>
                    )}
                    <div className="text-[10px] uppercase tracking-wider opacity-70">{mount.rarity}</div>
                  </div>
                </div>
                <div className="flex flex-wrap gap-2 text-xs">
                  {mount.bonuses.strength ? (
                    <span className="bg-purple-900/30 text-purple-300 px-2 py-0.5 rounded">+{mount.bonuses.strength} STR</span>
                  ) : null}
                  {mount.bonuses.intelligence ? (
                    <span className="bg-blue-900/30 text-blue-300 px-2 py-0.5 rounded">+{mount.bonuses.intelligence} INT</span>
                  ) : null}
                  {mount.bonuses.luck ? (
                    <span className="bg-yellow-900/30 text-yellow-300 px-2 py-0.5 rounded">+{mount.bonuses.luck} LCK</span>
                  ) : null}
                  {mount.bonuses.autoWalkSpeed ? (
                    <span className="bg-emerald-900/30 text-emerald-300 px-2 py-0.5 rounded">{mount.bonuses.autoWalkSpeed}x Speed</span>
                  ) : null}
                  {mount.bonuses.healRate ? (
                    <span className="bg-green-900/30 text-green-300 px-2 py-0.5 rounded">+{mount.bonuses.healRate} Heal</span>
                  ) : null}
                  {mount.personality && MOUNT_PERSONALITY_INFO[mount.personality] && (
                    <span className="bg-amber-900/30 text-amber-300 px-2 py-0.5 rounded">
                      {MOUNT_PERSONALITY_INFO[mount.personality].icon} {MOUNT_PERSONALITY_INFO[mount.personality].label}
                    </span>
                  )}
                </div>
                <div className="text-xs text-slate-400 mt-2">{mount.dailyCost} gp/day upkeep</div>
                <button
                  className="mt-2 text-xs text-red-400 hover:text-red-300 border border-red-400/30 rounded px-2 py-1 bg-[#2a2b3f] hover:bg-[#3a3c56] transition-colors"
                  onClick={() => setMount(null)}
                >
                  Release Mount
                </button>
              </div>
              <button
                className="mt-2 text-xs px-3 py-1.5 rounded border border-amber-500/40 bg-[#2a2b3f] hover:bg-[#3a3c56] text-amber-300 transition-colors"
                onClick={() => setShowRenameModal(true)}
              >
                Rename Mount
              </button>
              {showRenameModal && (
                <MountNamingModal
                  mount={mount}
                  isOpen={showRenameModal}
                  onConfirm={(customName) => {
                    setMount(mount, customName)
                    setShowRenameModal(false)
                  }}
                />
              )}
              </>
            )}
          </SectionCard>

          {/* Passive Skills */}
          <SectionCard title="Passive Skills">
            {unlockedSkills.length === 0 ? (
              <p className="text-sm text-slate-500 italic">No skills unlocked</p>
            ) : (
              <div className="space-y-2">
                {unlockedSkills.map(skill => (
                  <div
                    key={skill.id}
                    className="bg-[#161723] border border-cyan-700/30 rounded-lg p-2.5 flex items-center gap-2"
                  >
                    <span className="text-base">{skill.icon}</span>
                    <div>
                      <div className="text-sm font-semibold text-cyan-400">{skill.name}</div>
                      <div className="text-xs text-slate-400">{skill.description}</div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </SectionCard>

          {/* Meta-Progression Bonuses */}
          {metaBonusDescriptions.length > 0 && (
            <SectionCard title="Eternal Upgrades">
              <div className="space-y-1">
                {metaBonusDescriptions.map((desc, i) => (
                  <div key={i} className="text-sm text-amber-300 flex items-center gap-2">
                    <span className="text-amber-500">+</span>
                    <span>{desc}</span>
                  </div>
                ))}
              </div>
            </SectionCard>
          )}

          {/* Run Stats */}
          <SectionCard title="Run Stats">
            <div className="grid grid-cols-2 gap-3">
              <div className="bg-[#161723] rounded-lg p-3 border border-slate-700/30">
                <div className="text-xs text-slate-500">Deaths</div>
                <div className="text-lg font-bold text-red-400">{character.deathCount ?? 0}</div>
              </div>
              <div className="bg-[#161723] rounded-lg p-3 border border-slate-700/30">
                <div className="text-xs text-slate-500">Difficulty</div>
                <div className="text-lg font-bold text-white">
                  {difficultyMode.icon} {difficultyMode.name}
                </div>
              </div>
              <div className="bg-[#161723] rounded-lg p-3 border border-slate-700/30">
                <div className="text-xs text-slate-500">Distance</div>
                <div className="text-lg font-bold text-emerald-300">{distance} km</div>
              </div>
              <div className="bg-[#161723] rounded-lg p-3 border border-slate-700/30">
                <div className="text-xs text-slate-500">Days Survived</div>
                <div className="text-lg font-bold text-orange-300">{day}</div>
              </div>
            </div>
          </SectionCard>

          {/* Bottom padding for scrolling */}
          <div className="h-4" />
        </div>
      </div>
    </div>
  )
}
