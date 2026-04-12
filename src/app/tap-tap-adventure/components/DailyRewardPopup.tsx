'use client'

import { useEffect, useState } from 'react'
import { Button } from '@/app/tap-tap-adventure/components/ui/button'
import { DailyReward } from '@/app/tap-tap-adventure/config/dailyRewards'
import { ClaimResult } from '@/app/tap-tap-adventure/lib/dailyRewardTracker'

interface DailyRewardPopupProps {
  streak: number
  reward: DailyReward
  onClaim: () => ClaimResult | null
  onDismiss: () => void
}

export function DailyRewardPopup({ streak, reward, onClaim, onDismiss }: DailyRewardPopupProps) {
  const [isVisible, setIsVisible] = useState(false)
  const [claimed, setClaimed] = useState(false)
  const [claimResult, setClaimResult] = useState<ClaimResult | null>(null)

  useEffect(() => {
    requestAnimationFrame(() => setIsVisible(true))
  }, [])

  // Auto-dismiss after claiming
  useEffect(() => {
    if (!claimed) return
    const timer = setTimeout(() => {
      setIsVisible(false)
      setTimeout(onDismiss, 300)
    }, 3000)
    return () => clearTimeout(timer)
  }, [claimed, onDismiss])

  const dayInCycle = (streak % 7) + 1

  const handleClaim = () => {
    const result = onClaim()
    if (result) {
      setClaimResult(result)
      setClaimed(true)
    }
  }

  return (
    <div
      className={`fixed inset-0 z-50 flex items-center justify-center transition-opacity duration-300 ${
        isVisible ? 'opacity-100' : 'opacity-0'
      }`}
    >
      {/* Backdrop */}
      <div className="absolute inset-0 bg-black/60" onClick={claimed ? () => { setIsVisible(false); setTimeout(onDismiss, 300) } : undefined} />

      {/* Content */}
      <div
        className={`relative transition-all duration-500 ${
          isVisible ? 'scale-100 translate-y-0' : 'scale-75 translate-y-8'
        }`}
      >
        <div className="bg-gradient-to-b from-[#1e1f30] to-[#161723] border-2 border-amber-500/50 rounded-2xl px-8 py-6 text-center shadow-2xl shadow-amber-500/20 max-w-sm mx-4">
          {!claimed ? (
            <>
              {/* Title */}
              <h2 className="text-2xl font-bold text-amber-400 mb-1">Daily Reward</h2>
              <p className="text-slate-400 text-sm mb-4">
                Day {dayInCycle} of 7
              </p>

              {/* Streak indicator */}
              <div className="flex justify-center gap-1.5 mb-4">
                {Array.from({ length: 7 }).map((_, i) => (
                  <div
                    key={i}
                    className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold ${
                      i < dayInCycle
                        ? 'bg-amber-500 text-black'
                        : 'bg-[#2a2b3f] text-slate-500 border border-[#3a3c56]'
                    } ${i === dayInCycle - 1 ? 'ring-2 ring-amber-300 ring-offset-1 ring-offset-[#161723]' : ''}`}
                  >
                    {i + 1}
                  </div>
                ))}
              </div>

              {/* Reward description */}
              <div className="bg-[#2a2b3f] border border-[#3a3c56] rounded-lg p-4 mb-4">
                <p className="text-lg font-semibold text-white mb-1">{reward.label}</p>
                <p className="text-sm text-slate-300">{reward.description}</p>
              </div>

              {/* Claim button */}
              <Button
                className="w-full bg-gradient-to-r from-amber-600 to-yellow-600 hover:from-amber-500 hover:to-yellow-500 text-white font-bold py-3 rounded-lg text-lg"
                onClick={handleClaim}
              >
                Claim Reward
              </Button>
            </>
          ) : (
            <>
              {/* Claimed state */}
              <h2 className="text-2xl font-bold text-green-400 mb-3">Reward Claimed!</h2>

              <div className="bg-[#2a2b3f] border border-[#3a3c56] rounded-lg p-4 mb-3 space-y-1">
                {claimResult && claimResult.goldAwarded > 0 && (
                  <p className="text-amber-300 text-sm">+{claimResult.goldAwarded} Gold</p>
                )}
                {claimResult && claimResult.reputationAwarded > 0 && (
                  <p className="text-blue-300 text-sm">+{claimResult.reputationAwarded} Reputation</p>
                )}
                {claimResult && claimResult.items.map(item => (
                  <p key={item.id} className="text-green-300 text-sm">
                    Received: {item.name}
                  </p>
                ))}
              </div>

              <p className="text-slate-500 text-xs">Auto-dismissing...</p>
            </>
          )}
        </div>
      </div>
    </div>
  )
}
