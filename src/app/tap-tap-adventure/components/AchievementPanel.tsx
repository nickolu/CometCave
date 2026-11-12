'use client'

/**
 * Feats, printed as ruled rows on the bill: a search line, a row of category
 * filters, and each feat with its progress rule or a gold "Done" stamp.
 */
import { useState } from 'react'

import { ACHIEVEMENTS } from '@/app/tap-tap-adventure/config/achievements'
import { AchievementCategory, PlayerAchievement } from '@/app/tap-tap-adventure/models/achievement'
import { SearchIcon } from '@/app/tap-tap-adventure/stage/icons'
import { PaperButton, PlaybillCaption, PlaybillTitle, Stamp } from '@/app/tap-tap-adventure/stage/Playbill'
import { cn } from '@/lib/utils'

const CATEGORY_LABELS: Record<AchievementCategory, string> = {
  travel: 'Travel',
  combat: 'Combat',
  collection: 'Collection',
  progression: 'Progression',
  special: 'Special',
}

const CATEGORY_ORDER: AchievementCategory[] = ['travel', 'combat', 'collection', 'progression', 'special']

export function AchievementPanel({ achievements }: { achievements: PlayerAchievement[] }) {
  const [searchQuery, setSearchQuery] = useState('')
  const [category, setCategory] = useState<AchievementCategory | null>(null)
  const achievementMap = new Map<string, PlayerAchievement>()
  for (const pa of achievements) {
    achievementMap.set(pa.achievementId, pa)
  }

  const completedCount = achievements.filter(a => a.completed).length
  const totalCount = ACHIEVEMENTS.length
  const overall = totalCount > 0 ? completedCount / totalCount : 0

  const matches = (a: (typeof ACHIEVEMENTS)[number]) =>
    !searchQuery || a.name.toLowerCase().includes(searchQuery.toLowerCase()) || a.description.toLowerCase().includes(searchQuery.toLowerCase())
  const shownCategories = category ? [category] : CATEGORY_ORDER
  const anyShown = shownCategories.some(c => ACHIEVEMENTS.some(a => a.category === c && matches(a)))

  return (
    <section aria-label="Feats" className="space-y-3">
      <PlaybillTitle size="sm">Feats</PlaybillTitle>

      <div className="flex items-center gap-3">
        <div
          className="h-1.5 flex-1 overflow-hidden rounded-full bg-ps-playbill-edge"
          role="progressbar"
          aria-valuemin={0}
          aria-valuemax={100}
          aria-valuenow={Math.round(overall * 100)}
          aria-label="Feats done"
        >
          <div className="h-full rounded-full bg-ps-stamp-gold transition-[width] duration-300" style={{ width: `${overall * 100}%` }} />
        </div>
        <span className="shrink-0 font-playbill text-sm tabular-nums text-ps-ink" title={`${completedCount} of ${totalCount} feats done`}>
          {completedCount}<span className="text-ps-ink-soft">/{totalCount}</span>
        </span>
      </div>

      <label className="relative block">
        <span className="sr-only">Search feats</span>
        <SearchIcon size={14} className="pointer-events-none absolute left-2.5 top-1/2 -translate-y-1/2 text-ps-ink-soft" />
        <input
          type="search"
          placeholder="Search feats"
          aria-label="Search achievements"
          value={searchQuery}
          onChange={e => setSearchQuery(e.target.value)}
          className="h-9 w-full rounded-[3px] border-2 border-ps-ink bg-transparent pl-8 pr-2 font-body text-sm text-ps-ink placeholder:text-ps-ink-faint focus:outline-none focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ds-primary"
        />
      </label>

      <div className="flex flex-wrap gap-1" role="group" aria-label="Filter by category">
        <PaperButton size="sm" variant={category === null ? 'ink' : 'outline'} aria-pressed={category === null} onClick={() => setCategory(null)}>
          All
        </PaperButton>
        {CATEGORY_ORDER.map(c => (
          <PaperButton key={c} size="sm" variant={category === c ? 'ink' : 'outline'} aria-pressed={category === c} onClick={() => setCategory(category === c ? null : c)}>
            {CATEGORY_LABELS[c]}
          </PaperButton>
        ))}
      </div>

      {!anyShown && <p className="py-3 font-body text-sm italic text-ps-ink-soft">Nothing matches.</p>}

      {shownCategories.map(cat => {
        const categoryAchievements = ACHIEVEMENTS.filter(a => a.category === cat).filter(matches)
        if (categoryAchievements.length === 0) return null

        return (
          <div key={cat}>
            <PlaybillCaption className="mb-1">{CATEGORY_LABELS[cat]}</PlaybillCaption>
            <ul className="divide-y divide-ps-playbill-edge border-y border-ps-playbill-edge">
              {categoryAchievements.map(achievement => {
                const playerAchievement = achievementMap.get(achievement.id)
                const progress = playerAchievement?.progress ?? 0
                const completed = playerAchievement?.completed ?? false
                const progressPct = Math.min(1, progress / achievement.requirement)

                return (
                  <li key={achievement.id} className="flex items-start gap-2.5 py-2">
                    <span aria-hidden className={cn('mt-px w-6 shrink-0 text-center font-body text-base leading-none', !completed && 'opacity-70')}>
                      {achievement.icon}
                    </span>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-start justify-between gap-2">
                        <div className="min-w-0">
                          <span className={cn('block truncate font-body text-sm font-semibold leading-snug', completed ? 'text-ps-ink' : 'text-ps-ink')}>
                            {achievement.name}
                          </span>
                          <span className="block font-body text-xs leading-snug text-ps-ink-soft">{achievement.description}</span>
                        </div>
                        <span className="flex shrink-0 flex-col items-end gap-1">
                          {completed && <Stamp tone="gold">Done</Stamp>}
                          {completed && playerAchievement?.completedAt && (
                            <span className="font-label text-xs font-bold uppercase tracking-widest text-ps-ink-faint">
                              {new Date(playerAchievement.completedAt).toLocaleDateString()}
                            </span>
                          )}
                        </span>
                      </div>
                      {(achievement.reward?.gold || achievement.reward?.reputation) && (
                        <div className="mt-1 flex flex-wrap gap-1">
                          {achievement.reward.gold && <Stamp tone="gold" tilt={false} className="text-xs">+{achievement.reward.gold} gold</Stamp>}
                          {achievement.reward.reputation && <Stamp tone="blue" tilt={false} className="text-xs">+{achievement.reward.reputation} rep</Stamp>}
                        </div>
                      )}
                      {!completed && (
                        <div className="mt-1.5 flex items-center gap-2">
                          <div
                            className="h-1 flex-1 overflow-hidden rounded-full bg-ps-playbill-edge"
                            role="progressbar"
                            aria-valuemin={0}
                            aria-valuemax={100}
                            aria-valuenow={Math.round(progressPct * 100)}
                            aria-label={`${achievement.name} progress`}
                          >
                            <div className="h-full rounded-full bg-ps-ink transition-[width] duration-300" style={{ width: `${progressPct * 100}%` }} />
                          </div>
                          <span className="shrink-0 font-playbill text-xs tabular-nums text-ps-ink-soft">
                            {progress}/{achievement.requirement}
                          </span>
                        </div>
                      )}
                    </div>
                  </li>
                )
              })}
            </ul>
          </div>
        )
      })}
    </section>
  )
}
