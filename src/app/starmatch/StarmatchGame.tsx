'use client'

import { StarmatchArena } from './components/StarmatchArena'
import { StarmatchSetup } from './components/StarmatchSetup'
import { StarmatchWin } from './components/StarmatchWin'
import { useConfetti } from './lib/useConfetti'
import { useStarmatch } from './useStarmatch'

export default function StarmatchGame() {
  const { canvasRef, burst } = useConfetti()
  const g = useStarmatch(burst)
  const { state } = g

  return (
    <div className="max-w-4xl mx-auto w-full">
      <canvas
        ref={canvasRef}
        aria-hidden
        className="pointer-events-none fixed inset-0 z-50 h-full w-full"
      />

      {state.phase === 'setup' && (
        <StarmatchSetup
          state={state}
          onSetDiff={g.setDiff}
          onSetTarget={g.setTarget}
          onAddPlayer={g.addPlayer}
          onRemovePlayer={g.removePlayer}
          onRenamePlayer={g.renamePlayer}
          onCycleLook={g.cyclePlayerLook}
          onStart={g.startGame}
        />
      )}

      {state.phase === 'game' && (
        <StarmatchArena
          state={state}
          onSelect={g.selectGlyph}
          onBuzz={g.buzz}
          onReveal={g.reveal}
          onNewPair={g.newPair}
          onToggleMute={g.toggleMute}
          onBackToSetup={g.backToSetup}
          onClearShake={g.clearShake}
        />
      )}

      {state.phase === 'win' && (
        <StarmatchWin state={state} onPlayAgain={g.startGame} onNewMatch={g.backToSetup} />
      )}
    </div>
  )
}
