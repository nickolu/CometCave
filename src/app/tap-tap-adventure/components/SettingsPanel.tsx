'use client'

import { useState } from 'react'
import { soundEngine } from '@/app/tap-tap-adventure/lib/soundEngine'

export function SettingsPanel() {
  const [soundEnabled, setSoundEnabled] = useState(soundEngine.isEnabled())

  const toggleSound = () => {
    const newValue = !soundEnabled
    soundEngine.setEnabled(newValue)
    setSoundEnabled(newValue)
    try {
      localStorage.setItem('tta-sound-enabled', JSON.stringify(newValue))
    } catch {
      // localStorage may not be available
    }
  }

  return (
    <div className="w-full flex flex-col">
      <h3 className="text-lg font-semibold text-white mb-3">Settings</h3>
      <div className="space-y-3">
        <div className="flex items-center justify-between bg-[#1e1f30] border border-[#3a3c56] p-3 rounded-lg">
          <div>
            <div className="text-sm font-medium text-white">Sound Effects</div>
            <div className="text-xs text-slate-400">Toggle game audio</div>
          </div>
          <button
            onClick={toggleSound}
            className={`relative w-11 h-6 rounded-full transition-colors ${
              soundEnabled ? 'bg-indigo-600' : 'bg-slate-600'
            }`}
          >
            <span
              className={`absolute top-0.5 left-0.5 w-5 h-5 rounded-full bg-white transition-transform ${
                soundEnabled ? 'translate-x-5' : 'translate-x-0'
              }`}
            />
          </button>
        </div>
      </div>
    </div>
  )
}
