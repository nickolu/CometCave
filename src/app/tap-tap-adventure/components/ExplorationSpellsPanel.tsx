'use client'
import { useState, useCallback } from 'react'

import { Button } from '@/app/tap-tap-adventure/components/ui/button'
import { useGameStore } from '@/app/tap-tap-adventure/hooks/useGameStore'
import { Spell } from '@/app/tap-tap-adventure/models/spell'

export function ExplorationSpellsPanel() {
  const character = useGameStore(s => s.gameState.characters.find(c => c.id === s.gameState.selectedCharacterId))
  const { castExplorationSpell } = useGameStore()
  const [feedbackMessage, setFeedbackMessage] = useState<string | null>(null)
  const [feedbackSuccess, setFeedbackSuccess] = useState(true)

  const spellbook = character?.spellbook ?? []
  const explorationSpells = spellbook.filter(s => s.explorationEffect)
  const currentMana = character?.mana ?? 0

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
        <span className="text-xs text-blue-300">{currentMana} MP available</span>
      </div>
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
              {canCast ? `Cast ${effect.type === 'heal' ? '❤️' : effect.type === 'mana_restore' ? '💎' : '⚡'} ${effect.type.replace('_', ' ')}` : 'Not enough mana'}
            </Button>
          </div>
        )
      })}
    </div>
  )
}
