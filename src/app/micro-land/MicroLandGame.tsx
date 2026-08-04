'use client'

import { useCallback, useEffect, useRef } from 'react'

import { accountBackend } from '@/app/micro-land/chronicle/backend'
import {
  adoptAccount,
  flushChronicle,
  initChronicle,
  onSaveState,
} from '@/app/micro-land/chronicle/chronicle'
import { BlueprintWorkshop } from '@/app/micro-land/components/blueprint-workshop'
import { ChallengesPanel } from '@/app/micro-land/components/challenges-panel'
import { PopulationGraph } from '@/app/micro-land/components/population-graph'
import { CreatureBuilder } from '@/app/micro-land/components/creature-builder'
import { ReplayBar } from '@/app/micro-land/components/replay-bar'
import { FieldGuide } from '@/app/micro-land/components/field-guide'
import { Hud } from '@/app/micro-land/components/hud'
import { Inspector } from '@/app/micro-land/components/inspector'
import { Notices } from '@/app/micro-land/components/notices'
import { PanControls } from '@/app/micro-land/components/pan-controls'
import { SettingsPanel } from '@/app/micro-land/components/settings-panel'
import { SummonPanel } from '@/app/micro-land/components/summon-panel'
import { Toolbar } from '@/app/micro-land/components/toolbar'
import { WorldsPanel } from '@/app/micro-land/components/worlds-panel'
import { ZoomControls } from '@/app/micro-land/components/zoom-controls'
import { THEME_BY_ID } from '@/app/micro-land/domain/config/themes'
import { hasFertileGround } from '@/app/micro-land/domain/terrain'
import { GameInstance } from '@/app/micro-land/game-instance'
import { useMicroLand } from '@/app/micro-land/store'
import { accountWorldsBackend } from '@/app/micro-land/worlds/backend'
import {
  activeWorldId,
  adoptWorldsAccount,
  flushActiveWorld,
  initShelf,
  keepWorld,
  onShelf,
  provideSnapshot,
  readWorld,
  removeWorld,
  setActiveWorld,
} from '@/app/micro-land/worlds/shelf'
import type { WorldSave } from '@/app/micro-land/worlds/types'
import { newSaveId } from '@/app/micro-land/worlds/wire'
import { useAuth } from '@/hooks/useAuth'

/** Who a shelved world is, as far as the game instance is concerned. */
type SaveIdentity = Pick<WorldSave, 'id' | 'name' | 'createdAt'>

export function MicroLandGame() {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const gameRef = useRef<GameInstance | null>(null)
  const notify = useMicroLand(s => s.notify)
  const { user } = useAuth()

  /**
   * The shelf slot the world on screen belongs to.
   *
   * A ref rather than state: the autosave reads it from a timer that has nothing
   * to do with a render, and nothing on screen is driven by it — the panel reads
   * `shelf.activeId`, which the shelf module owns.
   */
  const identityRef = useRef<SaveIdentity | null>(null)

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return

    // Remembered settings, applied before the world is built — the ground seeds
    // its first plants within a few seconds of the first tick, and a knob that
    // arrived after that would look like it had done nothing.
    useMicroLand.getState().hydrateTuning()

    // `?theme=tidepool` drops a visitor straight into that world. Set it before
    // the instance is built — it reads the theme from the store on construction.
    const requested = new URLSearchParams(window.location.search).get('theme')
    if (requested && THEME_BY_ID[requested]) {
      useMicroLand.getState().setTheme(requested)
    }

    let game: GameInstance | null = null
    let unsubscribe: (() => void) | null = null
    let cancelled = false

    // The chronicle is read *before* the world exists. Building the instance
    // first would let a stats tick write records into a chronicle that is about
    // to be replaced by the stored one, quietly losing them.
    void initChronicle().then(() => {
      if (cancelled) return
      game = new GameInstance(canvas)
      gameRef.current = game
      game.publishRecords()
      game.start()

      // Theme changes are driven straight off the store rather than a second
      // effect — the instance already seeded its own theme when it was built,
      // and a dependency-driven effect would rebuild the world on every remount.
      unsubscribe = useMicroLand.subscribe((state, previous) => {
        if (state.themeId !== previous.themeId) game?.setTheme(state.themeId)
        if (state.reshuffleToken !== previous.reshuffleToken) game?.reshuffle()
        if (state.locateRequest !== previous.locateRequest && state.locateRequest && game) {
          const found = game.locateSpecies(state.locateRequest.blueprintId)
          if (!found) {
            const name =
              game.getWorld().blueprints[state.locateRequest.blueprintId]?.name ??
              state.locateRequest.blueprintId
            useMicroLand.getState().notify(`No ${name} alive right now`)
          }
        }
        if (state.workshopSpawnRequest !== previous.workshopSpawnRequest && state.workshopSpawnRequest && game) {
          game.workshopIntroduce(state.workshopSpawnRequest.blueprint, state.workshopSpawnRequest.traits)
        }
      })
    })

    // The shelf can write the open world back on its own — on a timer and on the
    // way out of the page — but it has no way into the game instance, so this is
    // how it gets one.
    provideSnapshot(() => {
      const identity = identityRef.current
      if (!identity) return null
      return gameRef.current?.toSave(identity) ?? null
    })
    void initShelf()

    return () => {
      cancelled = true
      unsubscribe?.()
      // Before the instance goes: leaving for another game in the cave is a
      // normal way to end a session, and it isn't covered by page-hide.
      void flushActiveWorld()
      provideSnapshot(null)
      game?.destroy()
      gameRef.current = null
      void flushChronicle()
    }
  }, [])

  /**
   * Move the session's records onto the player's account once auth resolves.
   *
   * Deliberately a second effect that the game does not wait for. The world is
   * already running on `localBackend` by the time this fires, which is what
   * anonymous-first means in practice — a player with no account, or no
   * connection, still gets a complete game, and this only ever adds to it.
   *
   * `useAuth` mints an anonymous uid for everyone, so this runs for a first-time
   * visitor too: their creatures are kept from the first one they draw, and
   * signing up later links the credential to the same uid and brings the whole
   * archive with it.
   *
   * Keyed on the uid rather than the user object, which is replaced on every
   * token refresh and would otherwise re-adopt every hour. The ref guards the
   * remount case, where the effect re-runs with a uid already adopted.
   */
  // Whether the tool drawer was left folded away. Its own effect rather than a
  // line in the one above: it is a preference about the screen, not about the
  // world, and it has nothing to do with getting the first tick out on time.
  useEffect(() => useMicroLand.getState().hydrateToolbar(), [])

  // Storage state into the store, so any panel can render it like other state.
  useEffect(() => onSaveState(useMicroLand.getState().setSaveState), [])
  useEffect(() => onShelf(useMicroLand.getState().setShelf), [])

  const adoptedRef = useRef<string | null>(null)
  useEffect(() => {
    const uid = user?.uid
    if (!uid || adoptedRef.current === uid) return
    adoptedRef.current = uid
    // `getIdToken` refreshes on its own when the cached token has expired, so
    // asking per request is what keeps a long session writable.
    const getToken = () => user.getIdToken()
    // The uid goes along so both stores can tell "this device holds work the
    // account has never seen" from "this device is a stale copy of it" — the
    // difference between merging and honouring a deletion. See `sync-mark.ts`.
    void adoptAccount(accountBackend(getToken), uid).then(() => {
      // The merge may have brought in creatures made on another device; the
      // roster was built before any of them existed.
      gameRef.current?.refreshRoster()
    })
    // Independently of the chronicle: a shelf that fails to reach the account
    // still has whatever this browser kept, which is the anonymous-first
    // promise applied to worlds as well as to records.
    void adoptWorldsAccount(accountWorldsBackend(getToken), uid)
  }, [user])

  /**
   * Remove a creature the player made, and offer to put it back.
   *
   * The undo holds the whole archived record rather than the id, because the id
   * is gone the moment the species is forgotten — and the record carries the
   * history (`firstSeen`, `longestLife`) that the blueprint alone cannot
   * rebuild. Whatever was alive is not restored; the species goes back on the
   * shelf, which is the same thing a reload gives you.
   */
  const handleRemoveSpecies = useCallback(
    (blueprintId: string) => {
      const game = gameRef.current
      if (!game) return
      const record = game.removeSpecies(blueprintId)
      if (!record) return
      notify(`${record.blueprint.name} is gone.`, {
        label: 'Undo',
        run: () => {
          gameRef.current?.restoreSpecies(record)
          notify(`${record.blueprint.name} is back.`)
        },
      })
    },
    [notify]
  )

  /**
   * Put the world on screen on the shelf, or write the open one back by hand.
   *
   * The identity is minted here on the first save and reused forever after, so
   * "Save now" on an already-kept world updates it rather than filling the shelf
   * with copies. A failed write rolls the identity back — otherwise the game
   * would believe it was autosaving into a slot that does not exist.
   */
  const handleKeepWorld = useCallback(
    (name: string) => {
      const game = gameRef.current
      if (!game) return
      // Only reuse the slot if the shelf still agrees this world is in it.
      // Changing the theme, reshaping, or summoning new terrain all release the
      // active world, and reusing the id then would overwrite a kept world with
      // the one that replaced it.
      const previous = activeWorldId() === identityRef.current?.id ? identityRef.current : null
      const identity: SaveIdentity = previous
        ? { ...previous, name }
        : { id: newSaveId(), name, createdAt: Date.now() }
      identityRef.current = identity

      void keepWorld(game.toSave(identity))
        .then(() => notify(`${name} is kept. It will be waiting exactly like this.`))
        .catch(() => {
          identityRef.current = previous
          notify('The cave could not hold that world.')
        })
    },
    [notify]
  )

  /**
   * Leave the land on screen and pick a kept one back up.
   *
   * The outgoing world is written back first when it was itself shelved, so
   * hopping between two saved worlds never loses the one you hopped off.
   */
  const handleOpenWorld = useCallback(
    (id: string) => {
      void (async () => {
        await flushActiveWorld()
        const save = await readWorld(id)
        if (!save) {
          notify('That world could not be opened.')
          return
        }
        if (!gameRef.current?.adoptSave(save)) {
          notify('That world could not be opened.')
          return
        }
        identityRef.current = { id: save.id, name: save.name, createdAt: save.createdAt }
        // After `adoptSave`, which changes the theme and so releases whatever
        // world was active before it.
        setActiveWorld(save.id)
        notify(`${save.name} picks up where it left off.`)
      })()
    },
    [notify]
  )

  const handleForgetWorld = useCallback(
    (id: string) => {
      if (identityRef.current?.id === id) identityRef.current = null
      void removeWorld(id).then(() => notify('That world is off the shelf.'))
    },
    [notify]
  )

  const handleOpenHistory = useCallback(() => {
    const snapshots = gameRef.current?.getSnapshotHistory() ?? []
    if (snapshots.length === 0) {
      useMicroLand.getState().notify('No history yet — the world needs to run for at least 30 seconds.')
      return
    }
    useMicroLand.getState().enterReplay(snapshots)
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

  const handleRevise = useCallback((blueprintId: string, raw: unknown) => {
    return gameRef.current?.reviseSpecies(blueprintId, raw) ?? null
  }, [])

  const handleName = useCallback((name: string) => {
    const id = useMicroLand.getState().inspected?.id
    if (id == null) return false
    return gameRef.current?.nameCreature(id, name) ?? false
  }, [])

  const handleHoldPan = useCallback((direction: -1 | 0 | 1) => {
    gameRef.current?.holdPan(direction)
  }, [])

  const handleNudgePan = useCallback((direction: -1 | 1) => {
    gameRef.current?.nudgePan(direction)
  }, [])

  const handleZoom = useCallback((direction: 1 | -1) => {
    gameRef.current?.zoomByStep(direction)
  }, [])

  const handleApplyTerrain = useCallback((raw: unknown, keepCreatures: boolean) => {
    const game = gameRef.current
    if (!game) return null
    const terrain = game.applyTerrain(raw, { keepCreatures })
    return { name: terrain.name, fertile: hasFertileGround(terrain) }
  }, [])

  return (
    <div className="micro-land-shell flex h-full w-full flex-col overflow-hidden">
      <Hud onReshuffle={handleReshuffle} onClearLife={handleClearLife} onOpenHistory={handleOpenHistory} />

      <div className="relative min-h-0 flex-1">
        <canvas
          ref={canvasRef}
          // Focusable so the arrow keys reach it. The world is wider than the
          // screen, and a keyboard has to be able to get to the rest of it.
          tabIndex={0}
          className="absolute inset-0 block h-full w-full touch-none focus:outline-none"
          style={{ imageRendering: 'pixelated', cursor: 'crosshair' }}
          aria-label="Micro Land world. Tap to place things, drag a creature to pick it up and throw it. Arrow keys scroll across the world, plus and minus move closer and further away."
        />
        <PanControls onHold={handleHoldPan} onNudge={handleNudgePan} />
        <ZoomControls onZoom={handleZoom} />
        <Notices />
        <Inspector onName={handleName} />
      </div>

      <Toolbar onRemoveSpecies={handleRemoveSpecies} />
      <SummonPanel onIntroduce={handleIntroduce} onApplyTerrain={handleApplyTerrain} />
      <WorldsPanel onKeep={handleKeepWorld} onOpen={handleOpenWorld} onForget={handleForgetWorld} />
      <ChallengesPanel />
      <BlueprintWorkshop />
      <CreatureBuilder onIntroduce={handleIntroduce} onRevise={handleRevise} />
      <FieldGuide />
      <SettingsPanel />
      <ReplayBar />
      <PopulationGraph />
    </div>
  )
}
