'use client'

import { useCallback, useEffect, useRef } from 'react'

import { FieldGuide } from '@/app/micro-land/components/field-guide'
import { Hud } from '@/app/micro-land/components/hud'
import { Inspector } from '@/app/micro-land/components/inspector'
import { Notices } from '@/app/micro-land/components/notices'
import { SummonPanel } from '@/app/micro-land/components/summon-panel'
import { Toolbar } from '@/app/micro-land/components/toolbar'
import { THEME_BY_ID } from '@/app/micro-land/domain/config/themes'
import { hasFertileGround } from '@/app/micro-land/domain/terrain'
import { GameInstance } from '@/app/micro-land/game-instance'
import { useMicroLand } from '@/app/micro-land/store'

export function MicroLandGame() {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const gameRef = useRef<GameInstance | null>(null)
  const notify = useMicroLand((s) => s.notify)

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return

    // `?theme=tidepool` drops a visitor straight into that world. Set it before
    // the instance is built — it reads the theme from the store on construction.
    const requested = new URLSearchParams(window.location.search).get('theme')
    if (requested && THEME_BY_ID[requested]) {
      useMicroLand.getState().setTheme(requested)
    }

    const game = new GameInstance(canvas)
    gameRef.current = game
    game.start()

    // Theme changes are driven straight off the store rather than a second
    // effect — the instance already seeded its own theme when it was built, and
    // a dependency-driven effect would rebuild the world on every remount.
    const unsubscribe = useMicroLand.subscribe((state, previous) => {
      if (state.themeId !== previous.themeId) game.setTheme(state.themeId)
    })

    return () => {
      unsubscribe()
      game.destroy()
      gameRef.current = null
    }
  }, [])

  const handleReshuffle = useCallback(() => {
    gameRef.current?.reshuffle()
    notify('The ground shifts and settles somewhere new.')
  }, [notify])

  const handleClearLife = useCallback(() => {
    gameRef.current?.clearLife()
    notify('Everything living is gone. The land waits.')
  }, [notify])

  const handleIntroduce = useCallback((raw: unknown, count: number) => {
    return gameRef.current?.introduce(raw, count) ?? null
  }, [])

  const handleApplyTerrain = useCallback((raw: unknown, keepCreatures: boolean) => {
    const game = gameRef.current
    if (!game) return null
    const terrain = game.applyTerrain(raw, { keepCreatures })
    return { name: terrain.name, fertile: hasFertileGround(terrain) }
  }, [])

  return (
    <div className="flex h-full w-full flex-col overflow-hidden">
      <Hud onReshuffle={handleReshuffle} onClearLife={handleClearLife} />

      <div className="relative min-h-0 flex-1">
        <canvas
          ref={canvasRef}
          className="absolute inset-0 block h-full w-full touch-none"
          style={{ imageRendering: 'pixelated', cursor: 'crosshair' }}
          aria-label="Micro Land world. Tap to place things, drag a creature to pick it up and throw it."
        />
        <Notices />
        <Inspector />
      </div>

      <Toolbar />
      <SummonPanel onIntroduce={handleIntroduce} onApplyTerrain={handleApplyTerrain} />
      <FieldGuide />
    </div>
  )
}
