'use client'

import { useState } from 'react'
import { SKILLS } from '@/app/tap-tap-adventure/config/skills'
import { ClassSkillTree, SkillTreeNode } from '@/app/tap-tap-adventure/models/classSkillTree'
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
      return `Travel ${requirement.value} km`
    case 'combats_won':
      return `Win ${requirement.value} combats`
    default:
      return 'Unknown requirement'
  }
}

function getTreeNodeLockReason(
  node: SkillTreeNode,
  characterLevel: number,
  unlockedSet: Set<string>,
  allNodes: SkillTreeNode[]
): string {
  if (characterLevel < node.requiredLevel) {
    return `Level ${node.requiredLevel} required`
  }
  // Level OK but missing prerequisite
  const missingPrereq = node.prerequisiteIds.find(id => !unlockedSet.has(id))
  if (missingPrereq) {
    const prereqNode = allNodes.find(n => n.id === missingPrereq)
    return `Requires: ${prereqNode?.name ?? missingPrereq}`
  }
  return 'Locked'
}

interface SkillPanelProps {
  unlockedSkillIds: string[]
  classSkillTree?: ClassSkillTree
  unlockedTreeSkillIds?: string[]
  characterLevel?: number
}

export function SkillPanel({
  unlockedSkillIds,
  classSkillTree,
  unlockedTreeSkillIds = [],
  characterLevel = 1,
}: SkillPanelProps) {
  const [isExpanded, setIsExpanded] = useState(false)
  const unlockedSet = new Set(unlockedSkillIds)
  const unlockedTreeSet = new Set(unlockedTreeSkillIds)

  const unlockedCount = unlockedSkillIds.length
  const totalCount = SKILLS.length

  const treeUnlockedCount = unlockedTreeSkillIds.length
  const treeTotal = classSkillTree?.nodes.length ?? 0

  if (!isExpanded) {
    return (
      <button
        className="w-full bg-[#1e1f30] border border-[#3a3c56] rounded-lg p-3 text-left hover:border-cyan-700/50 transition-colors"
        onClick={() => setIsExpanded(true)}
      >
        <div className="flex justify-between items-center">
          <span className="text-sm font-bold text-cyan-400">Passive Skills</span>
          <div className="flex items-center gap-2">
            {classSkillTree && (
              <span className="text-xs text-purple-400">
                {treeUnlockedCount}/{treeTotal} class
              </span>
            )}
            <span className="text-xs text-slate-400">
              {unlockedCount}/{totalCount}
            </span>
          </div>
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

  const TIER_LABELS: Record<number, string> = {
    1: 'Tier 1',
    2: 'Tier 2',
    3: 'Tier 3',
    4: 'Tier 4 — Capstone',
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
        <div className="flex items-center gap-2">
          {classSkillTree && (
            <span className="text-xs text-purple-400">
              {treeUnlockedCount}/{treeTotal} class
            </span>
          )}
          <span className="text-xs text-slate-400">
            {unlockedCount}/{totalCount}
          </span>
        </div>
      </div>

      {/* Global passive skills */}
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

      {/* Class skill tree */}
      {classSkillTree && (
        <div className="space-y-2 pt-1 border-t border-[#2a2b3f]">
          <h4 className="text-[10px] uppercase tracking-wider text-purple-400 font-semibold">
            Class Skills — {classSkillTree.className}
          </h4>
          {([1, 2, 3, 4] as const).map(tier => {
            const tierNodes = classSkillTree.nodes.filter(n => n.tier === tier)
            if (tierNodes.length === 0) return null

            return (
              <div key={tier} className="space-y-1">
                <span className="text-[9px] uppercase tracking-wider text-slate-600 font-semibold">
                  {TIER_LABELS[tier]}
                </span>
                <div className="flex flex-wrap gap-1.5">
                  {tierNodes.map(node => {
                    const unlocked = unlockedTreeSet.has(node.id)
                    const lockReason = !unlocked
                      ? getTreeNodeLockReason(node, characterLevel, unlockedTreeSet, classSkillTree.nodes)
                      : null

                    return (
                      <div
                        key={node.id}
                        className={`flex-1 min-w-[120px] rounded p-2 text-xs ${
                          unlocked
                            ? 'bg-purple-950/30 border border-purple-700/30'
                            : 'bg-[#161723] border border-[#2a2b3f] opacity-50'
                        }`}
                      >
                        <div className="flex items-center gap-1.5">
                          <span className={`text-base ${unlocked ? '' : 'grayscale'}`}>{node.icon}</span>
                          <div className="flex-1 min-w-0">
                            <span className={`font-semibold block truncate ${unlocked ? 'text-purple-300' : 'text-slate-500'}`}>
                              {unlocked && <span className="mr-1">&#10003;</span>}
                              {node.name}
                            </span>
                            <p className={`text-[10px] ${unlocked ? 'text-slate-300' : 'text-slate-500'}`}>
                              {unlocked ? node.description : lockReason}
                            </p>
                          </div>
                        </div>
                      </div>
                    )
                  })}
                </div>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
