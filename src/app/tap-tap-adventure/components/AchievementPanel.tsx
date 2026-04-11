'use client'

import { useState } from 'react'
import { ACHIEVEMENTS } from '@/app/tap-tap-adventure/config/achievements'
import { AchievementCategory, PlayerAchievement } from '@/app/tap-tap-adventure/models/achievement'

const CATEGORY_LABELS: Record<AchievementCategory, string> = {
  travel: 'Travel',
  combat: 'Combat',
  collection: 'Collection',
  progression: 'Progression',
  special: 'Special',
}

const CATEGORY_ORDER: AchievementCategory[] = ['travel', 'combat', 'collection', 'progression', 'special']

export function AchievementPanel({ achievements }: { achievements: PlayerAchievement[] }) {
  const [isExpanded, setIsExpanded] = useState(false)
  const achievementMap = new Map<string, PlayerAchievement>()
  for (const pa of achievements) {
    achievementMap.set(pa.achievementId, pa)
  }

  const completedCount = achievements.filter(a => a.completed).length
  const totalCount = ACHIEVEMENTS.length

  if (!isExpanded) {
    return (
      <button
        className="w-full bg-[#1e1f30] border border-[#3a3c56] rounded-lg p-3 text-left hover:border-amber-700/50 transition-colors"
        onClick={() => setIsExpanded(true)}
      >
        <div className="flex justify-between items-center">
          <span className="text-sm font-bold text-amber-400">Achievements</span>
          <span className="text-xs text-slate-400">
            {completedCount}/{totalCount}
          </span>
        </div>
        <div className="h-1.5 bg-slate-700 rounded-full overflow-hidden mt-2">
          <div
            className="h-full bg-amber-500 rounded-full transition-all duration-300"
            style={{ width: `${totalCount > 0 ? (completedCount / totalCount) * 100 : 0}%` }}
          />
        </div>
      </button>
    )
  }

  return (
    <div className="bg-[#1e1f30] border border-[#3a3c56] rounded-lg p-3 space-y-3">
      <div className="flex justify-between items-center">
        <button
          className="text-sm font-bold text-amber-400 hover:text-amber-300 transition-colors"
          onClick={() => setIsExpanded(false)}
        >
          Achievements
        </button>
        <span className="text-xs text-slate-400">
          {completedCount}/{totalCount}
        </span>
      </div>
      {CATEGORY_ORDER.map(category => {
        const categoryAchievements = ACHIEVEMENTS.filter(a => a.category === category)
        if (categoryAchievements.length === 0) return null

        return (
          <div key={category} className="space-y-1.5">
            <h4 className="text-[10px] uppercase tracking-wider text-slate-500 font-semibold">
              {CATEGORY_LABELS[category]}
            </h4>
            {categoryAchievements.map(achievement => {
              const playerAchievement = achievementMap.get(achievement.id)
              const progress = playerAchievement?.progress ?? 0
              const completed = playerAchievement?.completed ?? false
              const progressPct = Math.min(1, progress / achievement.requirement)

              return (
                <div
                  key={achievement.id}
                  className={`rounded p-2 text-xs ${
                    completed
                      ? 'bg-emerald-950/30 border border-emerald-700/30'
                      : 'bg-[#161723] border border-[#2a2b3f]'
                  }`}
                >
                  <div className="flex items-center gap-2">
                    <span className="text-base">{achievement.icon}</span>
                    <div className="flex-1 min-w-0">
                      <div className="flex justify-between items-center">
                        <span className={`font-semibold truncate ${completed ? 'text-emerald-400' : 'text-white'}`}>
                          {completed && <span className="mr-1">&#10003;</span>}
                          {achievement.name}
                        </span>
                        {completed && playerAchievement?.completedAt && (
                          <span className="text-[9px] text-slate-500 ml-1 flex-shrink-0">
                            {new Date(playerAchievement.completedAt).toLocaleDateString()}
                          </span>
                        )}
                      </div>
                      <p className="text-[10px] text-slate-400 truncate">{achievement.description}</p>
                      {!completed && (
                        <div className="mt-1">
                          <div className="flex justify-between text-[9px] text-slate-500">
                            <span>
                              {progress}/{achievement.requirement}
                            </span>
                            <span>{Math.round(progressPct * 100)}%</span>
                          </div>
                          <div className="h-1 bg-slate-700 rounded-full overflow-hidden mt-0.5">
                            <div
                              className="h-full bg-amber-600 rounded-full transition-all duration-300"
                              style={{ width: `${progressPct * 100}%` }}
                            />
                          </div>
                        </div>
                      )}
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
