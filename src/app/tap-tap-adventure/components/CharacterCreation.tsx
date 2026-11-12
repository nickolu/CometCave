'use client'
import React, { useCallback, useEffect, useState } from 'react'

import {
  ClassOption,
  RACES,
  RaceOption,
  StatModifiers,
} from '@/app/tap-tap-adventure/config/characterOptions'
import { DIFFICULTY_MODES, DifficultyMode } from '@/app/tap-tap-adventure/config/difficultyModes'
import { useCharacterCreation } from '@/app/tap-tap-adventure/hooks/useCharacterCreation'
import { GeneratedClass } from '@/app/tap-tap-adventure/models/generatedClass'
import { FantasyCharacter, Item } from '@/app/tap-tap-adventure/models/types'
import {
  BrassFigure,
  BrassPlate,
  PaperButton,
  PlaybillCaption,
  PlaybillLine,
  PlaybillTitle,
  PrintingDots,
  Stamp,
  deltaTone,
} from '@/app/tap-tap-adventure/stage/Playbill'
import { ChunkyButton } from '@/components/ui/chunky-button'
import { cn } from '@/lib/utils'

/** A printed "STR +2" with the sign in the printer's ink. */
function StatBadge({ label, value }: { label: string; value: number }) {
  const sign = value > 0 ? '+' : ''
  const tone = deltaTone(value)
  return (
    <span className={cn('font-label text-xs font-bold uppercase tracking-widest tabular-nums', tone === 'green' && 'text-ps-stamp-green', tone === 'red' && 'text-ps-stamp-red')}>
      {label} {sign}
      {value}
    </span>
  )
}

function ModifierBadges({ modifiers }: { modifiers: StatModifiers }) {
  return (
    <span className="mt-1 flex flex-wrap gap-x-3 gap-y-0.5">
      <StatBadge label="STR" value={modifiers.strength} />
      <StatBadge label="INT" value={modifiers.intelligence} />
      <StatBadge label="LCK" value={modifiers.luck} />
      <StatBadge label="CHA" value={modifiers.charisma} />
    </span>
  )
}

/** The classes a chosen line takes on a bill. The hover state is the selected state, held. */
const SELECTED_LINE = 'border-ps-ink bg-ps-ink text-ps-playbill hover:bg-ps-ink-soft hover:border-ps-ink-soft'
/** Stamps on an inverted line are printed on a paper patch so they stay legible. */
const ON_INK = 'bg-ps-playbill mix-blend-normal'

function OptionCard<T extends RaceOption | ClassOption>({
  option,
  selected,
  onSelect,
}: {
  option: T
  selected: boolean
  onSelect: (option: T) => void
}) {
  return (
    <PlaybillLine
      onClick={() => onSelect(option)}
      aria-pressed={selected}
      className={cn('items-center', selected && SELECTED_LINE)}
      note={
        <>
          <span className="block">{option.description}</span>
          <ModifierBadges modifiers={option.modifiers} />
        </>
      }
      trailing={selected ? <Stamp tone="gold" tilt={false} className={ON_INK}>Chosen</Stamp> : undefined}
    >
      <span className="font-playbill text-base uppercase tracking-wide">{option.name}</span>
    </PlaybillLine>
  )
}

function GeneratedClassCard({
  generatedClass,
  selected,
  onSelect,
}: {
  generatedClass: GeneratedClass
  selected: boolean
  onSelect: (gc: GeneratedClass) => void
}) {
  const weapon = generatedClass.startingWeapon
  return (
    <PlaybillLine
      onClick={() => onSelect(generatedClass)}
      aria-pressed={selected}
      className={cn('items-start', selected && SELECTED_LINE)}
      trailing={selected ? <Stamp tone="gold" tilt={false} className={ON_INK}>Chosen</Stamp> : undefined}
      note={
        <>
          <span className="block">{generatedClass.description}</span>
          <span className="mt-1.5 flex flex-wrap gap-x-3 gap-y-0.5 font-label text-xs font-bold uppercase tracking-widest tabular-nums">
            <span>STR {generatedClass.statDistribution.strength}</span>
            <span>INT {generatedClass.statDistribution.intelligence}</span>
            <span>LCK {generatedClass.statDistribution.luck}</span>
            <span>CHA {generatedClass.statDistribution.charisma}</span>
          </span>
          <span className="mt-1 flex flex-wrap gap-x-3 gap-y-0.5 font-label text-xs font-bold uppercase tracking-widest">
            <span>{generatedClass.favoredSchool}</span>
            <span>{generatedClass.spellSlots} spell slots</span>
            <span>{generatedClass.manaMultiplier}x mana</span>
          </span>
          {weapon && (
            <span className="mt-2 block border-t border-dotted border-current/50 pt-1.5">
              <span className="font-medium">{weapon.name}</span>
              <span className="opacity-80"> · {weapon.effects.range} range</span>
              {(weapon.effects.strength || weapon.effects.intelligence) && (
                <span className="block opacity-80">
                  {weapon.effects.strength ? `+${weapon.effects.strength} STR` : ''}
                  {weapon.effects.strength && weapon.effects.intelligence ? ' · ' : ''}
                  {weapon.effects.intelligence ? `+${weapon.effects.intelligence} INT` : ''}
                </span>
              )}
            </span>
          )}
          <span className="mt-2 block border-t border-dotted border-current/50 pt-1.5">
            <span className="font-medium">{generatedClass.startingAbility.name}</span>
            <span className="block opacity-80">{generatedClass.startingAbility.description}</span>
          </span>
        </>
      }
    >
      <span className="font-playbill text-base uppercase tracking-wide">{generatedClass.name}</span>
    </PlaybillLine>
  )
}

function HeirloomCard({
  item,
  selected,
  onSelect,
}: {
  item: Item
  selected: boolean
  onSelect: (item: Item) => void
}) {
  const effects = item.effects
    ? Object.entries(item.effects)
        .filter(([, v]) => v !== undefined && v !== 0)
        .map(([k, v]) => `+${v} ${k.charAt(0).toUpperCase() + k.slice(1)}`)
        .join(', ')
    : ''
  return (
    <PlaybillLine
      onClick={() => onSelect(item)}
      aria-pressed={selected}
      className={cn('items-start', selected && SELECTED_LINE)}
      trailing={
        <>
          {item.type && (
            <Stamp tone="violet" tilt={false} className={cn(selected && ON_INK)}>
              {item.type === 'spell_scroll' ? 'Spell scroll' : item.type.charAt(0).toUpperCase() + item.type.slice(1)}
            </Stamp>
          )}
          {selected && <Stamp tone="gold" tilt={false} className={ON_INK}>Chosen</Stamp>}
        </>
      }
      note={
        <>
          <span className="block">{item.description}</span>
          {effects && <span className={cn('mt-1 block font-label text-xs font-bold uppercase tracking-widest', !selected && 'text-ps-stamp-green')}>{effects}</span>}
        </>
      }
    >
      <span className="font-playbill text-base uppercase tracking-wide">{item.name}</span>
    </PlaybillLine>
  )
}

function DifficultyModeCard({
  mode,
  selected,
  onSelect,
}: {
  mode: DifficultyMode
  selected: boolean
  onSelect: (mode: DifficultyMode) => void
}) {
  const m = mode.modifiers
  const notes = [
    m.enemyHpMultiplier !== 1 && `Enemy HP ${m.enemyHpMultiplier}x`,
    m.enemyAttackMultiplier !== 1 && `Enemy ATK ${m.enemyAttackMultiplier}x`,
    m.goldMultiplier !== 1 && `Gold ${m.goldMultiplier}x`,
    m.healRateMultiplier !== 1 && `Heal rate ${m.healRateMultiplier}x`,
    m.lootChanceMultiplier !== 1 && `Loot ${m.lootChanceMultiplier}x`,
  ].filter(Boolean) as string[]
  return (
    <PlaybillLine
      onClick={() => onSelect(mode)}
      aria-pressed={selected}
      className={cn('items-start', selected && SELECTED_LINE)}
      trailing={
        <>
          {m.permadeath && <Stamp tone="red" tilt={false} className={cn(selected && ON_INK)}>Permadeath</Stamp>}
          {selected && <Stamp tone="gold" tilt={false} className={ON_INK}>Chosen</Stamp>}
        </>
      }
      note={
        <>
          <span className="block">{mode.description}</span>
          {notes.length > 0 && (
            <span className="mt-1 flex flex-wrap gap-x-3 gap-y-0.5 font-label text-xs font-bold uppercase tracking-widest tabular-nums">
              {notes.map(n => <span key={n}>{n}</span>)}
            </span>
          )}
        </>
      }
    >
      <span className="font-playbill text-base uppercase tracking-wide">{mode.name}</span>
    </PlaybillLine>
  )
}

/** Ruled numerals across the top of the bill: done ones filled ink, the current one on brass. */
function StepIndicator({ currentStep, hasHeirlooms }: { currentStep: number; hasHeirlooms: boolean }) {
  const steps = hasHeirlooms
    ? ['Difficulty', 'Name', 'Race', 'Class', 'Heirloom']
    : ['Difficulty', 'Name', 'Race', 'Class']
  return (
    <ol className="mb-5 flex items-start justify-center gap-1 sm:gap-2" aria-label="Steps">
      {steps.map((label, i) => {
        const stepNum = i + 1
        const isActive = stepNum === currentStep
        const isCompleted = stepNum < currentStep
        return (
          <React.Fragment key={label}>
            {i > 0 && <li aria-hidden className="mt-4 h-0 w-4 flex-none border-t-2 border-dotted border-ps-ink/50 sm:w-8" />}
            <li className="flex flex-col items-center gap-1" aria-current={isActive ? 'step' : undefined}>
              <span
                className={cn(
                  'flex h-8 w-8 items-center justify-center rounded-full border-2 font-playbill text-sm leading-none',
                  isActive
                    ? 'border-ps-brass-deep bg-ps-brass text-ps-ink'
                    : isCompleted
                      ? 'border-ps-ink bg-ps-ink text-ps-playbill'
                      : 'border-ps-ink/40 text-ps-ink-soft'
                )}
              >
                {stepNum}
              </span>
              <span
                className={cn(
                  'font-label text-xs font-bold uppercase tracking-widest',
                  isActive ? 'text-ps-ink' : 'text-ps-ink-soft',
                  !isActive && 'hidden sm:block'
                )}
              >
                {label}
              </span>
            </li>
          </React.Fragment>
        )
      })}
    </ol>
  )
}

export default function CharacterCreation({
  onComplete,
}: {
  onComplete?: (character: Partial<FantasyCharacter>) => void
}) {
  const {
    character,
    selectedRace,
    selectedClass,
    selectedGeneratedClass,
    generatedClasses,
    isLoadingClasses,
    stats,
    isValid,
    updateCharacter,
    setSelectedRace,
    selectGeneratedClass,
    fetchGeneratedClasses,
    completeCreation,
    legacyHeirlooms,
    hasHeirlooms,
    selectedHeirloom,
    setSelectedHeirloom,
    selectedDifficulty,
    setSelectedDifficulty,
  } = useCharacterCreation()

  const [step, setStep] = useState(1)

  // Fetch generated classes when entering step 4 (class selection)
  useEffect(() => {
    if (step === 4 && generatedClasses.length === 0 && !isLoadingClasses) {
      fetchGeneratedClasses()
    }
  }, [step, generatedClasses.length, isLoadingClasses, fetchGeneratedClasses])

  const handleSubmit = useCallback(
    (e: React.FormEvent<HTMLFormElement>) => {
      e.preventDefault()
      completeCreation()
      onComplete?.(character)
    },
    [completeCreation, character, onComplete]
  )

  const canProceedFromName = Boolean(character.name?.trim())
  const canProceedFromRace = selectedRace !== null

  return (
    <form className="space-y-5" onSubmit={handleSubmit}>
      <StepIndicator currentStep={step} hasHeirlooms={hasHeirlooms} />

      {/* Step 1: Difficulty */}
      {step === 1 && (
        <div className="ps-print-in">
          <PlaybillTitle size="sm">Choose your difficulty</PlaybillTitle>
          <div className="mt-4 grid grid-cols-1 gap-2 sm:grid-cols-2">
            {DIFFICULTY_MODES.map(mode => (
              <DifficultyModeCard
                key={mode.id}
                mode={mode}
                selected={selectedDifficulty.id === mode.id}
                onSelect={setSelectedDifficulty}
              />
            ))}
          </div>
          <div className="mt-4 flex justify-end">
            <PaperButton type="button" onClick={() => setStep(2)} className="w-full sm:w-auto">
              Next: name your character
            </PaperButton>
          </div>
        </div>
      )}

      {/* Step 2: Name */}
      {step === 2 && (
        <div className="ps-print-in">
          <PlaybillTitle size="sm">Name your character</PlaybillTitle>
          <label htmlFor="characterName" className="mt-4 block font-label text-xs font-bold uppercase tracking-widest text-ps-ink-soft">
            Character name
          </label>
          <input
            id="characterName"
            type="text"
            className="mt-1.5 h-11 w-full rounded-[3px] border-2 border-ps-ink bg-transparent px-3 font-body text-base text-ps-ink placeholder:text-ps-ink-faint focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ds-primary"
            placeholder="E.g., Aragorn, Gandalf"
            value={character.name || ''}
            onChange={e => updateCharacter({ name: e.target.value })}
            autoFocus
          />
          <div className="mt-4 flex gap-2">
            <PaperButton type="button" variant="outline" onClick={() => setStep(1)} className="flex-1">
              Back
            </PaperButton>
            <PaperButton type="button" disabled={!canProceedFromName} onClick={() => setStep(3)} className="flex-1">
              Next: choose race
            </PaperButton>
          </div>
        </div>
      )}

      {/* Step 3: Race */}
      {step === 3 && (
        <div className="ps-print-in">
          <PlaybillTitle size="sm">Choose your race</PlaybillTitle>
          <div className="mt-4 grid grid-cols-1 gap-2 sm:grid-cols-2">
            {RACES.map(race => (
              <OptionCard
                key={race.id}
                option={race}
                selected={selectedRace?.id === race.id}
                onSelect={setSelectedRace}
              />
            ))}
          </div>
          <div className="mt-4 flex gap-2">
            <PaperButton type="button" variant="outline" onClick={() => setStep(2)} className="flex-1">
              Back
            </PaperButton>
            <PaperButton type="button" disabled={!canProceedFromRace} onClick={() => setStep(4)} className="flex-1">
              Next: choose class
            </PaperButton>
          </div>
        </div>
      )}

      {/* Step 4: Class (Generated) */}
      {step === 4 && (
        <div className="ps-print-in">
          <PlaybillTitle size="sm">Choose your class</PlaybillTitle>
          <div className="mt-3 flex items-center justify-between gap-3">
            <PlaybillCaption>Four classes, printed fresh for this character</PlaybillCaption>
            <PaperButton
              type="button"
              variant="outline"
              size="sm"
              onClick={fetchGeneratedClasses}
              disabled={isLoadingClasses}
            >
              {isLoadingClasses ? 'Printing…' : 'Reroll classes'}
            </PaperButton>
          </div>

          {isLoadingClasses ? (
            <div className="flex items-center justify-center py-12">
              <PrintingDots label="Printing classes" />
            </div>
          ) : generatedClasses.length === 0 ? (
            <div className="mt-3 rounded-[3px] border-2 border-dashed border-ps-ink/40 px-4 py-8 text-center">
              <p className="font-body text-sm text-ps-ink">The classes didn&rsquo;t print.</p>
              <p className="mt-1 font-body text-xs text-ps-ink-soft">Check your connection and try again.</p>
              <PaperButton type="button" variant="outline" size="sm" className="mt-3" onClick={fetchGeneratedClasses}>
                Try again
              </PaperButton>
            </div>
          ) : (
            <div className="mt-3 grid grid-cols-1 gap-2 sm:grid-cols-2">
              {generatedClasses.map(gc => (
                <GeneratedClassCard
                  key={gc.id}
                  generatedClass={gc}
                  selected={selectedGeneratedClass?.id === gc.id}
                  onSelect={selectGeneratedClass}
                />
              ))}
            </div>
          )}

          {/* Stat Preview */}
          <div className="mt-4">
            <PlaybillCaption className="mb-1.5 text-center">Your figures</PlaybillCaption>
            <BrassPlate className="grid grid-cols-3 divide-x-2 divide-ps-brass-deep/60" aria-label="Stat preview">
              <BrassFigure label="Strength" value={stats.strength} />
              <BrassFigure label="Intelligence" value={stats.intelligence} />
              <BrassFigure label="Luck" value={stats.luck} />
            </BrassPlate>
            {selectedRace && selectedGeneratedClass && (
              <p className="mt-1.5 text-center font-body text-xs text-ps-ink-soft">
                {selectedGeneratedClass.name} base + {selectedRace.name} racial bonuses
              </p>
            )}
          </div>

          <div className="mt-4 flex gap-2">
            <PaperButton type="button" variant="outline" onClick={() => setStep(3)} className="flex-1">
              Back
            </PaperButton>
            {hasHeirlooms ? (
              <PaperButton type="button" disabled={!isValid} onClick={() => setStep(5)} className="flex-1">
                Next: choose heirloom
              </PaperButton>
            ) : (
              <ChunkyButton type="submit" variant="primary" disabled={!isValid} className="flex-1">
                Begin
              </ChunkyButton>
            )}
          </div>
        </div>
      )}

      {/* Step 5: Heirloom Selection */}
      {step === 5 && hasHeirlooms && (
        <div className="ps-print-in">
          <PlaybillTitle size="sm">Choose an heirloom</PlaybillTitle>
          <p className="mt-3 font-body text-sm leading-snug text-ps-ink-soft">
            Previous characters left behind these items. Pick one to start your journey with, or skip to begin without one.
          </p>
          <div className="mt-3 grid grid-cols-1 gap-2 sm:grid-cols-2">
            {legacyHeirlooms.map((item: Item) => (
              <HeirloomCard
                key={item.id}
                item={item}
                selected={selectedHeirloom?.id === item.id}
                onSelect={(heirloom) => {
                  setSelectedHeirloom(selectedHeirloom?.id === heirloom.id ? null : heirloom)
                }}
              />
            ))}
          </div>
          <div className="mt-4 flex gap-2">
            <PaperButton type="button" variant="outline" onClick={() => setStep(4)} className="flex-1">
              Back
            </PaperButton>
            <ChunkyButton type="submit" variant="primary" disabled={!isValid} className="flex-1">
              {selectedHeirloom ? 'Begin with heirloom' : 'Begin without heirloom'}
            </ChunkyButton>
          </div>
        </div>
      )}
    </form>
  )
}
