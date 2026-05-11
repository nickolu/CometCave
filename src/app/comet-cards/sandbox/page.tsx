'use client'

import { useState } from 'react'

import { CosmicShell } from '@/app/comet-cards/components/cosmic/shell'
import { BlindSelectionView } from '@/app/comet-cards/components/game-views/blind-selection'
import { GamePlayView } from '@/app/comet-cards/components/game-views/gameplay'
import { useGameEvents } from '@/app/comet-cards/useGameEvents'
import { useGameState } from '@/app/comet-cards/useGameState'
import { useIsOwner } from '@/hooks/useIsOwner'

import { SandboxPanel } from './SandboxPanel'

function PhaseSurface() {
  const { game } = useGameState()
  if (game.gamePhase === 'blindSelection') return <BlindSelectionView />
  if (game.gamePhase === 'gameplay') return <GamePlayView />
  return (
    <div
      style={{
        padding: 32,
        fontFamily: 'var(--cc-font-mono)',
        fontSize: 12,
        opacity: 0.55,
        textAlign: 'center',
      }}
    >
      Pick your config in the panel and hit Apply or Start to bring up the play surface.
      <br />
      (Current phase: <b>{game.gamePhase}</b>)
    </div>
  )
}

function SidebarToggle({
  open,
  onToggle,
}: {
  open: boolean
  onToggle: () => void
}) {
  return (
    <button
      type="button"
      onClick={onToggle}
      title={open ? 'Hide sandbox panel' : 'Show sandbox panel'}
      aria-expanded={open}
      style={{
        position: 'fixed',
        top: 80,
        right: 20,
        zIndex: 50,
        background: 'var(--cc-pink-bg)',
        border: '1px solid var(--cc-pink-border)',
        color: 'var(--cc-pink)',
        fontFamily: 'var(--cc-font-mono)',
        fontSize: 10,
        letterSpacing: 2,
        textTransform: 'uppercase',
        padding: '8px 12px',
        borderRadius: 4,
        cursor: 'pointer',
      }}
    >
      {open ? 'Hide ▸' : '◂ Sandbox'}
    </button>
  )
}

function LockedView({ message }: { message: string }) {
  return (
    <CosmicShell>
      <div
        style={{
          padding: '80px 24px',
          textAlign: 'center',
          fontFamily: 'var(--cc-font-mono)',
          fontSize: 13,
          letterSpacing: 1,
          opacity: 0.6,
        }}
      >
        {message}
      </div>
    </CosmicShell>
  )
}

function SandboxContent() {
  useGameEvents()
  const [sidebarOpen, setSidebarOpen] = useState(true)

  return (
    <CosmicShell>
      <SidebarToggle open={sidebarOpen} onToggle={() => setSidebarOpen(o => !o)} />
      <div
        className="grid"
        style={{
          gridTemplateColumns: sidebarOpen
            ? 'minmax(0, 1fr) minmax(320px, 380px)'
            : 'minmax(0, 1fr)',
          gap: 18,
          padding: '14px 22px 22px',
          alignItems: 'start',
        }}
      >
        <div className="min-w-0">
          <PhaseSurface />
        </div>
        {sidebarOpen && (
          <aside style={{ position: 'sticky', top: 12 }}>
            <SandboxPanel />
          </aside>
        )}
      </div>
    </CosmicShell>
  )
}

export default function SandboxPage() {
  const { isOwner, loading } = useIsOwner()
  if (loading) return <LockedView message="the cave is waking…" />
  if (!isOwner) return <LockedView message="the cave is sleeping…" />
  return <SandboxContent />
}
