import { useCallback, useEffect, useRef, useState } from 'react'

import { setMuted, sfx, unlock } from './lib/audio'
import { type GlyphPos, generateDeck, makeLayout, sharedGlyph, shuffle } from './lib/deck'
import {
  DIFFS,
  type DiffKey,
  GLYPHS,
  MAX_PLAYERS,
  PLAYER_COLORS,
  PLAYER_GLYPHS,
} from './lib/glyphs'

/* ---------------------------------------------------------------------------
   Starmatch — game state machine
   Ported from a self-contained imperative game. The whole match lives in a
   mutable ref so the (interdependent, timer-driven) callbacks always see fresh
   state with no stale closures; a snapshot is published to force each render.
   -------------------------------------------------------------------------- */

export interface Player {
  id: number
  name: string
  glyph: string
  color: string
  score: number
}

export type Phase = 'setup' | 'game' | 'win'
export type BannerKind = 'idle' | 'claim' | 'good' | 'bad'
export type MatchState = 'none' | 'hit' | 'reveal'

export interface Banner {
  text: string
  kind: BannerKind
  color?: string
}

export interface StarmatchState {
  phase: Phase
  players: Player[]
  diff: DiffKey
  target: number // 0 = endless
  muted: boolean
  symGlyph: string[]
  layoutA: GlyphPos[]
  layoutB: GlyphPos[]
  match: number
  activeClaimer: number | null
  locked: Record<number, boolean>
  resolving: boolean
  roundStart: number
  roundId: number
  matchState: MatchState
  shaking: boolean
  banner: Banner
  lastElapsed: number // seconds on the winning spot, for the banner
}

export const TARGET_OPTIONS: { value: number; label: string }[] = [
  { value: 3, label: 'First to 3' },
  { value: 5, label: 'First to 5' },
  { value: 10, label: 'First to 10' },
  { value: 0, label: 'Endless drift' },
]

let PID = 0
function mkPlayer(name: string, idx: number): Player {
  return {
    id: ++PID,
    name,
    glyph: PLAYER_GLYPHS[idx % PLAYER_GLYPHS.length],
    color: PLAYER_COLORS[idx % PLAYER_COLORS.length],
    score: 0,
  }
}

function initialState(): StarmatchState {
  return {
    phase: 'setup',
    players: [mkPlayer('Voyager 1', 0), mkPlayer('Voyager 2', 1)],
    diff: 'medium',
    target: 5,
    muted: false,
    symGlyph: [],
    layoutA: [],
    layoutB: [],
    match: -1,
    activeClaimer: null,
    locked: {},
    resolving: false,
    roundStart: 0,
    roundId: 0,
    matchState: 'none',
    shaking: false,
    banner: { text: '', kind: 'idle' },
    lastElapsed: 0,
  }
}

function computeBanner(s: StarmatchState): Banner {
  if (s.players.length === 1) {
    return { text: 'Trace the sign both charts share.', kind: 'idle' }
  }
  if (s.activeClaimer != null) {
    const p = s.players.find((x) => x.id === s.activeClaimer)
    if (p) return { text: `${p.glyph}  ${p.name} — spot it!`, kind: 'claim', color: p.color }
  }
  return { text: 'Buzz in — press your number, or tap your sigil.', kind: 'idle' }
}

export function useStarmatch(burst: (x: number, y: number, color?: string) => void) {
  // `snapshot` is the render-facing state; `s.current` is the mutable working
  // copy the (timer-driven, interdependent) handlers read & write so they never
  // see stale closures. Handlers mutate `s.current`, then publish a fresh
  // snapshot with `setSnapshot({ ...s.current })` to force the render.
  const [snapshot, setSnapshot] = useState<StarmatchState>(initialState)
  const s = useRef<StarmatchState>(snapshot)

  const roundTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const flashTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const burstTimers = useRef<ReturnType<typeof setTimeout>[]>([])
  // The deck is large and never rendered directly; keep it off the render state.
  const deckRef = useRef<number[][]>([])

  const clearTimers = useCallback(() => {
    if (roundTimer.current) clearTimeout(roundTimer.current)
    if (flashTimer.current) clearTimeout(flashTimer.current)
    roundTimer.current = null
    flashTimer.current = null
    burstTimers.current.forEach(clearTimeout)
    burstTimers.current = []
  }, [])

  useEffect(() => () => clearTimers(), [clearTimers])

  const flashBanner = useCallback((text: string, kind: BannerKind) => {
    s.current.banner = { text, kind }
    setSnapshot({ ...s.current })
    if (flashTimer.current) clearTimeout(flashTimer.current)
    flashTimer.current = setTimeout(() => {
      if (!s.current.resolving) {
        s.current.banner = computeBanner(s.current)
        setSnapshot({ ...s.current })
      }
    }, 1200)
  }, [])

  const nextRound = useCallback(() => {
    const st = s.current
    const deck = deckRef.current
    const i = Math.floor(Math.random() * deck.length)
    let j = i
    while (j === i) j = Math.floor(Math.random() * deck.length)
    const a = deck[i]
    const b = deck[j]
    st.match = sharedGlyph(a, b)
    st.layoutA = makeLayout(a)
    st.layoutB = makeLayout(b)
    st.activeClaimer = st.players.length === 1 ? st.players[0].id : null
    st.locked = {}
    st.resolving = false
    st.matchState = 'none'
    st.shaking = false
    st.roundStart = performance.now()
    st.roundId += 1
    st.banner = computeBanner(st)
    setSnapshot({ ...s.current })
  }, [])

  const startGame = useCallback(() => {
    unlock()
    const st = s.current
    st.players.forEach((p) => (p.score = 0))
    const d = DIFFS[st.diff]
    deckRef.current = generateDeck(d.order)
    st.symGlyph = shuffle(GLYPHS).slice(0, d.order * d.order + d.order + 1)
    st.phase = 'game'
    clearTimers()
    nextRound()
  }, [clearTimers, nextRound])

  const goToWin = useCallback(() => {
    const st = s.current
    st.phase = 'win'
    setSnapshot({ ...s.current })
    sfx.win()
    const ranked = [...st.players].sort((a, b) => b.score - a.score)
    burst(window.innerWidth / 2, window.innerHeight * 0.4, ranked[0]?.color)
    burstTimers.current.push(setTimeout(() => burst(window.innerWidth * 0.25, window.innerHeight * 0.5), 220))
    burstTimers.current.push(setTimeout(() => burst(window.innerWidth * 0.75, window.innerHeight * 0.5), 440))
  }, [burst])

  const award = useCallback(
    (id: number | null) => {
      const st = s.current
      st.resolving = true
      const p = st.players.find((x) => x.id === id)
      if (p) p.score += 1
      sfx.correct()
      st.matchState = 'hit'
      st.lastElapsed = (performance.now() - st.roundStart) / 1000
      st.banner = {
        text: p ? `${p.glyph} ${p.name} caught it! (${st.lastElapsed.toFixed(1)}s)` : 'Aligned!',
        kind: 'good',
      }
      setSnapshot({ ...s.current })
      burst(window.innerWidth / 2, window.innerHeight * 0.5, p?.color)

      if (st.target && p && p.score >= st.target) {
        roundTimer.current = setTimeout(goToWin, 1100)
      } else {
        roundTimer.current = setTimeout(nextRound, 1100)
      }
    },
    [burst, goToWin, nextRound]
  )

  const reveal = useCallback(() => {
    const st = s.current
    if (st.resolving) return
    st.resolving = true
    st.matchState = 'reveal'
    st.banner = { text: 'The shared sign surfaces…', kind: 'idle' }
    setSnapshot({ ...s.current })
    roundTimer.current = setTimeout(nextRound, 1500)
  }, [nextRound])

  const selectGlyph = useCallback(
    (sym: number) => {
      const st = s.current
      if (st.resolving) return
      const multi = st.players.length > 1
      if (multi && st.activeClaimer == null) {
        flashBanner('Buzz in first — press your number!', 'bad')
        return
      }
      const responder = st.activeClaimer
      if (sym === st.match) {
        award(responder)
        return
      }
      // wrong pick
      sfx.wrong()
      st.shaking = true
      if (multi && responder != null) {
        st.locked[responder] = true
        st.activeClaimer = null
        const alive = st.players.some((p) => !st.locked[p.id])
        if (!alive) {
          st.banner = { text: 'Every voyager is lost — revealing…', kind: 'bad' }
          setSnapshot({ ...s.current })
          roundTimer.current = setTimeout(reveal, 900)
        } else {
          st.banner = computeBanner(st)
          setSnapshot({ ...s.current })
        }
      } else {
        flashBanner('Not the one — keep searching.', 'bad')
        setSnapshot({ ...s.current })
      }
    },
    [award, flashBanner, reveal]
  )

  const buzz = useCallback((id: number) => {
    const st = s.current
    if (st.resolving || st.players.length === 1) return
    if (st.locked[id]) return
    unlock()
    if (st.activeClaimer === id) {
      st.activeClaimer = null // toggle off
    } else if (st.activeClaimer == null) {
      st.activeClaimer = id
      sfx.buzz()
    } else {
      return // someone else holds the buzzer
    }
    st.banner = computeBanner(st)
    setSnapshot({ ...s.current })
  }, [])

  const newPair = useCallback(() => {
    if (s.current.resolving) return
    clearTimers()
    nextRound()
  }, [clearTimers, nextRound])

  const clearShake = useCallback(() => {
    s.current.shaking = false
    setSnapshot({ ...s.current })
  }, [])

  const backToSetup = useCallback(() => {
    clearTimers()
    s.current.phase = 'setup'
    setSnapshot({ ...s.current })
  }, [clearTimers])

  const toggleMute = useCallback(() => {
    const st = s.current
    st.muted = !st.muted
    setMuted(st.muted)
    setSnapshot({ ...s.current })
  }, [])

  /* --- setup mutations ------------------------------------------------- */
  const setDiff = useCallback((diff: DiffKey) => {
    s.current.diff = diff
    setSnapshot({ ...s.current })
  }, [])

  const setTarget = useCallback((target: number) => {
    s.current.target = target
    setSnapshot({ ...s.current })
  }, [])

  const addPlayer = useCallback(() => {
    const st = s.current
    if (st.players.length >= MAX_PLAYERS) return
    st.players = [...st.players, mkPlayer(`Voyager ${st.players.length + 1}`, st.players.length)]
    setSnapshot({ ...s.current })
  }, [])

  const removePlayer = useCallback((id: number) => {
    const st = s.current
    if (st.players.length <= 1) return
    st.players = st.players.filter((p) => p.id !== id)
    setSnapshot({ ...s.current })
  }, [])

  const renamePlayer = useCallback((id: number, name: string) => {
    const p = s.current.players.find((x) => x.id === id)
    if (p) p.name = name
    setSnapshot({ ...s.current })
  }, [])

  const cyclePlayerLook = useCallback((id: number) => {
    const p = s.current.players.find((x) => x.id === id)
    if (!p) return
    const gi = PLAYER_GLYPHS.indexOf(p.glyph)
    p.glyph = PLAYER_GLYPHS[(gi + 1) % PLAYER_GLYPHS.length]
    const ci = PLAYER_COLORS.indexOf(p.color)
    p.color = PLAYER_COLORS[(ci + 1) % PLAYER_COLORS.length]
    setSnapshot({ ...s.current })
  }, [])

  /* --- keyboard: buzz (1-9), reveal (R), new pair (N) ------------------ */
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const st = s.current
      if (st.phase !== 'game') return
      if (e.key >= '1' && e.key <= '9') {
        const idx = parseInt(e.key, 10) - 1
        if (idx < st.players.length) {
          buzz(st.players[idx].id)
          e.preventDefault()
        }
      } else if (e.key === 'r' || e.key === 'R') {
        reveal()
      } else if (e.key === 'n' || e.key === 'N') {
        newPair()
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [buzz, reveal, newPair])

  return {
    state: snapshot,
    // game
    startGame,
    buzz,
    selectGlyph,
    reveal,
    newPair,
    clearShake,
    backToSetup,
    toggleMute,
    // setup
    setDiff,
    setTarget,
    addPlayer,
    removePlayer,
    renamePlayer,
    cyclePlayerLook,
  }
}
