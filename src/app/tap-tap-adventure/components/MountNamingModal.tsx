'use client'

import { useState } from 'react'
import { Button } from '@/app/tap-tap-adventure/components/ui/button'
import { Mount } from '@/app/tap-tap-adventure/models/mount'
import { MOUNT_PERSONALITY_INFO } from '@/app/tap-tap-adventure/config/mounts'

interface MountNamingModalProps {
  mount: Mount
  isOpen: boolean
  onConfirm: (customName?: string) => void
}

const MOUNT_RARITY_COLORS: Record<string, string> = {
  common: 'border-slate-400 text-slate-300',
  uncommon: 'border-green-400 text-green-300',
  rare: 'border-blue-400 text-blue-300',
  legendary: 'border-yellow-400 text-yellow-300',
}

export function MountNamingModal({ mount, isOpen, onConfirm }: MountNamingModalProps) {
  const [inputValue, setInputValue] = useState('')

  if (!isOpen) return null

  const handleConfirm = () => {
    const trimmed = inputValue.trim()
    onConfirm(trimmed.length > 0 ? trimmed : undefined)
    setInputValue('')
  }

  const handleSkip = () => {
    onConfirm(undefined)
    setInputValue('')
  }

  const rarityColor = MOUNT_RARITY_COLORS[mount.rarity] ?? 'border-slate-400 text-slate-300'

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      {/* Backdrop */}
      <div className="absolute inset-0 bg-black/60" onClick={handleSkip} />

      {/* Content */}
      <div className="relative z-10 bg-gradient-to-b from-[#1e1f30] to-[#161723] border-2 border-amber-500/50 rounded-2xl px-8 py-6 text-center shadow-2xl shadow-amber-500/20 max-w-sm mx-4 w-full">
        <h2 className="text-2xl font-bold text-amber-400 mb-1">New Mount!</h2>
        <p className="text-slate-400 text-sm mb-5">Would you like to give it a name?</p>

        {/* Mount display */}
        <div className={`bg-[#2a2b3f] border rounded-lg p-4 mb-5 ${rarityColor}`}>
          <div className="flex items-center justify-center gap-3 mb-2">
            <span className="text-4xl">{mount.icon}</span>
            <div className="text-left">
              <div className="font-bold text-white text-lg">{mount.name}</div>
              <div className="text-xs uppercase tracking-wider opacity-70">{mount.rarity}</div>
            </div>
          </div>
          <p className="text-xs text-slate-400">{mount.description}</p>
          {mount.personality && MOUNT_PERSONALITY_INFO[mount.personality] && (
            <div className="mt-2 flex items-center gap-2 bg-amber-950/30 rounded px-2 py-1">
              <span>{MOUNT_PERSONALITY_INFO[mount.personality].icon}</span>
              <div className="text-left">
                <span className="text-xs font-semibold text-amber-300">{MOUNT_PERSONALITY_INFO[mount.personality].label}</span>
                <span className="text-[10px] text-slate-400 ml-1">— {MOUNT_PERSONALITY_INFO[mount.personality].description}</span>
              </div>
            </div>
          )}
        </div>

        {/* Name input */}
        <input
          type="text"
          value={inputValue}
          onChange={e => setInputValue(e.target.value.slice(0, 30))}
          placeholder="Enter a name... (optional)"
          maxLength={30}
          className="w-full bg-[#2a2b3f] border border-[#3a3c56] rounded-lg px-3 py-2 text-white text-sm placeholder-slate-500 focus:outline-none focus:border-amber-500/50 mb-1"
          onKeyDown={e => { if (e.key === 'Enter') handleConfirm() }}
          autoFocus
        />
        <div className="text-right text-[10px] text-slate-500 mb-4">{inputValue.length}/30</div>

        {/* Buttons */}
        <div className="flex gap-3">
          <Button
            className="flex-1 bg-[#2a2b3f] border border-[#3a3c56] hover:bg-[#3a3c56] text-slate-300 font-semibold py-2 rounded-lg"
            onClick={handleSkip}
          >
            Skip
          </Button>
          <Button
            className="flex-1 bg-gradient-to-r from-amber-600 to-yellow-600 hover:from-amber-500 hover:to-yellow-500 text-white font-bold py-2 rounded-lg"
            onClick={handleConfirm}
          >
            Name Mount
          </Button>
        </div>
      </div>
    </div>
  )
}
