'use client'

/**
 * The six drawers hanging in the wings. Each is a bill with a row of
 * sub-tabs; the panels inside are the game's existing panels, which will be
 * re-set in the playbill vocabulary one by one.
 */
import * as React from 'react'

import { AchievementPanel } from '@/app/tap-tap-adventure/components/AchievementPanel'
import AdventureLeaderboard from '@/app/tap-tap-adventure/components/AdventureLeaderboard'
import { AreaMap } from '@/app/tap-tap-adventure/components/AreaMap'
import { BasePanel } from '@/app/tap-tap-adventure/components/BasePanel'
import { BestiaryPanel } from '@/app/tap-tap-adventure/components/BestiaryPanel'
import { ContactsList } from '@/app/tap-tap-adventure/components/ContactsList'
import { CraftingPanel } from '@/app/tap-tap-adventure/components/CraftingPanel'
import { DailyChallengesPanel } from '@/app/tap-tap-adventure/components/DailyChallengesPanel'
import { EnchantingPanel } from '@/app/tap-tap-adventure/components/EnchantingPanel'
import { EquipmentPanel } from '@/app/tap-tap-adventure/components/EquipmentPanel'
import { ExplorationSpellsPanel } from '@/app/tap-tap-adventure/components/ExplorationSpellsPanel'
import { FactionPanel } from '@/app/tap-tap-adventure/components/FactionPanel'
import { InventoryPanel } from '@/app/tap-tap-adventure/components/InventoryPanel'
import { MainQuestPanel } from '@/app/tap-tap-adventure/components/MainQuestPanel'
import { MercenaryPanel } from '@/app/tap-tap-adventure/components/MercenaryPanel'
import { QuestPanel } from '@/app/tap-tap-adventure/components/QuestPanel'
import { RunHistoryPanel } from '@/app/tap-tap-adventure/components/RunHistoryPanel'
import { SkillPanel } from '@/app/tap-tap-adventure/components/SkillPanel'
import { SpellComboPanel } from '@/app/tap-tap-adventure/components/SpellComboPanel'
import { StatsPanel } from '@/app/tap-tap-adventure/components/StatsPanel'
import { TownHub } from '@/app/tap-tap-adventure/components/TownHub'
import { WorldMap } from '@/app/tap-tap-adventure/components/WorldMap'
import { getRegion } from '@/app/tap-tap-adventure/config/regions'
import type { FantasyCharacter , GameState } from '@/app/tap-tap-adventure/models/types'
import { Stamp } from '@/app/tap-tap-adventure/stage/Playbill'
import { cn } from '@/lib/utils'

import { GearIcon, MapIcon, PackIcon, PartyIcon, QuestIcon, TownIcon } from './icons'

import type { DrawerTab } from './Theatre'

export type DrawerId = 'pack' | 'gear' | 'quests' | 'map' | 'party' | 'town'

export const DRAWER_TABS: Record<DrawerId, { label: string; icon: React.ReactNode; subs: { id: string; label: string }[] }> = {
  pack: { label: 'Pack', icon: <PackIcon />, subs: [{ id: 'items', label: 'Items' }, { id: 'craft', label: 'Craft' }, { id: 'enchant', label: 'Enchant' }] },
  gear: {
    label: 'Gear',
    icon: <GearIcon />,
    subs: [{ id: 'equipment', label: 'Worn' }, { id: 'skills', label: 'Skills' }, { id: 'spells', label: 'Spells' }, { id: 'combos', label: 'Combos' }, { id: 'stats', label: 'Figures' }],
  },
  quests: {
    label: 'Quests',
    icon: <QuestIcon />,
    subs: [{ id: 'quests', label: 'Quests' }, { id: 'feats', label: 'Feats' }, { id: 'bestiary', label: 'Bestiary' }, { id: 'history', label: 'Runs' }, { id: 'ranks', label: 'Ranks' }],
  },
  map: { label: 'Map', icon: <MapIcon />, subs: [{ id: 'area', label: 'Here' }, { id: 'world', label: 'World' }, { id: 'camp', label: 'Camp' }] },
  party: { label: 'Party', icon: <PartyIcon />, subs: [{ id: 'party', label: 'Party' }, { id: 'contacts', label: 'Contacts' }, { id: 'factions', label: 'Factions' }] },
  town: { label: 'Town', icon: <TownIcon />, subs: [] },
}

export function drawerTabs(inTown: boolean): DrawerTab[] {
  return (Object.keys(DRAWER_TABS) as DrawerId[]).map(id => ({
    id,
    label: DRAWER_TABS[id].label,
    icon: DRAWER_TABS[id].icon,
    disabled: id === 'town' && !inTown,
    title: id === 'town' && !inTown ? 'Reach a town to open this' : undefined,
  }))
}

export function SubTabs({ tabs, active, onChange }: { tabs: { id: string; label: string }[]; active: string; onChange: (id: string) => void }) {
  if (tabs.length === 0) return null
  return (
    <div role="tablist" className="mb-4 flex flex-wrap gap-1 border-b-2 border-ps-ink pb-2">
      {tabs.map(t => (
        <button
          key={t.id}
          type="button"
          role="tab"
          aria-selected={active === t.id}
          onClick={() => onChange(t.id)}
          className={cn(
            'rounded-[2px] border-2 px-2.5 py-1 font-playbill text-xs uppercase tracking-widest transition-colors',
            'focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-ds-primary',
            active === t.id ? 'border-ps-ink bg-ps-ink text-ps-playbill' : 'border-transparent text-ps-ink-soft hover:border-ps-ink hover:text-ps-ink'
          )}
        >
          {t.label}
        </button>
      ))}
    </div>
  )
}

export interface DrawerContentProps {
  drawer: DrawerId
  sub: string
  onSub: (id: string) => void
  character: FantasyCharacter
  gameState: GameState
  onSelectTarget: (index: number) => void
  onRegionClick?: (regionId: string) => void
  /** Town: the hub's options, resolved by the stage. */
  townHub?: { decisionPointId: string; isResolving: boolean; onSelectOption: (id: string) => void } | null
  /** A map or chart put a place on the map (Pack → the stage opens the map on it). */
  onRevealLandmark?: (index: number, name: string) => void
  /** The place a map just revealed, ringed on the area map. */
  highlightLandmark?: { index: number; name: string } | null
  onClose: () => void
}

export function DrawerContent({ drawer, sub, onSub, character, gameState, onSelectTarget, townHub, onRevealLandmark, highlightLandmark = null, onClose }: DrawerContentProps) {
  const subs = DRAWER_TABS[drawer].subs
  const active = subs.some(s => s.id === sub) ? sub : (subs[0]?.id ?? '')
  const ls = character.landmarkState
  const region = getRegion(character.currentRegion ?? 'green_meadows')

  return (
    <div>
      <SubTabs tabs={subs} active={active} onChange={onSub} />
      {drawer === 'pack' && active === 'items' && <InventoryPanel inventory={character.inventory ?? []} onRevealLandmark={onRevealLandmark} />}
      {drawer === 'pack' && active === 'craft' && <CraftingPanel />}
      {drawer === 'pack' && active === 'enchant' && <EnchantingPanel />}

      {drawer === 'gear' && active === 'equipment' && (
        <EquipmentPanel equipment={character.equipment ?? { weapon: null, armor: null, accessory: null }} />
      )}
      {drawer === 'gear' && active === 'skills' && (
        <SkillPanel
          unlockedSkillIds={character.unlockedSkills ?? []}
          classSkillTree={character.classSkillTree}
          unlockedTreeSkillIds={character.unlockedTreeSkillIds ?? []}
          characterLevel={character.level ?? 1}
        />
      )}
      {drawer === 'gear' && active === 'spells' && <ExplorationSpellsPanel />}
      {drawer === 'gear' && active === 'combos' && <SpellComboPanel discoveredCombos={character.discoveredCombos ?? []} />}
      {drawer === 'gear' && active === 'stats' && <StatsPanel />}

      {drawer === 'quests' && active === 'quests' && (
        <div className="space-y-4">
          <MainQuestPanel character={character} />
          <QuestPanel />
          <DailyChallengesPanel />
        </div>
      )}
      {drawer === 'quests' && active === 'feats' && <AchievementPanel achievements={gameState.achievements ?? []} />}
      {drawer === 'quests' && active === 'bestiary' && <BestiaryPanel bestiary={character.bestiary ?? []} />}
      {drawer === 'quests' && active === 'history' && <RunHistoryPanel />}
      {drawer === 'quests' && active === 'ranks' && <AdventureLeaderboard onBack={onClose} />}

      {drawer === 'map' && active === 'area' && (
        ls ? (
          <div className="space-y-3">
            {highlightLandmark && (
              <p className="flex flex-wrap items-center gap-2 font-body text-sm text-ps-ink" role="status">
                <Stamp tone="gold" tilt={false} animate>Mapped</Stamp>
                Your map puts {highlightLandmark.name} on the sheet.
              </p>
            )}
          <AreaMap
            playerPosition={ls.position ?? { x: 0, y: 0 }}
            landmarks={ls.landmarks.map((lm, i) => ({
              index: i,
              name: lm.name,
              icon: lm.icon,
              position: lm.position ?? { x: 0, y: 0 },
              explored: lm.explored ?? false,
              hidden: lm.hidden ?? false,
              mapped: lm.mapped ?? false,
              hasShop: lm.hasShop ?? false,
            }))}
            exits={(ls.exitPositions ?? []).map((exit, i) => ({
              index: ls.landmarks.length + i,
              name: exit.name,
              icon: exit.icon,
              position: exit.position,
            }))}
            activeTargetIndex={ls.activeTargetIndex ?? 0}
            regionBounds={ls.regionBounds ?? { width: 500, height: 500 }}
            regionName={region.name}
            regionIcon={region.icon}
            regionId={region.id}
            highlightIndex={highlightLandmark?.index ?? null}
            onSelectTarget={i => {
              onSelectTarget(i)
            }}
          />
          </div>
        ) : (
          <p className="font-body text-sm italic text-ps-ink-soft">Set out and the map of this country draws itself.</p>
        )
      )}
      {drawer === 'map' && active === 'world' && <WorldMap character={character} />}
      {drawer === 'map' && active === 'camp' && <BasePanel />}

      {drawer === 'party' && active === 'party' && <MercenaryPanel character={character} canHire={!!townHub} />}
      {drawer === 'party' && active === 'contacts' && <ContactsList character={character} />}
      {drawer === 'party' && active === 'factions' && <FactionPanel character={character} />}

      {drawer === 'town' &&
        (townHub && gameState.decisionPoint ? (
          <TownHub
            townName={ls?.exploringLandmarkName ?? 'Town'}
            townIcon={ls?.landmarks[ls?.activeTargetIndex ?? 0]?.icon}
            decisionPoint={gameState.decisionPoint}
            isResolving={townHub.isResolving}
            character={character}
            onSelectOption={id => {
              onClose()
              townHub.onSelectOption(id)
            }}
            npcDispositions={Object.fromEntries(Object.entries(character.npcEncounters ?? {}).map(([id, enc]) => [id, enc.disposition ?? 0]))}
          />
        ) : (
          <p className="font-body text-sm italic text-ps-ink-soft">You are not in a town.</p>
        ))}
    </div>
  )
}
