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
      <StatBadge label="CHA" value={modifiers.charisma} />
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

function GeneratedClassCard({
  generatedClass,
  selected,
  onSelect,
}: {
  generatedClass: GeneratedClass
  selected: boolean
  onSelect: (gc: GeneratedClass) => void
}) {
  return (
    <button
      type="button"
      onClick={() => onSelect(generatedClass)}
      className={`text-left p-4 rounded-lg border transition-all cursor-pointer focus:outline-none ${
        selected
          ? 'border-indigo-500 bg-indigo-500/10 ring-1 ring-indigo-500'
          : 'border-[#3a3c56] bg-[#2a2b3f] hover:border-[#5a5c76]'
      }`}
    >
      <div className="text-slate-200 font-semibold text-sm">{generatedClass.name}</div>
      <div className="text-xs text-slate-400 mt-1">{generatedClass.description}</div>
      <div className="flex gap-2 mt-2">
        <span className="text-xs text-amber-400">STR {generatedClass.statDistribution.strength}</span>
        <span className="text-xs text-sky-400">INT {generatedClass.statDistribution.intelligence}</span>
        <span className="text-xs text-emerald-400">LCK {generatedClass.statDistribution.luck}</span>
        <span className="text-xs text-pink-400">CHA {generatedClass.statDistribution.charisma}</span>
      </div>
      <div className="flex gap-2 mt-1 flex-wrap">
        <span className="text-xs text-purple-400">{generatedClass.favoredSchool}</span>
        <span className="text-xs text-slate-500">{generatedClass.spellSlots} spell slots</span>
        <span className="text-xs text-slate-500">{generatedClass.manaMultiplier}x mana</span>
      </div>
      <div className="mt-2 pt-2 border-t border-[#3a3c56]">
        <div className="text-xs text-indigo-300 font-medium">{generatedClass.startingAbility.name}</div>
        <div className="text-xs text-slate-500 mt-0.5">{generatedClass.startingAbility.description}</div>
      </div>
    </button>
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
  return (
    <button
      type="button"
      onClick={() => onSelect(item)}
      className={`text-left p-4 rounded-lg border transition-all cursor-pointer focus:outline-none ${
        selected
          ? 'border-amber-500 bg-amber-500/10 ring-1 ring-amber-500'
          : 'border-amber-700/40 bg-[#2a2b3f] hover:border-amber-600/60'
      }`}
    >
      <div className="flex items-center gap-2">
        <span className="text-amber-400 text-sm">&#9733;</span>
        <span className="text-slate-200 font-semibold text-sm">{item.name}</span>
        {item.type && (
          <span className="text-[10px] px-1.5 py-0.5 bg-amber-900/50 text-amber-300 rounded">
            {item.type === 'spell_scroll' ? 'Spell Scroll' : item.type.charAt(0).toUpperCase() + item.type.slice(1)}
          </span>
        )}
      </div>
      <div className="text-xs text-slate-400 mt-1">{item.description}</div>
      {item.effects && (
        <div className="text-xs text-emerald-400 mt-1">
          {Object.entries(item.effects)
            .filter(([, v]) => v !== undefined && v !== 0)
            .map(([k, v]) => `+${v} ${k.charAt(0).toUpperCase() + k.slice(1)}`)
            .join(', ')}
        </div>
      )}
    </button>
  )
}

const DIFFICULTY_COLORS: Record<string, string> = {
  normal: 'border-indigo-500 bg-indigo-500/10 ring-indigo-500',
  hard: 'border-red-500 bg-red-500/10 ring-red-500',
  ironman: 'border-orange-500 bg-orange-500/10 ring-orange-500',
  casual: 'border-green-500 bg-green-500/10 ring-green-500',
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
  const selectedColors = DIFFICULTY_COLORS[mode.id] ?? 'border-indigo-500 bg-indigo-500/10 ring-indigo-500'
  return (
    <button
      type="button"
      onClick={() => onSelect(mode)}
      className={`text-left p-4 rounded-lg border transition-all cursor-pointer focus:outline-none ${
        selected
          ? `${selectedColors} ring-1`
          : 'border-[#3a3c56] bg-[#2a2b3f] hover:border-[#5a5c76]'
      }`}
    >
      <div className="flex items-center gap-2">
        <span className="text-lg">{mode.icon}</span>
        <span className="text-slate-200 font-semibold text-sm">{mode.name}</span>
      </div>
      <div className="text-xs text-slate-400 mt-1">{mode.description}</div>
      <div className="flex flex-wrap gap-x-3 gap-y-1 mt-2 text-[10px] text-slate-500">
        {mode.modifiers.enemyHpMultiplier !== 1 && (
          <span>Enemy HP {mode.modifiers.enemyHpMultiplier}x</span>
        )}
        {mode.modifiers.enemyAttackMultiplier !== 1 && (
          <span>Enemy ATK {mode.modifiers.enemyAttackMultiplier}x</span>
        )}
        {mode.modifiers.goldMultiplier !== 1 && (
          <span>Gold {mode.modifiers.goldMultiplier}x</span>
        )}
        {mode.modifiers.healRateMultiplier !== 1 && (
          <span>Heal Rate {mode.modifiers.healRateMultiplier}x</span>
        )}
        {mode.modifiers.lootChanceMultiplier !== 1 && (
          <span>Loot {mode.modifiers.lootChanceMultiplier}x</span>
        )}
        {mode.modifiers.permadeath && (
          <span className="text-red-400">Permadeath</span>
        )}
      </div>
    </button>
  )
}

function StepIndicator({ currentStep, hasHeirlooms }: { currentStep: number; hasHeirlooms: boolean }) {
  const steps = hasHeirlooms
    ? ['Difficulty', 'Name', 'Race', 'Class', 'Heirloom']
    : ['Difficulty', 'Name', 'Race', 'Class']
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
    <form className="space-y-6 p-1" onSubmit={handleSubmit}>
      <StepIndicator currentStep={step} hasHeirlooms={hasHeirlooms} />

      {/* Step 1: Difficulty */}
      {step === 1 && (
        <div>
          <label className="block text-sm font-medium text-slate-300 mb-3">Choose Your Difficulty</label>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {DIFFICULTY_MODES.map(mode => (
              <DifficultyModeCard
                key={mode.id}
                mode={mode}
                selected={selectedDifficulty.id === mode.id}
                onSelect={setSelectedDifficulty}
              />
            ))}
          </div>
          <button
            type="button"
            onClick={() => setStep(2)}
            className="w-full mt-4 bg-indigo-600 hover:bg-indigo-700 text-white font-semibold px-4 py-3 rounded-md transition-colors focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2 focus:ring-offset-[#161723] shadow-md"
          >
            Next: Name Your Character
          </button>
        </div>
      )}

      {/* Step 2: Name */}
      {step === 2 && (
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
              disabled={!canProceedFromName}
              onClick={() => setStep(3)}
              className="flex-1 bg-indigo-600 hover:bg-indigo-700 disabled:bg-slate-700 disabled:text-slate-500 text-white font-semibold px-4 py-3 rounded-md transition-colors focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2 focus:ring-offset-[#161723] shadow-md"
            >
              Next: Choose Race
            </button>
          </div>
        </div>
      )}

      {/* Step 3: Race */}
      {step === 3 && (
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
              onClick={() => setStep(2)}
              className="flex-1 bg-[#2a2b3f] hover:bg-[#3a3c56] text-slate-300 font-semibold px-4 py-3 rounded-md transition-colors focus:outline-none border border-[#3a3c56]"
            >
              Back
            </button>
            <button
              type="button"
              disabled={!canProceedFromRace}
              onClick={() => setStep(4)}
              className="flex-1 bg-indigo-600 hover:bg-indigo-700 disabled:bg-slate-700 disabled:text-slate-500 text-white font-semibold px-4 py-3 rounded-md transition-colors focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2 focus:ring-offset-[#161723] shadow-md"
            >
              Next: Choose Class
            </button>
          </div>
        </div>
      )}

      {/* Step 4: Class (Generated) */}
      {step === 4 && (
        <div>
          <div className="flex items-center justify-between mb-3">
            <label className="block text-sm font-medium text-slate-300">Choose Your Class</label>
            <button
              type="button"
              onClick={fetchGeneratedClasses}
              disabled={isLoadingClasses}
              className="text-xs text-indigo-400 hover:text-indigo-300 disabled:text-slate-500 transition-colors focus:outline-none"
            >
              {isLoadingClasses ? 'Generating...' : 'Reroll Classes'}
            </button>
          </div>

          {isLoadingClasses ? (
            <div className="flex items-center justify-center py-12">
              <div className="text-slate-400 text-sm">Generating unique classes...</div>
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
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
            {selectedRace && selectedGeneratedClass && (
              <div className="text-xs text-slate-500 mt-2 text-center">
                {selectedGeneratedClass.name} base + {selectedRace.name} racial bonuses
              </div>
            )}
          </div>

          <div className="flex gap-3 mt-4">
            <button
              type="button"
              onClick={() => setStep(3)}
              className="flex-1 bg-[#2a2b3f] hover:bg-[#3a3c56] text-slate-300 font-semibold px-4 py-3 rounded-md transition-colors focus:outline-none border border-[#3a3c56]"
            >
              Back
            </button>
            {hasHeirlooms ? (
              <button
                type="button"
                disabled={!isValid}
                onClick={() => setStep(5)}
                className="flex-1 bg-indigo-600 hover:bg-indigo-700 disabled:bg-slate-700 disabled:text-slate-500 text-white font-semibold px-4 py-3 rounded-md transition-colors focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2 focus:ring-offset-[#161723] shadow-md"
              >
                Next: Choose Heirloom
              </button>
            ) : (
              <button
                type="submit"
                disabled={!isValid}
                className="flex-1 bg-indigo-600 hover:bg-indigo-700 disabled:bg-slate-700 disabled:text-slate-500 text-white font-semibold px-4 py-3 rounded-md transition-colors focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2 focus:ring-offset-[#161723] shadow-md"
              >
                Create Character
              </button>
            )}
          </div>
        </div>
      )}

      {/* Step 5: Heirloom Selection */}
      {step === 5 && hasHeirlooms && (
        <div>
          <label className="block text-sm font-medium text-slate-300 mb-3">Choose an Heirloom (Optional)</label>
          <p className="text-xs text-slate-400 mb-4">
            Previous characters left behind these items. Pick one to start your journey with, or skip to begin without one.
          </p>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
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
          <div className="flex gap-3 mt-4">
            <button
              type="button"
              onClick={() => setStep(4)}
              className="flex-1 bg-[#2a2b3f] hover:bg-[#3a3c56] text-slate-300 font-semibold px-4 py-3 rounded-md transition-colors focus:outline-none border border-[#3a3c56]"
            >
              Back
            </button>
            <button
              type="submit"
              disabled={!isValid}
              className="flex-1 bg-indigo-600 hover:bg-indigo-700 disabled:bg-slate-700 disabled:text-slate-500 text-white font-semibold px-4 py-3 rounded-md transition-colors focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2 focus:ring-offset-[#161723] shadow-md"
            >
              {selectedHeirloom ? 'Create with Heirloom' : 'Create without Heirloom'}
            </button>
          </div>
        </div>
      )}
    </form>
  )
}
