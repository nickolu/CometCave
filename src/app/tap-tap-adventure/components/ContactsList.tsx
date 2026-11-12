'use client'

/**
 * Everyone you have met, as a ruled list on the bill: their standing with
 * you as a stamp and a thin ink rule, and a page for each.
 */
import { useState } from 'react'

import { ENCOUNTER_NPCS, NPCS, getRelationshipTier } from '@/app/tap-tap-adventure/config/npcs'
import type { GameNPC } from '@/app/tap-tap-adventure/config/npcs'
import { FantasyCharacter } from '@/app/tap-tap-adventure/models/character'
import { ChevronIcon } from '@/app/tap-tap-adventure/stage/icons'
import { PaperButton, PlaybillCaption, PlaybillTitle, Stamp, type StampTone } from '@/app/tap-tap-adventure/stage/Playbill'

interface ContactsListProps {
  character: FantasyCharacter
}

/** The printer's ink for each standing. */
const TIER_TONE: Record<string, StampTone> = {
  hostile: 'red',
  unfriendly: 'red',
  neutral: 'ink',
  friendly: 'green',
  trusted: 'blue',
  bonded: 'gold',
}

function DispositionBar({ disposition, label }: { disposition: number; label: string }) {
  const pct = Math.max(5, ((disposition + 100) / 200) * 100)
  return (
    <div
      className="h-1.5 w-full overflow-hidden rounded-full bg-ps-playbill-edge"
      role="progressbar"
      aria-valuemin={-100}
      aria-valuemax={100}
      aria-valuenow={disposition}
      aria-label={label}
    >
      <div className={`h-full rounded-full transition-[width] duration-300 ${disposition < -10 ? 'bg-ps-stamp-red' : 'bg-ps-ink'}`} style={{ width: `${pct}%` }} />
    </div>
  )
}

export function ContactsList({ character }: ContactsListProps) {
  const [selectedNpc, setSelectedNpc] = useState<string | null>(null)
  const encounters = character.npcEncounters ?? {}
  const allNpcs: GameNPC[] = [...NPCS, ...ENCOUNTER_NPCS]

  // Build contacts from npcEncounters
  const contacts = Object.entries(encounters)
    .map(([npcId, data]) => {
      const npcConfig = allNpcs.find(n => n.id === npcId)
      const tier = getRelationshipTier(data.disposition)
      return {
        id: npcId,
        name: npcConfig?.name ?? npcId,
        icon: npcConfig?.icon ?? '👤',
        role: npcConfig?.role ?? 'Unknown',
        description: npcConfig?.description ?? '',
        personality: npcConfig?.personality ?? '',
        regionId: npcConfig?.regionId ?? 'unknown',
        disposition: data.disposition,
        timesSpoken: data.timesSpoken,
        tier,
      }
    })
    .sort((a, b) => b.disposition - a.disposition) // Sort by disposition, highest first

  if (contacts.length === 0) {
    return (
      <section aria-label="Contacts" className="space-y-3">
        <PlaybillTitle size="sm">Contacts</PlaybillTitle>
        <p className="py-3 font-body text-sm italic text-ps-ink-soft">
          You have not met anyone yet. People are found at landmarks and on the road.
        </p>
      </section>
    )
  }

  const selected = selectedNpc ? contacts.find(c => c.id === selectedNpc) : null

  if (selected) {
    // Detail view
    return (
      <section aria-label={selected.name} className="space-y-3">
        <PaperButton size="sm" variant="outline" onClick={() => setSelectedNpc(null)}>
          Back to contacts
        </PaperButton>
        <div className="text-center">
          <span className="font-body text-3xl leading-none" aria-hidden>{selected.icon}</span>
          <PlaybillTitle size="md" className="mt-2">{selected.name}</PlaybillTitle>
          <PlaybillCaption className="mt-2">{selected.role}</PlaybillCaption>
        </div>
        <p className="font-body text-sm leading-relaxed text-ps-ink">{selected.description}</p>
        {selected.personality && (
          <p className="font-body text-sm italic leading-snug text-ps-ink-soft">&ldquo;{selected.personality}&rdquo;</p>
        )}
        <div>
          <div className="flex items-center justify-between gap-2">
            <PlaybillCaption>Standing</PlaybillCaption>
            <Stamp tone={TIER_TONE[selected.tier.tier] ?? 'ink'}>{selected.tier.label}</Stamp>
          </div>
          <div className="mt-1.5 flex items-center gap-2">
            <DispositionBar disposition={selected.disposition} label={`Standing with ${selected.name}`} />
            <span className="w-8 shrink-0 text-right font-playbill text-sm tabular-nums text-ps-ink">
              {selected.disposition > 0 ? '+' : ''}{selected.disposition}
            </span>
          </div>
        </div>
        <dl className="divide-y divide-ps-playbill-edge border-y border-ps-playbill-edge font-body text-sm">
          <div className="flex justify-between gap-3 py-1.5">
            <dt className="text-ps-ink-soft">Times spoken</dt>
            <dd className="tabular-nums text-ps-ink">{selected.timesSpoken}</dd>
          </div>
          <div className="flex justify-between gap-3 py-1.5">
            <dt className="text-ps-ink-soft">Country</dt>
            <dd className="capitalize text-ps-ink">{selected.regionId.replace(/_/g, ' ')}</dd>
          </div>
        </dl>
      </section>
    )
  }

  // List view
  return (
    <section aria-label="Contacts" className="space-y-3">
      <PlaybillTitle size="sm">Contacts</PlaybillTitle>
      <PlaybillCaption>{contacts.length} met</PlaybillCaption>
      <ul className="divide-y divide-ps-playbill-edge border-y border-ps-playbill-edge">
        {contacts.map(contact => (
          <li key={contact.id}>
            <button
              type="button"
              onClick={() => setSelectedNpc(contact.id)}
              className="flex w-full items-center gap-2.5 py-2.5 text-left focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ds-primary"
              aria-label={`${contact.name}, ${contact.role}, ${contact.tier.label}`}
            >
              <span aria-hidden className="w-7 shrink-0 text-center font-body text-xl leading-none">{contact.icon}</span>
              <span className="min-w-0 flex-1">
                <span className="flex items-center gap-2">
                  <span className="truncate font-playbill text-base uppercase leading-none tracking-wide text-ps-ink">{contact.name}</span>
                  <Stamp tone={TIER_TONE[contact.tier.tier] ?? 'ink'} tilt={false} className="text-xs">{contact.tier.label}</Stamp>
                </span>
                <span className="mt-1 block font-body text-xs text-ps-ink-soft">
                  {contact.role} · Met {contact.timesSpoken} time{contact.timesSpoken !== 1 ? 's' : ''}
                </span>
                <span className="mt-1.5 block w-24">
                  <DispositionBar disposition={contact.disposition} label={`Standing with ${contact.name}`} />
                </span>
              </span>
              <ChevronIcon className="shrink-0 text-ps-ink" />
            </button>
          </li>
        ))}
      </ul>
    </section>
  )
}
