'use client'

import { useState } from 'react'

import { SKILLS } from '@/app/tap-tap-adventure/config/skills'
import { ClassSkillTree, SkillTreeNode } from '@/app/tap-tap-adventure/models/classSkillTree'
import { SkillCategory } from '@/app/tap-tap-adventure/models/skill'
import { PaperButton, PlaybillCaption, PlaybillRule, PlaybillTitle, Stamp } from '@/app/tap-tap-adventure/stage/Playbill'
import { cn } from '@/lib/utils'

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

/** One skill on the bill: filled ink when earned, outlined when still locked. */
function SkillNode({
  icon,
  name,
  unlocked,
  description,
  lockReason,
  stamp,
  className,
}: {
  icon: string
  name: string
  unlocked: boolean
  description: string
  lockReason?: string | null
  stamp?: React.ReactNode
  className?: string
}) {
  return (
    <div
      className={cn(
        'rounded-[3px] border-2 p-2',
        unlocked ? 'border-ps-ink bg-ps-ink text-ps-playbill' : 'border-ps-ink/50 text-ps-ink',
        className
      )}
      title={unlocked ? description : lockReason ?? description}
    >
      <div className="flex items-start gap-2">
        <span className={cn('font-body text-base leading-none', !unlocked && 'opacity-50 grayscale')} aria-hidden>
          {icon}
        </span>
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
            <span className={cn('font-body text-sm font-medium leading-tight', !unlocked && 'text-ps-ink-soft')}>
              {name}
            </span>
            {unlocked ? (
              <span className="font-label text-xs font-bold uppercase tracking-widest text-ps-playbill/80">Earned</span>
            ) : (
              stamp
            )}
          </div>
          <p className={cn('mt-0.5 font-body text-xs leading-snug', unlocked ? 'text-ps-playbill/85' : 'text-ps-ink-soft')}>
            {unlocked ? description : lockReason ?? description}
          </p>
        </div>
      </div>
    </div>
  )
}

export function SkillPanel({
  unlockedSkillIds,
  classSkillTree,
  unlockedTreeSkillIds = [],
  characterLevel = 1,
}: SkillPanelProps) {
  const [isExpanded, setIsExpanded] = useState(true)
  const unlockedSet = new Set(unlockedSkillIds)
  const unlockedTreeSet = new Set(unlockedTreeSkillIds)

  const unlockedCount = unlockedSkillIds.length
  const totalCount = SKILLS.length

  const treeUnlockedCount = unlockedTreeSkillIds.length
  const treeTotal = classSkillTree?.nodes.length ?? 0

  const counts = (
    <div className="flex items-center gap-1">
      {classSkillTree && (
        <Stamp tone="violet" tilt={false} title={`${treeUnlockedCount} of ${treeTotal} class skills`}>
          {treeUnlockedCount}/{treeTotal} class
        </Stamp>
      )}
      <Stamp tone="ink" tilt={false} title={`${unlockedCount} of ${totalCount} passive skills`}>
        {unlockedCount}/{totalCount}
      </Stamp>
    </div>
  )

  if (!isExpanded) {
    return (
      <button
        type="button"
        className="w-full rounded-[3px] border-2 border-ps-ink p-3 text-left transition-colors hover:bg-ps-playbill-shade focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ds-primary"
        onClick={() => setIsExpanded(true)}
        aria-expanded={false}
      >
        <div className="flex items-center justify-between gap-2">
          <PlaybillTitle size="sm" rules={false} className="text-left">Passive skills</PlaybillTitle>
          {counts}
        </div>
        <div
          className="mt-2 h-1.5 w-full overflow-hidden rounded-full bg-ps-ink/20"
          role="progressbar"
          aria-valuemin={0}
          aria-valuemax={totalCount}
          aria-valuenow={unlockedCount}
          aria-label="Passive skills earned"
        >
          <div className="h-full rounded-full bg-ps-ink transition-[width] duration-300" style={{ width: `${totalCount > 0 ? (unlockedCount / totalCount) * 100 : 0}%` }} />
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
    <div className="w-full">
      <div className="flex items-center justify-between gap-2">
        <PlaybillTitle size="sm" rules={false} className="text-left">Passive skills</PlaybillTitle>
        <div className="flex items-center gap-2">
          {counts}
          <PaperButton size="sm" variant="outline" className="h-7 px-2 text-xs" onClick={() => setIsExpanded(false)} aria-expanded>
            Fold
          </PaperButton>
        </div>
      </div>
      <div
        className="mt-2 h-1.5 w-full overflow-hidden rounded-full bg-ps-ink/20"
        role="progressbar"
        aria-valuemin={0}
        aria-valuemax={totalCount}
        aria-valuenow={unlockedCount}
        aria-label="Passive skills earned"
      >
        <div className="h-full rounded-full bg-ps-ink transition-[width] duration-300" style={{ width: `${totalCount > 0 ? (unlockedCount / totalCount) * 100 : 0}%` }} />
      </div>

      {/* Global passive skills */}
      <div className="mt-3 space-y-3">
        {CATEGORY_ORDER.map(category => {
          const categorySkills = SKILLS.filter(s => s.category === category)
          if (categorySkills.length === 0) return null

          return (
            <div key={category}>
              <PlaybillCaption className="border-b-2 border-dotted border-ps-ink/40 pb-1">{CATEGORY_LABELS[category]}</PlaybillCaption>
              <div className="mt-1.5 space-y-1.5">
                {categorySkills.map(skill => {
                  const unlocked = unlockedSet.has(skill.id)
                  return (
                    <SkillNode
                      key={skill.id}
                      icon={skill.icon}
                      name={skill.name}
                      unlocked={unlocked}
                      description={skill.description}
                      lockReason={getRequirementText(skill.requirement)}
                      stamp={
                        skill.requirement.type === 'level' ? (
                          <Stamp tone="ink" tilt={false}>Lv {skill.requirement.value}</Stamp>
                        ) : (
                          <Stamp tone="ink" tilt={false}>Locked</Stamp>
                        )
                      }
                    />
                  )
                })}
              </div>
            </div>
          )
        })}
      </div>

      {/* Class skill tree */}
      {classSkillTree && (
        <>
          <PlaybillRule className="my-4" />
          <PlaybillTitle size="sm" rules={false} className="text-left">
            {classSkillTree.className} skills
          </PlaybillTitle>
          <div className="mt-2 space-y-3">
            {([1, 2, 3, 4] as const).map(tier => {
              const tierNodes = classSkillTree.nodes.filter(n => n.tier === tier)
              if (tierNodes.length === 0) return null

              return (
                <div key={tier}>
                  <PlaybillCaption className="border-b-2 border-dotted border-ps-ink/40 pb-1">{TIER_LABELS[tier]}</PlaybillCaption>
                  <div className="mt-1.5 grid grid-cols-1 gap-1.5 sm:grid-cols-2">
                    {tierNodes.map(node => {
                      const unlocked = unlockedTreeSet.has(node.id)
                      const lockReason = !unlocked
                        ? getTreeNodeLockReason(node, characterLevel, unlockedTreeSet, classSkillTree.nodes)
                        : null

                      return (
                        <SkillNode
                          key={node.id}
                          icon={node.icon}
                          name={node.name}
                          unlocked={unlocked}
                          description={node.description}
                          lockReason={lockReason}
                          stamp={<Stamp tone={characterLevel >= node.requiredLevel ? 'ink' : 'red'} tilt={false}>Lv {node.requiredLevel}</Stamp>}
                        />
                      )
                    })}
                  </div>
                </div>
              )
            })}
          </div>
        </>
      )}
    </div>
  )
}
