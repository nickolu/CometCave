'use client'

/**
 * Development-only preview of the town's panels with fixture props, for the
 * states the stage preview cannot reach headlessly (a dialogue after the
 * first choice, a mailbox with letters, a stable with mounts, a mount being
 * named, a shop with a mount for sale).
 *
 *   /tap-tap-adventure/preview/town?p=npc|party|mailbox|stable|waypoints|naming|shop|tavern|notice
 *
 * Returns 404 outside development. The dialogue panels' first fetch fails
 * without a signed-in player and falls back to the scripted greeting.
 */
import { notFound, useSearchParams } from 'next/navigation'
import { Suspense, useEffect, useState } from 'react'

import { MailboxPanel } from '@/app/tap-tap-adventure/components/MailboxPanel'
import { MountNamingModal } from '@/app/tap-tap-adventure/components/MountNamingModal'
import { NoticeBoard } from '@/app/tap-tap-adventure/components/NoticeBoard'
import { NPCDialoguePanel } from '@/app/tap-tap-adventure/components/NPCDialoguePanel'
import { PartyDialoguePanel } from '@/app/tap-tap-adventure/components/PartyDialoguePanel'
import { ShopUI } from '@/app/tap-tap-adventure/components/ShopUI'
import { StablePanel } from '@/app/tap-tap-adventure/components/StablePanel'
import { TavernPanel } from '@/app/tap-tap-adventure/components/TavernPanel'
import { WaypointPanel } from '@/app/tap-tap-adventure/components/WaypointPanel'
import { getNPCById } from '@/app/tap-tap-adventure/config/npcs'
import { useGameStore } from '@/app/tap-tap-adventure/hooks/useGameStore'
import { defaultGameState } from '@/app/tap-tap-adventure/lib/defaultGameState'
import { createPartyMember } from '@/app/tap-tap-adventure/lib/partyRecruitment'
import type { Mount } from '@/app/tap-tap-adventure/models/mount'
import type { FantasyCharacter } from '@/app/tap-tap-adventure/models/types'
import { PlaybillSheet } from '@/app/tap-tap-adventure/stage/Playbill'

const PONY: Mount = {
  id: 'pony-1',
  name: 'Fen Pony',
  description: 'Short, shaggy and unbothered by rain.',
  rarity: 'common',
  bonuses: { autoWalkSpeed: 1.2 },
  icon: '🐴',
  dailyCost: 2,
  personality: 'stubborn',
  hp: 18,
  maxHp: 40,
}

const STAG: Mount = {
  id: 'stag-1',
  name: 'Moss Stag',
  description: 'Antlers hung with lichen. It knows the forest paths.',
  rarity: 'rare',
  bonuses: { autoWalkSpeed: 1.6, luck: 2 },
  icon: '🦌',
  dailyCost: 6,
  personality: 'gentle',
  hp: 80,
  maxHp: 80,
}

function wren(overrides: Partial<FantasyCharacter> = {}): FantasyCharacter {
  return {
    id: 'preview-wren',
    playerId: 'preview',
    name: 'Wren',
    race: 'Elf',
    class: 'Ranger',
    level: 4,
    abilities: [],
    locationId: 'green_meadows',
    gold: 134,
    reputation: 12,
    bounty: 0,
    distance: 212,
    status: 'active',
    strength: 6,
    intelligence: 5,
    luck: 7,
    charisma: 5,
    hp: 48,
    maxHp: 60,
    inventory: [
      { id: 'i1', name: 'Storm lantern', description: 'Burns in any weather.', quantity: 1, type: 'misc', rarity: 'uncommon' },
      { id: 'i2', name: 'Honey cakes', description: 'Restores 15 HP.', quantity: 3, type: 'consumable', rarity: 'common', effects: { heal: 15 } },
    ],
    equipment: { weapon: null, armor: null, accessory: null },
    deathCount: 0,
    pendingStatPoints: 0,
    activeMount: PONY,
    mountRoster: [STAG],
    mailbox: [
      { id: 'm1', fromNpcId: 'elder_maren', fromName: 'Elder Maren', fromIcon: '👵', subject: 'The road past the mill', body: 'Wren,\n\nThe miller’s widow says the ford is running high. Take the long way round the reeds and keep your boots dry.\n\nThere is a little something enclosed for the lantern you traded. Hearthwood does not forget a kindness.\n\n— Maren', attachedGold: 12, read: false, day: 2 },
      { id: 'm2', fromNpcId: 'bramble', fromName: 'Bramble', fromIcon: '🧰', subject: 'Found your whistle', body: 'It was in the cart after all. Come by the ford and I will hand it over.', attachedItems: [{ name: 'Brass whistle', description: 'Loud.' }], read: true, day: 1 },
    ],
    pendingReplies: [],
    party: [],
    difficultyMode: 'normal',
    currentRegion: 'green_meadows',
    currentWeather: 'rain',
    visitedRegions: ['green_meadows'],
    visitedTowns: [
      { name: 'Hearthwood', icon: '🏘️', regionId: 'green_meadows', landmarkId: 'hearthwood' },
      { name: 'Willowbrook', icon: '🌿', regionId: 'green_meadows', landmarkId: 'willowbrook' },
      { name: 'Thornwatch', icon: '🌲', regionId: 'dark_forest', landmarkId: 'thornwatch' },
    ],
    factionReputations: {},
    npcEncounters: { elder_maren: { timesSpoken: 3, disposition: 24 } },
    ...overrides,
  }
}

function Preview() {
  const params = useSearchParams()
  const p = params.get('p') ?? 'npc'
  const [ready, setReady] = useState(false)
  const character = wren()

  useEffect(() => {
    if (p === 'shop') {
      useGameStore.setState({
        gameState: {
          ...defaultGameState,
          selectedCharacterId: character.id,
          characters: [character],
          shopState: {
            isOpen: true,
            shopMount: { mount: STAG, price: 95 },
            items: [
              { id: 's1', name: 'Storm lantern', description: 'Burns in any weather.', quantity: 1, type: 'misc', price: 18, rarity: 'uncommon' },
              { id: 's3', name: 'Yew longbow', description: 'A ranger’s bow, well strung.', quantity: 1, type: 'equipment', price: 60, rarity: 'rare', effects: { strength: 3 } },
            ],
          },
        },
      })
    }
    const t = setTimeout(() => setReady(true), 0)
    return () => clearTimeout(t)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [p])

  if (!ready) return null
  const noop = () => {}
  const npc = getNPCById('elder_maren')!
  const member = createPartyMember({ id: 'npc-tam', name: 'Tam', icon: '🪓', level: 4, dailyCost: 2, rarity: 'uncommon', personality: 'gruff', relationship: 30, role: 'combatant' })

  return (
    <div className="min-h-screen bg-ps-house p-4 sm:p-8">
      <div className="mx-auto w-full max-w-[640px]">
        <PlaybillSheet as="section" className="px-4 py-3 sm:px-5">
          {p === 'npc' && (
            <NPCDialoguePanel
              npc={npc}
              characterName={character.name}
              characterClass={character.class}
              characterLevel={character.level}
              reputation={character.reputation}
              region="green_meadows"
              characterCharisma={5}
              disposition={24}
              onEncounterUpdate={noop}
              onClose={noop}
              onRecruit={noop}
            />
          )}
          {p === 'party' && (
            <PartyDialoguePanel
              member={member}
              characterName={character.name}
              characterClass={character.class}
              characterLevel={character.level}
              characterCharisma={5}
              disposition={30}
              onDispositionChange={noop}
              onClose={noop}
            />
          )}
          {p === 'mailbox' && <MailboxPanel character={character} onClose={noop} />}
          {p === 'stable' && <StablePanel character={character} onClose={noop} regionId="green_meadows" />}
          {p === 'waypoints' && <WaypointPanel character={character} currentTownName="Hearthwood" onTravel={noop} onClose={noop} />}
          {p === 'shop' && <ShopUI />}
          {p === 'tavern' && <TavernPanel character={character} townName="Hearthwood" onRest={noop} isResting={false} onClose={noop} />}
          {p === 'notice' && <NoticeBoard character={character} activeQuest={null} onAcceptQuest={noop} onClose={noop} />}
          {p === 'naming' && <MountNamingModal mount={STAG} isOpen onConfirm={noop} />}
        </PlaybillSheet>
      </div>
    </div>
  )
}

export default function TownPreviewPage() {
  if (process.env.NODE_ENV === 'production') notFound()
  return (
    <Suspense fallback={null}>
      <Preview />
    </Suspense>
  )
}
