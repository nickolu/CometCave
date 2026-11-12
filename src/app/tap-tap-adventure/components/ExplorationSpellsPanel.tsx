'use client'
import { useCallback, useEffect, useRef, useState } from 'react'

import { useGameStore } from '@/app/tap-tap-adventure/hooks/useGameStore'
import { Spell } from '@/app/tap-tap-adventure/models/spell'
import { PaperButton, PlaybillCaption, PlaybillTitle, Stamp } from '@/app/tap-tap-adventure/stage/Playbill'
import { cn } from '@/lib/utils'

const SCHOOLS = ['all', 'arcane', 'nature', 'shadow', 'war'] as const

const CHIP = 'h-7 px-2 text-xs tracking-widest'

export function ExplorationSpellsPanel() {
  const character = useGameStore(s => s.gameState.characters.find(c => c.id === s.gameState.selectedCharacterId))
  const { castExplorationSpell } = useGameStore()
  const [feedbackMessage, setFeedbackMessage] = useState<string | null>(null)
  const [feedbackSuccess, setFeedbackSuccess] = useState(true)
  const [schoolFilter, setSchoolFilter] = useState<string>('all')
  const [sortByMana, setSortByMana] = useState(false)

  const feedbackTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  useEffect(() => {
    return () => { if (feedbackTimerRef.current != null) clearTimeout(feedbackTimerRef.current) }
  }, [])

  useEffect(() => {
    if (!feedbackMessage) return
    const id = setTimeout(() => setFeedbackMessage(null), 3000)
    return () => clearTimeout(id)
  }, [feedbackMessage])

  const spellbook = character?.spellbook ?? []
  const explorationSpells = spellbook
    .filter(s => s.explorationEffect)
    .filter(s => schoolFilter === 'all' || s.school === schoolFilter)
    .sort((a, b) => sortByMana ? (a.explorationManaCost ?? a.manaCost) - (b.explorationManaCost ?? b.manaCost) : 0)
  const currentMana = character?.mana ?? 0
  const activeSpells = character?.activeExplorationSpells ?? []

  const handleCast = useCallback((spellId: string) => {
    const result = castExplorationSpell(spellId)
    if (result) {
      setFeedbackMessage(result.message)
      setFeedbackSuccess(result.success)
    }
  }, [castExplorationSpell])

  if (explorationSpells.length === 0) {
    return (
      <div className="w-full">
        <PlaybillTitle size="sm" rules={false} className="text-left">Spells on the road</PlaybillTitle>
        <p className="mt-2 font-body text-sm italic leading-snug text-ps-ink-soft">
          None of your spells can be cast outside a fight yet. Scrolls and tutors sometimes teach ones that can.
        </p>
      </div>
    )
  }

  return (
    <div className="w-full">
      <div className="flex items-center justify-between gap-2">
        <PlaybillTitle size="sm" rules={false} className="text-left">Spells on the road</PlaybillTitle>
        <div className="flex shrink-0 items-center gap-1">
          {(character?.explorationShield ?? 0) > 0 && (
            <Stamp tone="blue" tilt={false} title="Shield from a spell">{character!.explorationShield} shield</Stamp>
          )}
          <Stamp tone="blue" tilt={false} title="Mana to spend">{currentMana} MP</Stamp>
        </div>
      </div>

      <div className="mt-3 flex flex-wrap items-center gap-1 border-b-2 border-ps-ink pb-3" role="group" aria-label="Filter by school">
        {SCHOOLS.map(school => (
          <PaperButton
            key={school}
            size="sm"
            variant={schoolFilter === school ? 'ink' : 'outline'}
            aria-pressed={schoolFilter === school}
            onClick={() => setSchoolFilter(school)}
            className={CHIP}
          >
            {school}
          </PaperButton>
        ))}
        <PaperButton
          size="sm"
          variant={sortByMana ? 'ink' : 'outline'}
          aria-pressed={sortByMana}
          onClick={() => setSortByMana(!sortByMana)}
          className={cn(CHIP, 'ml-auto')}
        >
          {sortByMana ? 'Cheapest first' : 'Sort by mana'}
        </PaperButton>
      </div>

      {activeSpells.length > 0 && (
        <div className="mt-3 rounded-[3px] border-2 border-ps-stamp-violet p-2.5">
          <PlaybillCaption className="text-ps-stamp-violet">In effect</PlaybillCaption>
          <ul className="m-0 mt-1 list-none p-0">
            {activeSpells.map(s => (
              <li key={s.spellId} className="flex items-center justify-between gap-2 py-0.5 font-body text-sm text-ps-ink">
                <span className="min-w-0 truncate">
                  {s.spellName} <span className="text-ps-ink-soft">· {s.effectType.replace(/_/g, ' ')}</span>
                </span>
                <Stamp tone="violet" tilt={false} className="shrink-0">{s.stepsRemaining} steps</Stamp>
              </li>
            ))}
          </ul>
        </div>
      )}

      {feedbackMessage && (
        <p
          role="status"
          className={cn(
            'mt-3 rounded-[2px] border-2 px-2.5 py-1.5 font-body text-sm',
            feedbackSuccess ? 'border-ps-stamp-green text-ps-stamp-green' : 'border-ps-stamp-red text-ps-stamp-red'
          )}
        >
          {feedbackMessage}
        </p>
      )}

      <ul className="m-0 list-none p-0">
        {explorationSpells.map((spell: Spell) => {
          const manaCost = spell.explorationManaCost ?? spell.manaCost
          const canCast = currentMana >= manaCost
          const effect = spell.explorationEffect!
          return (
            <li key={spell.id} className="border-b-2 border-dotted border-ps-ink/40 py-3 last:border-b-0">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0 flex-1">
                  <p className="font-body text-base font-medium leading-tight text-ps-ink">{spell.name}</p>
                  <div className="mt-1.5 flex flex-wrap items-center gap-1">
                    <Stamp tone="violet" tilt={false} className="capitalize">{spell.school}</Stamp>
                    <Stamp tone="ink" tilt={false}>{effect.type.replace(/_/g, ' ')}</Stamp>
                    {spell.cooldown > 0 && <Stamp tone="ink" tilt={false} title="Turns before it can be cast again in a fight">Cooldown {spell.cooldown}</Stamp>}
                  </div>
                  <p className="mt-1.5 font-body text-xs leading-snug text-ps-ink-soft">{effect.description}</p>
                </div>
                <Stamp tone={canCast ? 'blue' : 'red'} tilt={false} className="shrink-0" title={canCast ? 'You have the mana' : 'Not enough mana'}>
                  {manaCost} MP
                </Stamp>
              </div>
              <div className="mt-2.5 flex flex-wrap items-center gap-2">
                <PaperButton
                  size="sm"
                  variant={canCast ? 'brass' : 'outline'}
                  onClick={() => canCast && handleCast(spell.id)}
                  disabled={!canCast}
                >
                  Cast
                </PaperButton>
                {!canCast && <span className="font-body text-xs italic text-ps-ink-soft">Needs {manaCost - currentMana} more mana</span>}
              </div>
            </li>
          )
        })}
      </ul>
    </div>
  )
}
