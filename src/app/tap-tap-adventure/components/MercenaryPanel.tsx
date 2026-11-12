'use client'

/**
 * The party: who rides with you, who waits in the roster, and (in town) who
 * can be hired at the tavern. Each is a small ruled card on the bill; health
 * is a thin ink rule, standing is a stamp, prices sit on brass. On the road
 * the hiring lists are not printed: companions are found in town, or through
 * what happens on the road itself.
 */
import { useMemo, useState } from 'react'

import { PartyDialoguePanel } from '@/app/tap-tap-adventure/components/PartyDialoguePanel'
import { getMercenaryMaxHp, getTavernMercenaries } from '@/app/tap-tap-adventure/config/mercenaries'
import { getRelationshipTier } from '@/app/tap-tap-adventure/config/npcs'
import { useGameStore } from '@/app/tap-tap-adventure/hooks/useGameStore'
import { calculateDay } from '@/app/tap-tap-adventure/lib/leveling'
import { getTavernRecruits } from '@/app/tap-tap-adventure/lib/partyRecruitment'
import { FantasyCharacter } from '@/app/tap-tap-adventure/models/character'
import { Mercenary } from '@/app/tap-tap-adventure/models/mercenary'
import { MAX_PARTY_SIZE } from '@/app/tap-tap-adventure/models/partyMember'
import { BrassFigure, BrassPlate, PaperButton, PlaybillCaption, PlaybillLine, PlaybillTitle, Stamp, type StampTone } from '@/app/tap-tap-adventure/stage/Playbill'
import { cn } from '@/lib/utils'

interface MercenaryPanelProps {
  character: FantasyCharacter
  /** True in a town: the tavern's hiring lists are printed. On the road they are not. */
  canHire: boolean
}

const RARITY_TONE: Record<string, StampTone> = {
  common: 'ink',
  uncommon: 'green',
  rare: 'blue',
  legendary: 'gold',
}

const RELATIONSHIP_TONE: Record<string, StampTone> = {
  hostile: 'red',
  unfriendly: 'red',
  neutral: 'ink',
  friendly: 'green',
  trusted: 'blue',
  bonded: 'gold',
}

const INPUT_CLASS =
  'h-8 w-full rounded-[3px] border-2 border-ps-ink bg-transparent px-2 font-body text-sm text-ps-ink placeholder:text-ps-ink-faint focus:outline-none focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ds-primary'

function RarityStamp({ rarity }: { rarity: Mercenary['rarity'] }) {
  return (
    <Stamp tone={RARITY_TONE[rarity] ?? 'ink'} tilt={false} className="text-xs">
      {rarity}
    </Stamp>
  )
}

function HpBar({ current, max, name }: { current: number; max: number; name: string }) {
  const ratio = max > 0 ? Math.max(0, Math.min(1, current / max)) : 0
  const fill = ratio > 0.5 ? 'bg-ps-stamp-green' : ratio > 0.25 ? 'bg-ps-ink' : 'bg-ps-stamp-red'
  return (
    <div className="flex items-center gap-2">
      <span className="font-label text-xs font-bold uppercase tracking-widest text-ps-ink-soft">HP</span>
      <div
        className="h-1.5 flex-1 overflow-hidden rounded-full bg-ps-playbill-edge"
        role="progressbar"
        aria-valuemin={0}
        aria-valuemax={max}
        aria-valuenow={current}
        aria-label={`${name}'s health`}
      >
        <div className={cn('h-full rounded-full transition-[width] duration-300', fill)} style={{ width: `${ratio * 100}%` }} />
      </div>
      <span className="w-12 shrink-0 text-right font-playbill text-xs tabular-nums text-ps-ink">{current}/{max}</span>
    </div>
  )
}

function Price({ gold, canAfford, have }: { gold: number; canAfford: boolean; have: number }) {
  return (
    <BrassPlate className={cn('px-2 py-1 font-playbill text-sm leading-none tabular-nums', !canAfford && 'opacity-70')} title={canAfford ? `Costs ${gold} gold` : `Costs ${gold} gold; you have ${have}`}>
      {gold} gold
    </BrassPlate>
  )
}

function Card({ className, children }: { className?: string; children: React.ReactNode }) {
  return <div className={cn('rounded-[3px] border-2 border-ps-ink p-2.5', className)}>{children}</div>
}

function ConfirmDismiss({ name, onYes, onNo }: { name: string; onYes: () => void; onNo: () => void }) {
  return (
    <div className="flex flex-wrap items-center justify-end gap-2">
      <span className="font-body text-xs text-ps-stamp-red">Dismiss {name}?</span>
      <PaperButton size="sm" variant="danger" onClick={onYes}>Yes</PaperButton>
      <PaperButton size="sm" variant="outline" onClick={onNo}>No</PaperButton>
    </div>
  )
}

export function MercenaryPanel({ character, canHire }: MercenaryPanelProps) {
  const { recruitMercenary, dismissMercenary, setActiveMercenary, recruitTavernMember, removePartyMember, updatePartyMemberRelationship, renamePartyMember } = useGameStore()
  const [dismissConfirm, setDismissConfirm] = useState<string | null>(null)
  const [talkingTo, setTalkingTo] = useState<string | null>(null)
  const [giftingTo, setGiftingTo] = useState<string | null>(null)
  const [renaming, setRenaming] = useState<string | null>(null)
  const [renameValue, setRenameValue] = useState('')

  // Stable tavern selection per character level — prevents re-randomization on each render
  const tavernMercs = useMemo(
    () => getTavernMercenaries(character.level),
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

  const commitRename = (memberId: string) => {
    const trimmed = renameValue.trim().slice(0, 20)
    if (trimmed.length > 0) renamePartyMember(memberId, trimmed)
    setRenaming(null)
  }

  return (
    <section aria-label="Party" className="space-y-4">
      <PlaybillTitle size="sm">Party</PlaybillTitle>
      <div className="flex items-center justify-between gap-3">
        <PlaybillCaption>
          {partyMembers.length} companion{partyMembers.length !== 1 ? 's' : ''} · {active ? `riding with ${active.customName ?? active.name}` : 'no mercenary'}
        </PlaybillCaption>
        <BrassPlate className="shrink-0">
          <BrassFigure label="Gold" value={character.gold.toLocaleString()} />
        </BrassPlate>
      </div>

      {/* Active Mercenary */}
      <div>
        <PlaybillCaption className="mb-1.5">Riding with you</PlaybillCaption>
        {active ? (
          <Card className="space-y-2">
            <div className="flex items-start justify-between gap-2">
              <div className="flex min-w-0 items-start gap-2">
                <span aria-hidden className="w-7 shrink-0 text-center font-body text-xl leading-none">{active.icon}</span>
                <div className="min-w-0">
                  <div className="truncate font-playbill text-base uppercase leading-none tracking-wide text-ps-ink">
                    {active.customName ?? active.name}
                  </div>
                  <div className="mt-1 flex flex-wrap items-center gap-1">
                    <span className="font-body text-xs capitalize text-ps-ink-soft">{active.class}</span>
                    <RarityStamp rarity={active.rarity} />
                  </div>
                </div>
              </div>
              <div className="shrink-0 text-right font-body text-xs text-ps-ink-soft">
                <div className="tabular-nums">ATK <span className="font-playbill text-ps-ink">{active.attack}</span> · DEF <span className="font-playbill text-ps-ink">{active.defense}</span></div>
                <div className="tabular-nums"><span className="font-playbill text-ps-ink">{active.dailyCost}</span> gold a day</div>
              </div>
            </div>
            <HpBar
              current={active.hp ?? getMercenaryMaxHp(active.rarity)}
              max={active.maxHp ?? getMercenaryMaxHp(active.rarity)}
              name={active.customName ?? active.name}
            />
            {dismissConfirm === active.id ? (
              <ConfirmDismiss
                name={active.name}
                onYes={() => {
                  dismissMercenary(active.id)
                  setDismissConfirm(null)
                }}
                onNo={() => setDismissConfirm(null)}
              />
            ) : (
              <div className="flex justify-end">
                <PaperButton size="sm" variant="danger" onClick={() => setDismissConfirm(active.id)}>
                  Dismiss
                </PaperButton>
              </div>
            )}
          </Card>
        ) : (
          <p className="font-body text-sm italic text-ps-ink-soft">
            {canHire ? 'No mercenary rides with you. Hire one at the tavern below.' : 'No mercenary rides with you. Mercenaries are hired in town.'}
          </p>
        )}
      </div>

      {/* Roster */}
      {roster.length > 0 && (
        <div>
          <PlaybillCaption className="mb-1.5">Roster ({roster.length}/3)</PlaybillCaption>
          <ul className="space-y-2">
            {roster.map(merc => (
              <li key={merc.id}>
                <Card className={cn('flex flex-wrap items-center justify-between gap-2', active?.id === merc.id && 'border-ps-brass-deep')}>
                  <div className="flex min-w-0 items-center gap-2">
                    <span aria-hidden className="w-7 shrink-0 text-center font-body text-lg leading-none">{merc.icon}</span>
                    <div className="min-w-0">
                      <div className="truncate font-playbill text-sm uppercase leading-none tracking-wide text-ps-ink">{merc.customName ?? merc.name}</div>
                      <div className="mt-1 flex flex-wrap items-center gap-1">
                        <span className="font-body text-xs capitalize text-ps-ink-soft">{merc.class}</span>
                        <RarityStamp rarity={merc.rarity} />
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center gap-1.5">
                    {dismissConfirm === `roster-${merc.id}` ? (
                      <ConfirmDismiss
                        name={merc.customName ?? merc.name}
                        onYes={() => {
                          dismissMercenary(merc.id)
                          setDismissConfirm(null)
                        }}
                        onNo={() => setDismissConfirm(null)}
                      />
                    ) : (
                      <>
                        {active?.id !== merc.id && (
                          <PaperButton size="sm" variant="outline" onClick={() => setActiveMercenary(merc.id)}>
                            Ride with
                          </PaperButton>
                        )}
                        {active?.id === merc.id && <Stamp tone="gold">Riding</Stamp>}
                        <PaperButton
                          size="sm"
                          variant="danger"
                          onClick={() => setDismissConfirm(`roster-${merc.id}`)}
                          aria-label={`Dismiss ${merc.customName ?? merc.name}`}
                        >
                          Dismiss
                        </PaperButton>
                      </>
                    )}
                  </div>
                </Card>
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* Party Members */}
      {partyMembers.length > 0 && (
        <div>
          <PlaybillCaption className="mb-1.5">Companions ({partyMembers.length}/{MAX_PARTY_SIZE})</PlaybillCaption>
          <ul className="space-y-2">
            {partyMembers.map(member => {
              const tier = getRelationshipTier(member.relationship ?? 0)
              const shownName = member.customName ?? member.name
              return (
                <li key={member.id}>
                  <Card className="space-y-2">
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex min-w-0 flex-1 items-start gap-2">
                        <span aria-hidden className="w-7 shrink-0 text-center font-body text-lg leading-none">{member.icon}</span>
                        <div className="min-w-0 flex-1">
                          {renaming === member.id ? (
                            <form
                              className="flex items-center gap-1.5"
                              onSubmit={e => {
                                e.preventDefault()
                                commitRename(member.id)
                              }}
                            >
                              <label className="min-w-0 flex-1">
                                <span className="sr-only">New name for {shownName}</span>
                                <input
                                  type="text"
                                  value={renameValue}
                                  onChange={e => setRenameValue(e.target.value.slice(0, 20))}
                                  placeholder={member.name}
                                  className={INPUT_CLASS}
                                  onKeyDown={e => {
                                    if (e.key === 'Escape') setRenaming(null)
                                  }}
                                  autoFocus
                                />
                              </label>
                              <PaperButton size="sm" type="submit" disabled={renameValue.trim().length === 0}>Save</PaperButton>
                              <PaperButton size="sm" variant="outline" onClick={() => setRenaming(null)}>Cancel</PaperButton>
                            </form>
                          ) : (
                            <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
                              <span className="truncate font-playbill text-sm uppercase leading-none tracking-wide text-ps-ink">{shownName}</span>
                              <Stamp tone={RELATIONSHIP_TONE[tier.tier] ?? 'ink'} tilt={false} className="text-xs" title={`Standing ${member.relationship ?? 0}`}>
                                {tier.label}
                              </Stamp>
                              <button
                                type="button"
                                onClick={() => {
                                  setRenameValue(shownName)
                                  setRenaming(member.id)
                                }}
                                className="rounded-[2px] font-label text-xs font-bold uppercase tracking-widest text-ps-ink-soft underline decoration-ps-ink-faint underline-offset-2 hover:text-ps-ink focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ds-primary"
                                aria-label={`Rename ${shownName}`}
                              >
                                Rename
                              </button>
                            </div>
                          )}
                          <div className="mt-1 font-body text-xs text-ps-ink-soft">
                            {member.className} · Lv <span className="tabular-nums">{member.level}</span> · <span className="tabular-nums">{member.dailyCost}</span> gold a day
                          </div>
                        </div>
                      </div>
                    </div>
                    <HpBar current={member.hp} max={member.maxHp} name={shownName} />
                    {dismissConfirm === `party-${member.id}` ? (
                      <ConfirmDismiss
                        name={shownName}
                        onYes={() => { removePartyMember(member.id); setDismissConfirm(null) }}
                        onNo={() => setDismissConfirm(null)}
                      />
                    ) : (
                      <div className="flex flex-wrap items-center justify-end gap-1.5">
                        <PaperButton size="sm" variant="outline" onClick={() => setTalkingTo(member.id)}>
                          Talk
                        </PaperButton>
                        <PaperButton size="sm" variant="outline" aria-pressed={giftingTo === member.id} onClick={() => setGiftingTo(giftingTo === member.id ? null : member.id)}>
                          Gift
                        </PaperButton>
                        <PaperButton size="sm" variant="danger" onClick={() => setDismissConfirm(`party-${member.id}`)}>
                          Dismiss
                        </PaperButton>
                      </div>
                    )}
                    {giftingTo === member.id && (() => {
                      const giftItems = character.inventory.filter(
                        i => i.effects?.companionGift && i.quantity > 0 && i.status !== 'deleted'
                      )
                      if (giftItems.length === 0) {
                        return (
                          <p className="border-t border-ps-playbill-edge pt-2 font-body text-xs italic leading-snug text-ps-ink-soft">
                            Nothing in your pack to give. A Friendship Token, Lucky Pendant or Bond of Loyalty can be crafted at a crafting station.
                          </p>
                        )
                      }
                      return (
                        <div className="space-y-1.5 border-t border-ps-playbill-edge pt-2">
                          <PlaybillCaption>Give {shownName}</PlaybillCaption>
                          {giftItems.map(item => (
                            <PlaybillLine
                              key={item.id}
                              className="py-1.5 text-sm"
                              note={item.quantity > 1 ? `You have ${item.quantity}` : undefined}
                              trailing={<Stamp tone="green" tilt={false} className="text-xs">+{item.effects?.companionGift} standing</Stamp>}
                              onClick={() => {
                                const delta = item.effects?.companionGift ?? 0
                                if (delta > 0) {
                                  updatePartyMemberRelationship(member.id, delta)
                                  const { gameState: gs, setGameState } = useGameStore.getState()
                                  const updatedChars = gs.characters.map(c => {
                                    if (c.id !== gs.selectedCharacterId) return c
                                    const updatedInv = c.inventory.map(i => {
                                      if (i.id !== item.id) return i
                                      const newQty = i.quantity - 1
                                      return newQty <= 0 ? { ...i, quantity: 0, status: 'deleted' as const } : { ...i, quantity: newQty }
                                    }).filter(i => i.quantity > 0)
                                    return { ...c, inventory: updatedInv }
                                  })
                                  setGameState({ ...gs, characters: updatedChars })
                                  setGiftingTo(null)
                                }
                              }}
                            >
                              {item.name}
                            </PlaybillLine>
                          ))}
                        </div>
                      )
                    })()}
                  </Card>
                </li>
              )
            })}
          </ul>
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

      {canHire ? (
        <>
          {/* Tavern Recruits (Party Members) */}
        <div>
          <PlaybillCaption className="mb-1.5">Companions for hire</PlaybillCaption>
          {(partyMembers.length >= MAX_PARTY_SIZE) && (
            <p className="mb-2 font-body text-xs text-ps-stamp-red">Your party is full ({MAX_PARTY_SIZE}/{MAX_PARTY_SIZE}). Dismiss a companion to hire another.</p>
          )}
          <ul className="space-y-2">
            {tavernRecruits.map(recruit => {
              const alreadyHave = partyMembers.some(m => m.name === recruit.name)
              const canAfford = character.gold >= (recruit.recruitCost ?? 0)
              const partyFull = partyMembers.length >= MAX_PARTY_SIZE
              const disabled = !canAfford || partyFull || alreadyHave

              return (
                <li key={recruit.id}>
                  <Card className="flex items-center justify-between gap-2">
                    <div className="flex min-w-0 items-center gap-2">
                      <span aria-hidden className="w-7 shrink-0 text-center font-body text-lg leading-none">{recruit.icon}</span>
                      <div className="min-w-0">
                        <div className="truncate font-playbill text-sm uppercase leading-none tracking-wide text-ps-ink">{recruit.name}</div>
                        <div className="mt-1 font-body text-xs text-ps-ink-soft">
                          {recruit.className} · Lv <span className="tabular-nums">{recruit.level}</span> · <span className="tabular-nums">{recruit.dailyCost}</span> gold a day
                        </div>
                      </div>
                    </div>
                    <div className="flex shrink-0 flex-col items-end gap-1.5">
                      {alreadyHave ? (
                        <Stamp tone="green">In your party</Stamp>
                      ) : (
                        <>
                          <Price gold={recruit.recruitCost ?? 0} canAfford={canAfford} have={character.gold} />
                          <PaperButton
                            size="sm"
                            variant="brass"
                            disabled={disabled}
                            onClick={() => recruitTavernMember(recruit)}
                            title={!canAfford ? `Need ${recruit.recruitCost} gold` : partyFull ? 'Party full' : `Hire ${recruit.name}`}
                          >
                            Hire
                          </PaperButton>
                        </>
                      )}
                    </div>
                  </Card>
                </li>
              )
            })}
          </ul>
        </div>

        {/* Tavern */}
        <div>
          <PlaybillCaption className="mb-1.5">Mercenaries at the tavern</PlaybillCaption>
          {roster.length >= 3 && (
            <p className="mb-2 font-body text-xs text-ps-stamp-red">Your roster is full (3/3). Dismiss a mercenary to recruit another.</p>
          )}
          <ul className="space-y-2">
            {tavernMercs.map(merc => {
              const alreadyHave = roster.some(m => m.id === merc.id)
              const canAfford = character.gold >= merc.recruitCost
              const rosterFull = roster.length >= 3
              const disabled = !canAfford || rosterFull || alreadyHave

              return (
                <li key={merc.id}>
                  <Card className="flex items-center justify-between gap-2">
                    <div className="flex min-w-0 items-center gap-2">
                      <span aria-hidden className="w-7 shrink-0 text-center font-body text-lg leading-none">{merc.icon}</span>
                      <div className="min-w-0">
                        <div className="truncate font-playbill text-sm uppercase leading-none tracking-wide text-ps-ink">{merc.name}</div>
                        <div className="mt-1 flex flex-wrap items-center gap-1">
                          <span className="font-body text-xs capitalize text-ps-ink-soft">{merc.class}</span>
                          <RarityStamp rarity={merc.rarity} />
                        </div>
                        <div className="mt-1 font-body text-xs tabular-nums text-ps-ink-soft">
                          ATK {merc.attack} · DEF {merc.defense} · {merc.dailyCost} gold a day
                        </div>
                      </div>
                    </div>
                    <div className="flex shrink-0 flex-col items-end gap-1.5">
                      {alreadyHave ? (
                        <Stamp tone="green">In your roster</Stamp>
                      ) : (
                        <>
                          <Price gold={merc.recruitCost} canAfford={canAfford} have={character.gold} />
                          <PaperButton
                            size="sm"
                            variant="brass"
                            disabled={disabled}
                            onClick={() => recruitMercenary(merc)}
                            title={!canAfford ? `Need ${merc.recruitCost}g` : rosterFull ? 'Roster full' : ''}
                          >
                            Recruit
                          </PaperButton>
                        </>
                      )}
                    </div>
                  </Card>
                </li>
              )
            })}
          </ul>
        </div>
        </>
      ) : (
        <div>
          <PlaybillCaption className="mb-1.5">For hire</PlaybillCaption>
          <p className="font-body text-sm italic leading-snug text-ps-ink-soft">
            Companions and mercenaries are hired in town. Reach one and open this drawer again to see who is at the tavern.
          </p>
        </div>
      )}
    </section>
  )
}
