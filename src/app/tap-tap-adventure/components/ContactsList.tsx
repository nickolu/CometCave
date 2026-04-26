'use client'
import { useState } from 'react'
import { FantasyCharacter } from '@/app/tap-tap-adventure/models/character'
import { getRelationshipTier, NPCS, ENCOUNTER_NPCS } from '@/app/tap-tap-adventure/config/npcs'
import type { GameNPC } from '@/app/tap-tap-adventure/config/npcs'

interface ContactsListProps {
  character: FantasyCharacter
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
      <div className="text-center py-8 text-slate-400 text-sm">
        <p className="text-2xl mb-2">👥</p>
        <p>You haven&apos;t met any NPCs yet.</p>
        <p className="text-xs mt-1 text-slate-500">Explore landmarks and travel the roads to meet characters.</p>
      </div>
    )
  }

  const selected = selectedNpc ? contacts.find(c => c.id === selectedNpc) : null

  if (selected) {
    // Detail view
    const tierBgColor = selected.tier.tier === 'hostile' ? 'bg-red-500' :
      selected.tier.tier === 'unfriendly' ? 'bg-orange-400' :
      selected.tier.tier === 'neutral' ? 'bg-slate-400' :
      selected.tier.tier === 'friendly' ? 'bg-green-400' :
      selected.tier.tier === 'trusted' ? 'bg-blue-400' : 'bg-amber-400'

    return (
      <div className="space-y-3">
        <button
          onClick={() => setSelectedNpc(null)}
          className="text-xs text-slate-400 hover:text-white transition-colors"
        >
          ← Back to contacts
        </button>
        <div className="bg-[#1e1f30] border border-[#3a3c56] rounded-lg p-4 space-y-3">
          <div className="flex items-center gap-3">
            <span className="text-3xl">{selected.icon}</span>
            <div>
              <div className="font-semibold text-white">{selected.name}</div>
              <div className="text-xs text-slate-400">{selected.role}</div>
            </div>
          </div>
          <p className="text-xs text-slate-300">{selected.description}</p>
          {selected.personality && (
            <p className="text-xs text-slate-500 italic">&quot;{selected.personality}&quot;</p>
          )}
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <span className="text-xs text-slate-400">Relationship:</span>
              <span className={`text-xs font-semibold ${selected.tier.color}`}>{selected.tier.label}</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="flex-1 h-2 bg-slate-700 rounded-full overflow-hidden">
                <div
                  className={`h-full rounded-full transition-all duration-500 ${tierBgColor}`}
                  style={{ width: `${Math.max(5, ((selected.disposition + 100) / 200) * 100)}%` }}
                />
              </div>
              <span className="text-[10px] text-slate-500 w-8 text-right">
                {selected.disposition > 0 ? '+' : ''}{selected.disposition}
              </span>
            </div>
          </div>
          <div className="flex gap-4 text-xs text-slate-400">
            <span>Times spoken: {selected.timesSpoken}</span>
            <span>Region: {selected.regionId.replace(/_/g, ' ')}</span>
          </div>
        </div>
      </div>
    )
  }

  // List view
  return (
    <div className="space-y-2">
      <div className="text-xs text-slate-500 mb-1">{contacts.length} contact{contacts.length !== 1 ? 's' : ''}</div>
      {contacts.map(contact => {
        const tierBgColor = contact.tier.tier === 'hostile' ? 'bg-red-500' :
          contact.tier.tier === 'unfriendly' ? 'bg-orange-400' :
          contact.tier.tier === 'neutral' ? 'bg-slate-400' :
          contact.tier.tier === 'friendly' ? 'bg-green-400' :
          contact.tier.tier === 'trusted' ? 'bg-blue-400' : 'bg-amber-400'

        return (
          <button
            key={contact.id}
            onClick={() => setSelectedNpc(contact.id)}
            className="w-full text-left bg-[#1e1f30] border border-[#3a3c56] hover:border-indigo-700/50 rounded-lg px-3 py-2.5 transition-colors"
          >
            <div className="flex items-center gap-2">
              <span className="text-xl">{contact.icon}</span>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <span className="text-sm font-medium text-white truncate">{contact.name}</span>
                  <span className={`text-[10px] font-semibold uppercase tracking-wide ${contact.tier.color}`}>
                    {contact.tier.label}
                  </span>
                </div>
                <div className="text-[11px] text-slate-500">{contact.role} · Met {contact.timesSpoken} time{contact.timesSpoken !== 1 ? 's' : ''}</div>
              </div>
              <div className="w-16">
                <div className="w-full h-1.5 bg-slate-700 rounded-full overflow-hidden">
                  <div
                    className={`h-full rounded-full ${tierBgColor}`}
                    style={{ width: `${Math.max(5, ((contact.disposition + 100) / 200) * 100)}%` }}
                  />
                </div>
              </div>
            </div>
          </button>
        )
      })}
    </div>
  )
}
