'use client'
import React, { useCallback, useState } from 'react'

import {
  ClassOption,
  CLASSES,
  RaceOption,
  RACES,
  StatModifiers,
} from '@/app/tap-tap-adventure/config/characterOptions'
import { useCharacterCreation } from '@/app/tap-tap-adventure/hooks/useCharacterCreation'
import { FantasyCharacter } from '@/app/tap-tap-adventure/models/types'

function StatBadge({ label, value }: { label: string; value: number }) {
  const sign = value > 0 ? '+' : ''
  return (
    <span className="text-xs text-slate-400">
      {label} {sign}
      {value}
    </span>
  )
}

function ModifierBadges({ modifiers }: { modifiers: StatModifiers }) {
  return (
    <div className="flex gap-2 mt-2">
      <StatBadge label="STR" value={modifiers.strength} />
      <StatBadge label="INT" value={modifiers.intelligence} />
      <StatBadge label="LCK" value={modifiers.luck} />
    </div>
  )
}

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
    <button
      type="button"
      onClick={() => onSelect(option)}
      className={`text-left p-4 rounded-lg border transition-all cursor-pointer focus:outline-none ${
        selected
          ? 'border-indigo-500 bg-indigo-500/10 ring-1 ring-indigo-500'
          : 'border-[#3a3c56] bg-[#2a2b3f] hover:border-[#5a5c76]'
      }`}
    >
      <div className="text-slate-200 font-semibold text-sm">{option.name}</div>
      <div className="text-xs text-slate-400 mt-1">{option.description}</div>
      <ModifierBadges modifiers={option.modifiers} />
    </button>
  )
}

function StepIndicator({ currentStep }: { currentStep: number }) {
  const steps = ['Name', 'Race', 'Class']
  return (
    <div className="flex items-center justify-center gap-2 mb-6">
      {steps.map((label, i) => {
        const stepNum = i + 1
        const isActive = stepNum === currentStep
        const isCompleted = stepNum < currentStep
        return (
          <React.Fragment key={label}>
            {i > 0 && <div className="w-8 h-px bg-[#3a3c56]" />}
            <div className="flex items-center gap-1.5">
              <div
                className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-semibold ${
                  isActive
                    ? 'bg-indigo-500 text-white'
                    : isCompleted
                      ? 'bg-indigo-500/30 text-indigo-300'
                      : 'bg-[#2a2b3f] text-slate-500 border border-[#3a3c56]'
                }`}
              >
                {stepNum}
              </div>
              <span
                className={`text-xs ${isActive ? 'text-slate-200' : isCompleted ? 'text-indigo-300' : 'text-slate-500'}`}
              >
                {label}
              </span>
            </div>
          </React.Fragment>
        )
      })}
    </div>
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
    stats,
    isValid,
    updateCharacter,
    setSelectedRace,
    setSelectedClass,
    completeCreation,
  } = useCharacterCreation()

  const [step, setStep] = useState(1)

  const handleSubmit = useCallback(
    (e: React.FormEvent<HTMLFormElement>) => {
      e.preventDefault()
      completeCreation()
      onComplete?.(character)
    },
    [completeCreation, character, onComplete]
  )

  const canProceedFromStep1 = Boolean(character.name?.trim())
  const canProceedFromStep2 = selectedRace !== null

  return (
    <form className="space-y-6 p-1" onSubmit={handleSubmit}>
      <StepIndicator currentStep={step} />

      {/* Step 1: Name */}
      {step === 1 && (
        <div>
          <label htmlFor="characterName" className="block text-sm font-medium text-slate-300 mb-1">
            Character Name
          </label>
          <input
            id="characterName"
            type="text"
            className="w-full p-3 bg-slate-800/60 border border-[#3a3c56] rounded-md text-slate-200 placeholder-slate-500 focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none transition-colors shadow-sm"
            placeholder="E.g., Aragorn, Gandalf"
            value={character.name || ''}
            onChange={e => updateCharacter({ name: e.target.value })}
            autoFocus
          />
          <button
            type="button"
            disabled={!canProceedFromStep1}
            onClick={() => setStep(2)}
            className="w-full mt-4 bg-indigo-600 hover:bg-indigo-700 disabled:bg-slate-700 disabled:text-slate-500 text-white font-semibold px-4 py-3 rounded-md transition-colors focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2 focus:ring-offset-[#161723] shadow-md"
          >
            Next: Choose Race
          </button>
        </div>
      )}

      {/* Step 2: Race */}
      {step === 2 && (
        <div>
          <label className="block text-sm font-medium text-slate-300 mb-3">Choose Your Race</label>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {RACES.map(race => (
              <OptionCard
                key={race.id}
                option={race}
                selected={selectedRace?.id === race.id}
                onSelect={setSelectedRace}
              />
            ))}
          </div>
          <div className="flex gap-3 mt-4">
            <button
              type="button"
              onClick={() => setStep(1)}
              className="flex-1 bg-[#2a2b3f] hover:bg-[#3a3c56] text-slate-300 font-semibold px-4 py-3 rounded-md transition-colors focus:outline-none border border-[#3a3c56]"
            >
              Back
            </button>
            <button
              type="button"
              disabled={!canProceedFromStep2}
              onClick={() => setStep(3)}
              className="flex-1 bg-indigo-600 hover:bg-indigo-700 disabled:bg-slate-700 disabled:text-slate-500 text-white font-semibold px-4 py-3 rounded-md transition-colors focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2 focus:ring-offset-[#161723] shadow-md"
            >
              Next: Choose Class
            </button>
          </div>
        </div>
      )}

      {/* Step 3: Class */}
      {step === 3 && (
        <div>
          <label className="block text-sm font-medium text-slate-300 mb-3">Choose Your Class</label>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {CLASSES.map(cls => (
              <OptionCard
                key={cls.id}
                option={cls}
                selected={selectedClass?.id === cls.id}
                onSelect={setSelectedClass}
              />
            ))}
          </div>

          {/* Stat Preview */}
          <div className="mt-4 p-4 bg-[#1e1f33] border border-[#3a3c56] rounded-lg">
            <div className="text-sm font-medium text-slate-300 mb-2">Stat Preview</div>
            <div className="grid grid-cols-3 gap-4 text-center">
              <div>
                <div className="text-xs text-slate-500 uppercase">Strength</div>
                <div className="text-lg font-bold text-amber-400">{stats.strength}</div>
              </div>
              <div>
                <div className="text-xs text-slate-500 uppercase">Intelligence</div>
                <div className="text-lg font-bold text-sky-400">{stats.intelligence}</div>
              </div>
              <div>
                <div className="text-xs text-slate-500 uppercase">Luck</div>
                <div className="text-lg font-bold text-emerald-400">{stats.luck}</div>
              </div>
            </div>
            {selectedRace && selectedClass && (
              <div className="text-xs text-slate-500 mt-2 text-center">
                Base (5) + {selectedRace.name} bonuses + {selectedClass.name} bonuses
              </div>
            )}
          </div>

          <div className="flex gap-3 mt-4">
            <button
              type="button"
              onClick={() => setStep(2)}
              className="flex-1 bg-[#2a2b3f] hover:bg-[#3a3c56] text-slate-300 font-semibold px-4 py-3 rounded-md transition-colors focus:outline-none border border-[#3a3c56]"
            >
              Back
            </button>
            <button
              type="submit"
              disabled={!isValid}
              className="flex-1 bg-indigo-600 hover:bg-indigo-700 disabled:bg-slate-700 disabled:text-slate-500 text-white font-semibold px-4 py-3 rounded-md transition-colors focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2 focus:ring-offset-[#161723] shadow-md"
            >
              Create Character
            </button>
          </div>
        </div>
      )}
    </form>
  )
}
