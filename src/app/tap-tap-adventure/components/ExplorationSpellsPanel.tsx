'use client'
import { useState, useCallback } from 'react'

import { Button } from '@/app/tap-tap-adventure/components/ui/button'
import { useGameStore } from '@/app/tap-tap-adventure/hooks/useGameStore'
import { Spell, ExplorationEffectType } from '@/app/tap-tap-adventure/models/spell'

const EFFECT_ICONS: Record<ExplorationEffectType, string> = {
  heal: '❤️',
  mana_restore: '💎',
  speed_boost: '⚡',
  shield: '🛡️',
  reveal: '🔮',
  cha_boost: '🗣️',
  faster_travel: '🕊️',
  auto_stealth: '👁️',
  animal_affinity: '🐾',
  disguise: '🎭',
  instant_travel: '✨',
  loot_bonus: '🎁',
  scouting: '🧿',
  bypass_guards: '🚪',
  see_weaknesses: '⚔️',
  price_reduction: '💰',
}

export function ExplorationSpellsPanel() {
  const character = useGameStore(s => s.gameState.characters.find(c => c.id === s.gameState.selectedCharacterId))
  const { castExplorationSpell } = useGameStore()
  const [feedbackMessage, setFeedbackMessage] = useState<string | null>(null)
  const [feedbackSuccess, setFeedbackSuccess] = useState(true)
  const [schoolFilter, setSchoolFilter] = useState<string>('all')
  const [sortByMana, setSortByMana] = useState(false)

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
      setTimeout(() => setFeedbackMessage(null), 3000)
    }
  }, [castExplorationSpell])

  if (explorationSpells.length === 0) {
    return (
      <div className="text-sm text-slate-500 italic p-2">
        No exploration spells available. Some spells can be cast outside combat — look for spells with exploration effects.
      </div>
    )
  }

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between mb-1">
        <h4 className="text-sm font-semibold text-white">Exploration Spells</h4>
        <div className="flex items-center gap-2">
          {(character?.explorationShield ?? 0) > 0 && (
            <span className="text-xs text-cyan-300">🛡️ {character!.explorationShield} shield</span>
          )}
          <span className="text-xs text-blue-300">{currentMana} MP available</span>
        </div>
      </div>
      <div className="flex flex-wrap gap-1 items-center">
        {['all', 'arcane', 'nature', 'shadow', 'war'].map(school => (
          <button
            key={school}
            onClick={() => setSchoolFilter(school)}
            className={`text-[10px] px-1.5 py-0.5 rounded capitalize transition-colors ${
              schoolFilter === school
                ? 'bg-indigo-700/50 text-indigo-200'
                : 'bg-slate-700/40 text-slate-400 hover:bg-slate-600/40'
            }`}
          >
            {school}
          </button>
        ))}
        <button
          onClick={() => setSortByMana(!sortByMana)}
          className={`text-[10px] px-1.5 py-0.5 rounded ml-auto transition-colors ${
            sortByMana
              ? 'bg-blue-700/50 text-blue-200'
              : 'bg-slate-700/40 text-slate-400 hover:bg-slate-600/40'
          }`}
        >
          {sortByMana ? 'MP ↑' : 'Sort: MP'}
        </button>
      </div>
      {activeSpells.length > 0 && (
        <div className="bg-[#14152a] border border-violet-700/40 rounded-lg p-2 space-y-1">
          <h5 className="text-xs font-semibold text-violet-300 mb-1">Active Effects</h5>
          {activeSpells.map(s => (
            <div key={s.spellId} className="flex items-center justify-between text-xs">
              <span className="text-slate-200">
                {EFFECT_ICONS[s.effectType]} {s.spellName}
              </span>
              <span className="text-violet-400">{s.stepsRemaining} steps</span>
            </div>
          ))}
        </div>
      )}
      {feedbackMessage && (
        <div className={`p-2 rounded-md text-sm animate-pulse ${feedbackSuccess ? 'bg-green-900/50 border border-green-700 text-green-300' : 'bg-red-900/50 border border-red-700 text-red-300'}`}>
          {feedbackMessage}
        </div>
      )}
      {explorationSpells.map((spell: Spell) => {
        const manaCost = spell.explorationManaCost ?? spell.manaCost
        const canCast = currentMana >= manaCost
        const effect = spell.explorationEffect!
        return (
          <div
            key={spell.id}
            className="bg-[#1e1f30] border border-[#3a3c56] p-3 rounded-lg"
          >
            <div className="flex items-center justify-between mb-1">
              <span className="font-bold text-sm text-white">{spell.name}</span>
              <span className={`text-xs ${canCast ? 'text-blue-300' : 'text-red-400'}`}>
                {manaCost} MP
              </span>
            </div>
            <p className="text-xs text-violet-400 capitalize mb-1">{spell.school}</p>
            <p className="text-xs text-slate-400 mb-2">{effect.description}</p>
            <Button
              className={`w-full text-sm py-2 rounded-md transition-colors ${
                canCast
                  ? 'bg-violet-700 hover:bg-violet-800 text-white'
                  : 'bg-[#2a2b3f] text-slate-500 cursor-not-allowed'
              }`}
              onClick={() => canCast && handleCast(spell.id)}
              disabled={!canCast}
            >
              {canCast ? `Cast ${EFFECT_ICONS[effect.type]} ${effect.type.replace(/_/g, ' ')}` : 'Not enough mana'}
            </Button>
          </div>
        )
      })}
    </div>
  )
}
