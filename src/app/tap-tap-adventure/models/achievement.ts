export type AchievementCategory = 'travel' | 'combat' | 'collection' | 'progression' | 'special'

export type Achievement = {
  id: string
  name: string
  description: string
  category: AchievementCategory
  requirement: number
  icon: string
  reward?: { gold?: number; reputation?: number }
}

export type PlayerAchievement = {
  achievementId: string
  progress: number
  completed: boolean
  completedAt?: string
  rewardClaimed?: boolean
}
