'use client'

interface ShortcutGroup {
  title: string
  shortcuts: { key: string; description: string }[]
}

const SHORTCUT_GROUPS: ShortcutGroup[] = [
  {
    title: 'Travel',
    shortcuts: [
      { key: 'Space / Enter', description: 'Move forward' },
      { key: 'Esc', description: 'Close panel' },
    ],
  },
  {
    title: 'Events',
    shortcuts: [
      { key: '1 – 4', description: 'Select decision option' },
    ],
  },
  {
    title: 'Combat',
    shortcuts: [
      { key: 'A', description: 'Attack' },
      { key: 'H', description: 'Heavy Attack' },
      { key: 'D', description: 'Defend' },
      { key: 'F', description: 'Flee' },
      { key: 'Q', description: 'Class Ability' },
      { key: 'E', description: 'End Turn' },
    ],
  },
]

interface KeyboardHelpProps {
  onClose: () => void
}

export function KeyboardHelp({ onClose }: KeyboardHelpProps) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center" onClick={onClose}>
      <div className="absolute inset-0 bg-black/60" />
      <div
        className="relative bg-[#161723] border border-[#3a3c56] rounded-xl p-5 max-w-sm w-full mx-4 shadow-2xl"
        onClick={e => e.stopPropagation()}
      >
        <div className="flex justify-between items-center mb-4">
          <h3 className="text-lg font-bold text-white">Keyboard Shortcuts</h3>
          <button
            onClick={onClose}
            className="text-slate-400 hover:text-white text-sm px-2 py-1"
          >
            Close
          </button>
        </div>
        <div className="space-y-4">
          {SHORTCUT_GROUPS.map(group => (
            <div key={group.title}>
              <h4 className="text-xs font-semibold text-indigo-400 uppercase mb-2">{group.title}</h4>
              <div className="space-y-1">
                {group.shortcuts.map(s => (
                  <div key={s.key} className="flex justify-between items-center text-sm">
                    <span className="text-slate-300">{s.description}</span>
                    <kbd className="bg-[#2a2b3f] border border-[#3a3c56] text-slate-200 text-xs px-2 py-0.5 rounded font-mono">
                      {s.key}
                    </kbd>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
        <div className="mt-4 text-center text-xs text-slate-500">
          Press <kbd className="bg-[#2a2b3f] border border-[#3a3c56] text-slate-300 px-1.5 py-0.5 rounded font-mono">?</kbd> to toggle this overlay
        </div>
      </div>
    </div>
  )
}
