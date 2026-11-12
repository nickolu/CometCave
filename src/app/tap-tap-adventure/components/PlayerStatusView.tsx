'use client'

import { useEffect, useRef, useState } from 'react'

import { MountNamingModal } from '@/app/tap-tap-adventure/components/MountNamingModal'
import { getDifficultyMode } from '@/app/tap-tap-adventure/config/difficultyModes'
import { MOUNT_PERSONALITY_INFO } from '@/app/tap-tap-adventure/config/mounts'
import { getRegion } from '@/app/tap-tap-adventure/config/regions'
import { SKILLS } from '@/app/tap-tap-adventure/config/skills'
import { useGameStore } from '@/app/tap-tap-adventure/hooks/useGameStore'
import { ReputationTier, getReputationTier } from '@/app/tap-tap-adventure/lib/contextBuilder'
import { calculateDay, levelProgress, stepsRequiredForLevel, stepsToNextLevel } from '@/app/tap-tap-adventure/lib/leveling'
import { getMountDisplayName } from '@/app/tap-tap-adventure/lib/mountUtils'
import { getSkillBonus } from '@/app/tap-tap-adventure/lib/skillTracker'
import { useDialogFocus } from '@/app/tap-tap-adventure/lib/useDialogFocus'
import { FantasyCharacter } from '@/app/tap-tap-adventure/models/character'
import { EquipmentSlotType } from '@/app/tap-tap-adventure/models/equipment'
import { CloseIcon } from '@/app/tap-tap-adventure/stage/icons'
import { BrassFigure, BrassPlate, PaperButton, PlaybillCaption, PlaybillSheet, PlaybillTitle, Stamp, type StampTone } from '@/app/tap-tap-adventure/stage/Playbill'
import { cn } from '@/lib/utils'

interface PlayerStatusViewProps {
  onClose: () => void
}

/** The printer's ink for each standing. */
const REPUTATION_TONE: Record<ReputationTier, StampTone> = {
  'Wanted Criminal': 'red',
  Infamous: 'red',
  Disreputable: 'red',
  Unknown: 'ink',
  Respected: 'blue',
  Renowned: 'violet',
  Legendary: 'gold',
  'Living Legend': 'gold',
}

const REPUTATION_BAR: Record<ReputationTier, string> = {
  'Wanted Criminal': 'bg-ps-stamp-red',
  Infamous: 'bg-ps-stamp-red',
  Disreputable: 'bg-ps-stamp-red',
  Unknown: 'bg-ps-ink',
  Respected: 'bg-ps-stamp-blue',
  Renowned: 'bg-ps-stamp-violet',
  Legendary: 'bg-ps-stamp-gold',
  'Living Legend': 'bg-ps-stamp-gold',
}

const SLOT_LABELS: Record<EquipmentSlotType, string> = {
  weapon: 'Weapon',
  armor: 'Armour',
  accessory: 'Accessory',
}

const MOUNT_RARITY_TONE: Record<string, StampTone> = {
  common: 'ink',
  uncommon: 'green',
  rare: 'blue',
  legendary: 'gold',
}

function Section({ title, children, className }: { title: string; children: React.ReactNode; className?: string }) {
  return (
    <section className={cn('mt-5', className)}>
      <PlaybillCaption className="border-b-2 border-dotted border-ps-ink/40 pb-1">{title}</PlaybillCaption>
      <div className="mt-2">{children}</div>
    </section>
  )
}

function Track({ value, tone, label }: { value: number; tone: string; label: string }) {
  const pct = Math.max(0, Math.min(100, Math.round(value * 100)))
  return (
    <div className="h-2 w-full overflow-hidden rounded-full bg-ps-ink/20" role="progressbar" aria-valuemin={0} aria-valuemax={100} aria-valuenow={pct} aria-label={label}>
      <div className={cn('h-full rounded-full transition-[width] duration-300', tone)} style={{ width: `${pct}%` }} />
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
  const dialogRef = useRef<HTMLDivElement>(null)
  useDialogFocus(dialogRef)

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose])

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

  const attributes = [
    { key: 'Strength', value: character.strength, note: formatBonus(baseStr, equipBonuses.strength, mountStatBonuses.strength, metaBonuses.bonusStrength, skillBonuses.strength) },
    { key: 'Intelligence', value: character.intelligence, note: formatBonus(baseInt, equipBonuses.intelligence, mountStatBonuses.intelligence, metaBonuses.bonusIntelligence, skillBonuses.intelligence) },
    { key: 'Luck', value: character.luck, note: formatBonus(baseLck, equipBonuses.luck, mountStatBonuses.luck, metaBonuses.bonusLuck, skillBonuses.luck) },
    { key: 'Charisma', value: character.charisma, note: formatBonus(baseCha, equipBonuses.charisma, mountStatBonuses.charisma, 0, skillBonuses.charisma) },
  ]

  const hpPct = maxHp > 0 ? hp / maxHp : 0
  const manaPct = maxMana > 0 ? mana / maxMana : 0

  return (
    <div
      ref={dialogRef}
      className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-ps-house/70 p-3 sm:px-6 sm:pb-6 sm:pt-24"
      role="dialog"
      aria-modal="true"
      aria-label="Character status"
      tabIndex={-1}
    >
      <PlaybillSheet as="article" className="my-auto w-full max-w-2xl">
        <div className="px-4 pb-5 pt-4 sm:px-7 sm:pb-7 sm:pt-5">
          {/* Masthead */}
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0 flex-1">
              <PlaybillTitle size="lg" rules={false} className="mt-1 text-left">
                {character.name}
              </PlaybillTitle>
              <p className="mt-1 font-body text-sm text-ps-ink-soft">
                Level {level} {character.race} {character.class}
              </p>
            </div>
            <button
              type="button"
              onClick={onClose}
              className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full border-2 border-ps-ink text-ps-ink transition-colors hover:bg-ps-ink hover:text-ps-playbill focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ds-primary"
              aria-label="Close the character sheet"
            >
              <CloseIcon />
            </button>
          </div>
          {character.classData?.description && (
            <p className="mt-2 font-body text-sm italic leading-snug text-ps-ink-soft">{character.classData.description}</p>
          )}
          <div className="mt-3 flex flex-wrap items-center gap-1 border-y-2 border-ps-ink py-2">
            <Stamp tone="ink" tilt={false} title={region.description}>
              <span className="font-body normal-case tracking-normal">{region.icon}</span> {region.name}
            </Stamp>
            <Stamp tone="ink" tilt={false}>Day {day}</Stamp>
            <Stamp tone="ink" tilt={false}>{Math.round(distance)} km</Stamp>
            <Stamp tone="ink" tilt={false} title={difficultyMode.description}>
              {difficultyMode.name}
            </Stamp>
          </div>

          {/* Vitals on brass */}
          <BrassPlate className="mt-4 grid grid-cols-2 divide-x-2 divide-ps-brass-deep/60 sm:grid-cols-4" aria-label="Vitals">
            <BrassFigure
              label="Health"
              value={hp}
              sub={`of ${maxHp}`}
              bar={hpPct}
              barTone={hpPct > 0.5 ? 'green' : hpPct > 0.25 ? 'ink' : 'red'}
              title={`HP ${hp} of ${maxHp}`}
            />
            <BrassFigure label="Mana" value={mana} sub={`of ${maxMana}`} bar={manaPct} title={`Mana ${mana} of ${maxMana}`} />
            <BrassFigure label="Gold" value={character.gold} className="border-t-2 border-ps-brass-deep/60 sm:border-t-0" />
            <BrassFigure
              label="Level"
              value={level}
              sub={`${Math.max(0, stepsIntoLevel)} of ${stepsNeeded} km`}
              bar={progress}
              title={`Level ${level}: ${Math.max(0, stepsIntoLevel)} of ${stepsNeeded} km walked toward the next`}
              className="border-t-2 border-ps-brass-deep/60 sm:border-t-0"
            />
          </BrassPlate>

          {/* Attributes */}
          <Section title="Attributes">
            <BrassPlate className="grid grid-cols-4 divide-x-2 divide-ps-brass-deep/60" aria-label="Attributes">
              {attributes.map(a => (
                <BrassFigure key={a.key} label={a.key.slice(0, 3)} value={a.value} title={`${a.key}: ${a.note}`} />
              ))}
            </BrassPlate>
            <ul className="m-0 mt-2 list-none p-0">
              {attributes.map(a => (
                <li key={a.key} className="flex items-baseline justify-between gap-3 border-b border-dotted border-ps-ink/40 py-1 font-body text-xs last:border-b-0">
                  <span className="text-ps-ink">{a.key}</span>
                  <span className="text-right text-ps-ink-soft">{a.note}</span>
                </li>
              ))}
            </ul>
          </Section>

          {/* Reputation */}
          <Section title="Standing">
            <div className="flex flex-wrap items-center gap-2">
              <Stamp tone={REPUTATION_TONE[reputationTier]} className="text-xs">{reputationTier}</Stamp>
              <span className="font-playbill text-base tabular-nums text-ps-ink">{reputation}</span>
            </div>
            <div className="mt-2">
              <Track value={repBarPct / 100} tone={REPUTATION_BAR[reputationTier]} label={`Reputation ${reputation} on a scale from -100 to 200`} />
              <div className="mt-1 flex justify-between font-label text-xs font-bold uppercase tracking-widest text-ps-ink-faint" aria-hidden>
                <span>-100</span>
                <span>0</span>
                <span>100</span>
                <span>200</span>
              </div>
            </div>
          </Section>

          {/* Equipment */}
          <Section title="Worn">
            <ul className="m-0 list-none p-0">
              {(['weapon', 'armor', 'accessory'] as EquipmentSlotType[]).map(slot => {
                const item = equipment[slot]
                return (
                  <li key={slot} className="flex items-start justify-between gap-3 border-b-2 border-dotted border-ps-ink/40 py-2 last:border-b-0">
                    <div className="min-w-0 flex-1">
                      <PlaybillCaption className="text-xs">{SLOT_LABELS[slot]}</PlaybillCaption>
                      {item ? (
                        <p className="mt-0.5 font-body text-sm font-medium text-ps-ink">{item.name}</p>
                      ) : (
                        <p className="mt-0.5 font-body text-sm italic text-ps-ink-soft">Nothing worn</p>
                      )}
                    </div>
                    {item?.effects && (
                      <div className="flex max-w-[55%] flex-wrap items-center justify-end gap-1">
                        {Object.entries(item.effects)
                          .filter(([, v]) => v !== undefined && v !== 0)
                          .map(([k, v]) => (
                            <Stamp key={k} tone={typeof v === 'number' && v < 0 ? 'red' : 'green'} tilt={false}>
                              {typeof v === 'number' && v > 0 ? '+' : ''}{String(v)} {k.charAt(0).toUpperCase() + k.slice(1)}
                            </Stamp>
                          ))}
                      </div>
                    )}
                  </li>
                )
              })}
            </ul>
          </Section>

          {/* Spellbook */}
          <Section title="Spellbook">
            {spellbook.length === 0 ? (
              <p className="font-body text-sm italic text-ps-ink-soft">No spells learned</p>
            ) : (
              <ul className="m-0 list-none p-0">
                {spellbook.map(spell => (
                  <li key={spell.id} className="border-b-2 border-dotted border-ps-ink/40 py-2 last:border-b-0">
                    <div className="flex items-start justify-between gap-3">
                      <span className="min-w-0 font-body text-sm font-medium text-ps-ink">{spell.name}</span>
                      <div className="flex shrink-0 items-center gap-1">
                        <Stamp tone="violet" tilt={false} className="capitalize">{spell.school}</Stamp>
                        <Stamp tone="blue" tilt={false}>{spell.manaCost} MP</Stamp>
                      </div>
                    </div>
                    <p className="mt-1 font-body text-xs leading-snug text-ps-ink-soft">{spell.description}</p>
                  </li>
                ))}
              </ul>
            )}
          </Section>

          {/* Active Mount */}
          <Section title="Mount">
            {!mount ? (
              <p className="font-body text-sm italic text-ps-ink-soft">On foot</p>
            ) : (
              <>
                <div className="rounded-[3px] border-2 border-ps-ink p-3">
                  <div className="flex items-start gap-3">
                    <span className="font-body text-2xl leading-none" aria-hidden>{mount.icon}</span>
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
                        <span className="font-body text-base font-medium leading-tight text-ps-ink">{getMountDisplayName(mount)}</span>
                        <Stamp tone={MOUNT_RARITY_TONE[mount.rarity] ?? 'ink'} tilt={false} className="capitalize">{mount.rarity}</Stamp>
                      </div>
                      {mount.customName && <p className="font-body text-xs italic text-ps-ink-soft">a {mount.name}</p>}
                    </div>
                  </div>
                  <div className="mt-2 flex flex-wrap items-center gap-1">
                    {mount.bonuses.strength ? <Stamp tone="green" tilt={false}>+{mount.bonuses.strength} STR</Stamp> : null}
                    {mount.bonuses.intelligence ? <Stamp tone="green" tilt={false}>+{mount.bonuses.intelligence} INT</Stamp> : null}
                    {mount.bonuses.luck ? <Stamp tone="green" tilt={false}>+{mount.bonuses.luck} LCK</Stamp> : null}
                    {mount.bonuses.autoWalkSpeed ? <Stamp tone="blue" tilt={false}>{mount.bonuses.autoWalkSpeed}× speed</Stamp> : null}
                    {mount.bonuses.healRate ? <Stamp tone="green" tilt={false}>+{mount.bonuses.healRate} heal</Stamp> : null}
                    {mount.personality && MOUNT_PERSONALITY_INFO[mount.personality] && (
                      <Stamp tone="gold" tilt={false}>
                        <span className="font-body normal-case tracking-normal">{MOUNT_PERSONALITY_INFO[mount.personality].icon}</span> {MOUNT_PERSONALITY_INFO[mount.personality].label}
                      </Stamp>
                    )}
                  </div>
                  <p className="mt-2 font-body text-xs text-ps-ink-soft">{mount.dailyCost} gold a day to keep</p>
                  <div className="mt-2.5 flex flex-wrap gap-1.5">
                    <PaperButton size="sm" variant="outline" onClick={() => setShowRenameModal(true)}>
                      Rename
                    </PaperButton>
                    <PaperButton size="sm" variant="danger" onClick={() => setMount(null)}>
                      Release
                    </PaperButton>
                  </div>
                </div>
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
          </Section>

          {/* Passive Skills */}
          <Section title="Passive skills">
            {unlockedSkills.length === 0 ? (
              <p className="font-body text-sm italic text-ps-ink-soft">None earned yet</p>
            ) : (
              <ul className="m-0 list-none p-0">
                {unlockedSkills.map(skill => (
                  <li key={skill.id} className="flex items-start gap-2 border-b-2 border-dotted border-ps-ink/40 py-2 last:border-b-0">
                    <span className="font-body text-base leading-none" aria-hidden>{skill.icon}</span>
                    <div className="min-w-0 flex-1">
                      <p className="font-body text-sm font-medium text-ps-ink">{skill.name}</p>
                      <p className="font-body text-xs leading-snug text-ps-ink-soft">{skill.description}</p>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </Section>

          {/* Meta-Progression Bonuses */}
          {metaBonusDescriptions.length > 0 && (
            <Section title="Eternal upgrades">
              <div className="flex flex-wrap items-center gap-1">
                {metaBonusDescriptions.map((desc, i) => (
                  <Stamp key={i} tone="gold" tilt={false}>{desc}</Stamp>
                ))}
              </div>
            </Section>
          )}

          {/* Run Stats */}
          <Section title="This run">
            <BrassPlate className="grid grid-cols-3 divide-x-2 divide-ps-brass-deep/60" aria-label="This run">
              <BrassFigure label="Deaths" value={character.deathCount ?? 0} />
              <BrassFigure label="Km" value={distance} />
              <BrassFigure label="Days" value={day} />
            </BrassPlate>
          </Section>

          <PaperButton className="mt-6 w-full" onClick={onClose}>
            Close
          </PaperButton>
        </div>
      </PlaybillSheet>
    </div>
  )
}
