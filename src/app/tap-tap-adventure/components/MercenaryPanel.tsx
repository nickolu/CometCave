'use client'

import { useMemo, useState } from 'react'

import { getTavernMercenaries, getMercenaryMaxHp } from '@/app/tap-tap-adventure/config/mercenaries'
import { useGameStore } from '@/app/tap-tap-adventure/hooks/useGameStore'
import { FantasyCharacter } from '@/app/tap-tap-adventure/models/character'
import { Mercenary } from '@/app/tap-tap-adventure/models/mercenary'
import { getTavernRecruits } from '@/app/tap-tap-adventure/lib/partyRecruitment'
import { calculateDay } from '@/app/tap-tap-adventure/lib/leveling'
import { MAX_PARTY_SIZE } from '@/app/tap-tap-adventure/models/partyMember'
import { PartyDialoguePanel } from '@/app/tap-tap-adventure/components/PartyDialoguePanel'

interface MercenaryPanelProps {
  character: FantasyCharacter
}

function RarityBadge({ rarity }: { rarity: Mercenary['rarity'] }) {
  const colors: Record<string, string> = {
    common: 'text-slate-300 bg-slate-700/60',
    uncommon: 'text-green-400 bg-green-900/40',
    rare: 'text-blue-400 bg-blue-900/40',
    legendary: 'text-amber-400 bg-amber-900/40',
  }
  return (
    <span className={`text-[10px] px-1.5 py-0.5 rounded capitalize font-semibold ${colors[rarity] ?? ''}`}>
      {rarity}
    </span>
  )
}

function ClassBadge({ cls }: { cls: Mercenary['class'] }) {
  const icons: Record<string, string> = {
    warrior: '⚔️',
    ranger: '🏹',
    mage: '🔮',
    rogue: '🗡️',
    cleric: '✨',
  }
  return (
    <span className="text-[10px] text-slate-400 capitalize">
      {icons[cls] ?? ''} {cls}
    </span>
  )
}

function HpBar({ current, max }: { current: number; max: number }) {
  const pct = max > 0 ? Math.max(0, Math.min(100, (current / max) * 100)) : 0
  return (
    <div className="flex items-center gap-1.5 text-[10px]">
      <span className="text-slate-400 w-5">HP</span>
      <div className="flex-1 h-1.5 bg-slate-700 rounded-full overflow-hidden">
        <div
          className="h-full bg-red-500 rounded-full transition-all"
          style={{ width: `${pct}%` }}
        />
      </div>
      <span className="text-slate-400 text-right w-12">{current}/{max}</span>
    </div>
  )
}

export function MercenaryPanel({ character }: MercenaryPanelProps) {
  const { recruitMercenary, dismissMercenary, setActiveMercenary, recruitTavernMember, removePartyMember, updatePartyMemberRelationship } = useGameStore()
  const [isExpanded, setIsExpanded] = useState(false)
  const [dismissConfirm, setDismissConfirm] = useState<string | null>(null)
  const [talkingTo, setTalkingTo] = useState<string | null>(null)

  // Stable tavern selection per character level — prevents re-randomization on each render
  const tavernMercs = useMemo(
    () => getTavernMercenaries(character.level),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [character.level]
  )

  const day = calculateDay(character.distance ?? 0)
  const tavernRecruits = useMemo(
    () => getTavernRecruits(character.level, character.currentRegion ?? 'green_meadows', day),
    [character.level, character.currentRegion, day]
  )
  const partyMembers = character.party ?? []

  const roster = character.mercenaryRoster ?? []
  const active = character.activeMercenary

  if (!isExpanded) {
    return (
      <button
        className="w-full bg-[#1e1f30] border border-[#3a3c56] rounded-lg p-3 text-left hover:border-amber-700/50 transition-colors"
        onClick={() => setIsExpanded(true)}
      >
        <div className="flex justify-between items-center">
          <span className="text-sm font-bold text-amber-400">&#x2694;&#xFE0F; Party</span>
          <span className="text-xs text-slate-400">
            {active ? `${active.icon} ${active.customName ?? active.name}` : 'No mercenary'}
          </span>
        </div>
      </button>
    )
  }

  return (
    <div className="bg-[#1e1f30] border border-[#3a3c56] rounded-lg p-3 space-y-4">
      {/* Header */}
      <div className="flex justify-between items-center">
        <button
          className="text-sm font-bold text-amber-400 hover:text-amber-300 transition-colors"
          onClick={() => setIsExpanded(false)}
        >
          &#x2694;&#xFE0F; Party
        </button>
        <span className="text-xs text-amber-300 font-semibold">
          &#x1F4B0; {character.gold.toLocaleString()}g
        </span>
      </div>

      {/* Active Mercenary */}
      <div>
        <h4 className="text-xs font-semibold text-slate-400 uppercase mb-2">Active</h4>
        {active ? (
          <div className="bg-[#252638] border border-[#3a3c56] rounded p-2 space-y-1.5">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-1.5">
                <span className="text-xl">{active.icon}</span>
                <div>
                  <div className="text-sm font-semibold text-slate-200">
                    {active.customName ?? active.name}
                  </div>
                  <div className="flex items-center gap-1 mt-0.5">
                    <ClassBadge cls={active.class} />
                    <RarityBadge rarity={active.rarity} />
                  </div>
                </div>
              </div>
              <div className="text-right text-[10px] text-slate-400">
                <div>ATK {active.attack} · DEF {active.defense}</div>
                <div>{active.dailyCost}g/day</div>
              </div>
            </div>
            <HpBar
              current={active.hp ?? getMercenaryMaxHp(active.rarity)}
              max={active.maxHp ?? getMercenaryMaxHp(active.rarity)}
            />
            {dismissConfirm === active.id ? (
              <div className="flex items-center gap-2 mt-1">
                <span className="text-[10px] text-red-400">Dismiss {active.name}?</span>
                <button
                  className="text-[10px] px-2 py-0.5 bg-red-900/50 text-red-400 rounded hover:bg-red-800/50"
                  onClick={() => {
                    dismissMercenary(active.id)
                    setDismissConfirm(null)
                  }}
                >
                  Yes
                </button>
                <button
                  className="text-[10px] px-2 py-0.5 bg-slate-700/50 text-slate-300 rounded hover:bg-slate-600/50"
                  onClick={() => setDismissConfirm(null)}
                >
                  No
                </button>
              </div>
            ) : (
              <button
                className="text-[10px] px-2 py-0.5 bg-red-900/30 text-red-400 rounded hover:bg-red-800/40 transition-colors"
                onClick={() => setDismissConfirm(active.id)}
              >
                Dismiss
              </button>
            )}
          </div>
        ) : (
          <div className="text-xs text-slate-500 italic">No active mercenary. Recruit from the tavern below.</div>
        )}
      </div>

      {/* Roster */}
      {roster.length > 0 && (
        <div>
          <h4 className="text-xs font-semibold text-slate-400 uppercase mb-2">Roster ({roster.length}/3)</h4>
          <div className="space-y-1.5">
            {roster.map(merc => (
              <div
                key={merc.id}
                className={`bg-[#252638] border rounded p-2 flex items-center justify-between ${
                  active?.id === merc.id ? 'border-amber-600/60' : 'border-[#3a3c56]'
                }`}
              >
                <div className="flex items-center gap-1.5">
                  <span className="text-lg">{merc.icon}</span>
                  <div>
                    <div className="text-xs font-semibold text-slate-200">{merc.customName ?? merc.name}</div>
                    <div className="flex items-center gap-1 mt-0.5">
                      <ClassBadge cls={merc.class} />
                      <RarityBadge rarity={merc.rarity} />
                    </div>
                  </div>
                </div>
                <div className="flex items-center gap-1.5">
                  {dismissConfirm === `roster-${merc.id}` ? (
                    <>
                      <button
                        className="text-[10px] px-1.5 py-0.5 bg-red-900/50 text-red-400 rounded hover:bg-red-800/50"
                        onClick={() => {
                          dismissMercenary(merc.id)
                          setDismissConfirm(null)
                        }}
                      >
                        Yes
                      </button>
                      <button
                        className="text-[10px] px-1.5 py-0.5 bg-slate-700/50 text-slate-300 rounded hover:bg-slate-600/50"
                        onClick={() => setDismissConfirm(null)}
                      >
                        No
                      </button>
                    </>
                  ) : (
                    <>
                      {active?.id !== merc.id && (
                        <button
                          className="text-[10px] px-2 py-0.5 bg-indigo-900/50 text-indigo-300 rounded hover:bg-indigo-800/50 transition-colors"
                          onClick={() => setActiveMercenary(merc.id)}
                        >
                          Set Active
                        </button>
                      )}
                      {active?.id === merc.id && (
                        <span className="text-[10px] text-amber-400 font-semibold">Active</span>
                      )}
                      <button
                        className="text-[10px] px-1.5 py-0.5 bg-red-900/30 text-red-400 rounded hover:bg-red-800/40 transition-colors"
                        onClick={() => setDismissConfirm(`roster-${merc.id}`)}
                      >
                        ✕
                      </button>
                    </>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Party Members */}
      {partyMembers.length > 0 && (
        <div>
          <h4 className="text-xs font-semibold text-slate-400 uppercase mb-2">Companions ({partyMembers.length}/{MAX_PARTY_SIZE})</h4>
          <div className="space-y-1.5">
            {partyMembers.map(member => (
              <div key={member.id} className="bg-[#252638] border border-[#3a3c56] rounded p-2 flex items-center justify-between">
                <div className="flex items-center gap-1.5">
                  <span className="text-lg">{member.icon}</span>
                  <div>
                    <div className="text-xs font-semibold text-slate-200">{member.customName ?? member.name}</div>
                    <div className="text-[10px] text-slate-400">{member.className}</div>
                    <div className="text-[10px] text-slate-500">Lv {member.level} · {member.dailyCost}g/day</div>
                  </div>
                </div>
                <div className="flex items-center gap-1.5">
                  {dismissConfirm === `party-${member.id}` ? (
                    <>
                      <button className="text-[10px] px-1.5 py-0.5 bg-red-900/50 text-red-400 rounded hover:bg-red-800/50"
                        onClick={() => { removePartyMember(member.id); setDismissConfirm(null) }}>Yes</button>
                      <button className="text-[10px] px-1.5 py-0.5 bg-slate-700/50 text-slate-300 rounded hover:bg-slate-600/50"
                        onClick={() => setDismissConfirm(null)}>No</button>
                    </>
                  ) : (
                    <>
                      <button
                        className="text-[10px] px-1.5 py-0.5 bg-indigo-900/30 text-indigo-300 rounded hover:bg-indigo-800/40 transition-colors"
                        onClick={() => setTalkingTo(member.id)}
                      >
                        Talk
                      </button>
                      <button className="text-[10px] px-1.5 py-0.5 bg-red-900/30 text-red-400 rounded hover:bg-red-800/40 transition-colors"
                        onClick={() => setDismissConfirm(`party-${member.id}`)}>Dismiss</button>
                    </>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Party Dialogue Panel */}
      {talkingTo && (() => {
        const member = partyMembers.find(m => m.id === talkingTo)
        if (!member) return null
        return (
          <PartyDialoguePanel
            member={member}
            characterName={character.name}
            characterClass={character.classData?.name ?? character.class ?? 'Adventurer'}
            characterLevel={character.level}
            characterCharisma={character.charisma ?? 5}
            disposition={member.relationship ?? 0}
            onDispositionChange={(delta) => updatePartyMemberRelationship(member.id, delta)}
            onClose={() => setTalkingTo(null)}
          />
        )
      })()}

      {/* Tavern Recruits (Party Members) */}
      <div>
        <h4 className="text-xs font-semibold text-slate-400 uppercase mb-2">Hire Companions</h4>
        {(partyMembers.length >= MAX_PARTY_SIZE) && (
          <div className="text-[10px] text-amber-500 mb-2">Party full ({MAX_PARTY_SIZE}/{MAX_PARTY_SIZE}). Dismiss a companion to hire more.</div>
        )}
        <div className="space-y-1.5">
          {tavernRecruits.map(recruit => {
            const alreadyHave = partyMembers.some(m => m.name === recruit.name)
            const canAfford = character.gold >= (recruit.recruitCost ?? 0)
            const partyFull = partyMembers.length >= MAX_PARTY_SIZE
            const disabled = !canAfford || partyFull || alreadyHave

            return (
              <div key={recruit.id} className="bg-[#252638] border border-[#3a3c56] rounded p-2 flex items-center justify-between">
                <div className="flex items-center gap-1.5">
                  <span className="text-lg">{recruit.icon}</span>
                  <div>
                    <div className="text-xs font-semibold text-slate-200">{recruit.name}</div>
                    <div className="text-[10px] text-slate-400">{recruit.className}</div>
                    <div className="text-[10px] text-slate-500">Lv {recruit.level} · {recruit.dailyCost}g/day</div>
                  </div>
                </div>
                <div className="text-right">
                  {alreadyHave ? (
                    <span className="text-[10px] text-green-400">In party</span>
                  ) : (
                    <button
                      className={`text-[10px] px-2 py-1 rounded transition-colors ${
                        disabled ? 'bg-slate-700/40 text-slate-500 cursor-not-allowed' : 'bg-amber-700/50 text-amber-300 hover:bg-amber-600/60'
                      }`}
                      disabled={disabled}
                      onClick={() => recruitTavernMember(recruit)}
                    >
                      {recruit.recruitCost}g Hire
                    </button>
                  )}
                </div>
              </div>
            )
          })}
        </div>
      </div>

      {/* Tavern */}
      <div>
        <h4 className="text-xs font-semibold text-slate-400 uppercase mb-2">Tavern</h4>
        {roster.length >= 3 && (
          <div className="text-[10px] text-amber-500 mb-2">Roster full (3/3). Dismiss a mercenary to recruit more.</div>
        )}
        <div className="space-y-1.5">
          {tavernMercs.map(merc => {
            const alreadyHave = roster.some(m => m.id === merc.id)
            const canAfford = character.gold >= merc.recruitCost
            const rosterFull = roster.length >= 3
            const disabled = !canAfford || rosterFull || alreadyHave

            return (
              <div
                key={merc.id}
                className="bg-[#252638] border border-[#3a3c56] rounded p-2 flex items-center justify-between"
              >
                <div className="flex items-center gap-1.5">
                  <span className="text-lg">{merc.icon}</span>
                  <div>
                    <div className="text-xs font-semibold text-slate-200">{merc.name}</div>
                    <div className="flex items-center gap-1 mt-0.5">
                      <ClassBadge cls={merc.class} />
                      <RarityBadge rarity={merc.rarity} />
                    </div>
                    <div className="text-[10px] text-slate-500 mt-0.5">
                      ATK {merc.attack} · DEF {merc.defense} · {merc.dailyCost}g/day
                    </div>
                  </div>
                </div>
                <div className="text-right">
                  {alreadyHave ? (
                    <span className="text-[10px] text-green-400">In roster</span>
                  ) : (
                    <button
                      className={`text-[10px] px-2 py-1 rounded transition-colors ${
                        disabled
                          ? 'bg-slate-700/40 text-slate-500 cursor-not-allowed'
                          : 'bg-amber-700/50 text-amber-300 hover:bg-amber-600/60'
                      }`}
                      disabled={disabled}
                      onClick={() => recruitMercenary(merc)}
                      title={!canAfford ? `Need ${merc.recruitCost}g` : rosterFull ? 'Roster full' : ''}
                    >
                      {merc.recruitCost}g Recruit
                    </button>
                  )}
                </div>
              </div>
            )
          })}
        </div>
      </div>
    </div>
  )
}
