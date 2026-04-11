'use client'

import { useState } from 'react'
import { SKILLS } from '@/app/tap-tap-adventure/config/skills'
import { SkillCategory } from '@/app/tap-tap-adventure/models/skill'

const CATEGORY_LABELS: Record<SkillCategory, string> = {
  combat: 'Combat',
  survival: 'Survival',
  utility: 'Utility',
  exploration: 'Exploration',
}

const CATEGORY_ORDER: SkillCategory[] = ['combat', 'survival', 'utility', 'exploration']

function getRequirementText(requirement: { type: string; value: string | number }): string {
  switch (requirement.type) {
    case 'achievement':
      return `Requires achievement: ${requirement.value}`
    case 'level':
      return `Reach level ${requirement.value}`
    case 'distance':
      return `Walk ${requirement.value} steps`
    case 'combats_won':
      return `Win ${requirement.value} combats`
    default:
      return 'Unknown requirement'
  }
}

export function SkillPanel({ unlockedSkillIds }: { unlockedSkillIds: string[] }) {
  const [isExpanded, setIsExpanded] = useState(false)
  const unlockedSet = new Set(unlockedSkillIds)

  const unlockedCount = unlockedSkillIds.length
  const totalCount = SKILLS.length

  if (!isExpanded) {
    return (
      <button
        className="w-full bg-[#1e1f30] border border-[#3a3c56] rounded-lg p-3 text-left hover:border-cyan-700/50 transition-colors"
        onClick={() => setIsExpanded(true)}
      >
        <div className="flex justify-between items-center">
          <span className="text-sm font-bold text-cyan-400">Passive Skills</span>
          <span className="text-xs text-slate-400">
            {unlockedCount}/{totalCount}
          </span>
        </div>
        <div className="h-1.5 bg-slate-700 rounded-full overflow-hidden mt-2">
          <div
            className="h-full bg-cyan-500 rounded-full transition-all duration-300"
            style={{ width: `${totalCount > 0 ? (unlockedCount / totalCount) * 100 : 0}%` }}
          />
        </div>
      </button>
    )
  }

  return (
    <div className="bg-[#1e1f30] border border-[#3a3c56] rounded-lg p-3 space-y-3">
      <div className="flex justify-between items-center">
        <button
          className="text-sm font-bold text-cyan-400 hover:text-cyan-300 transition-colors"
          onClick={() => setIsExpanded(false)}
        >
          Passive Skills
        </button>
        <span className="text-xs text-slate-400">
          {unlockedCount}/{totalCount}
        </span>
      </div>
      {CATEGORY_ORDER.map(category => {
        const categorySkills = SKILLS.filter(s => s.category === category)
        if (categorySkills.length === 0) return null

        return (
          <div key={category} className="space-y-1.5">
            <h4 className="text-[10px] uppercase tracking-wider text-slate-500 font-semibold">
              {CATEGORY_LABELS[category]}
            </h4>
            {categorySkills.map(skill => {
              const unlocked = unlockedSet.has(skill.id)

              return (
                <div
                  key={skill.id}
                  className={`rounded p-2 text-xs ${
                    unlocked
                      ? 'bg-cyan-950/30 border border-cyan-700/30'
                      : 'bg-[#161723] border border-[#2a2b3f] opacity-50'
                  }`}
                >
                  <div className="flex items-center gap-2">
                    <span className={`text-base ${unlocked ? '' : 'grayscale'}`}>{skill.icon}</span>
                    <div className="flex-1 min-w-0">
                      <div className="flex justify-between items-center">
                        <span className={`font-semibold truncate ${unlocked ? 'text-cyan-400' : 'text-slate-500'}`}>
                          {unlocked && <span className="mr-1">&#10003;</span>}
                          {skill.name}
                        </span>
                      </div>
                      <p className={`text-[10px] truncate ${unlocked ? 'text-slate-300' : 'text-slate-500'}`}>
                        {unlocked ? skill.description : getRequirementText(skill.requirement)}
                      </p>
                    </div>
                  </div>
                </div>
              )
            })}
          </div>
        )
      })}
    </div>
  )
}
