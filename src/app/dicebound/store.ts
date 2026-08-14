/**
 * The game's state, and the only place turns are sequenced.
 *
 * Everything a component needs is here, and everything that mutates a campaign
 * goes through one of these actions. The important invariant is `pending`: the
 * dungeon master takes real seconds to answer, and a second action sent during
 * that window would resolve against a campaign that no longer exists by the
 * time it lands. Every entry point checks it and returns.
 *
 * Persistence is fire-and-forget after each turn. The backend swallows its own
 * failures (see `backend.ts`), so a save that doesn't land costs the player
 * nothing — the next turn writes the whole campaign again.
 */
import { create } from 'zustand'

import { getTodayPST, getYesterdayOf } from '@/lib/dates'

import { createCharacter, takeTurn } from './api'
import { type CampaignBackend, nullBackend } from './backend'
import { type Campaign, MAX_CONCEPT, MAX_PREMISE, newCampaign, withVisit } from './domain/campaign'
import { applyTurn } from './domain/turn'

import type { Character } from './domain/character'

export type Phase = 'loading' | 'creating' | 'playing'

interface DiceboundState {
  phase: Phase
  campaign: Campaign | null
  /** True while the dungeon master is answering. Blocks every other action. */
  pending: boolean
  /** In-character error text, cleared on the next successful action. */
  error: string | null
  backend: CampaignBackend

  attach: (backend: CampaignBackend) => Promise<void>
  begin: (premise: string, concept: string) => Promise<void>
  act: (action: string) => Promise<void>
  abandon: () => Promise<void>
  dismissError: () => void
}

function freshCampaign(premise: string, character: Character, now: number): Campaign {
  return newCampaign(premise, character, now, getTodayPST())
}

export const useDicebound = create<DiceboundState>((set, get) => ({
  phase: 'loading',
  campaign: null,
  pending: false,
  error: null,
  backend: nullBackend,

  /**
   * Point the store at storage and load whatever is there.
   *
   * Called again whenever the signed-in user changes, which is why the visit
   * is folded in here: arriving is what extends a run-loop streak, not
   * finishing anything (see "Session shapes" in interaction-models.md).
   */
  async attach(backend) {
    set({ backend })
    const stored = await backend.load()

    if (!stored) {
      set({ phase: 'creating', campaign: null })
      return
    }

    const today = getTodayPST()
    const visited = withVisit(stored, today, getYesterdayOf(today))
    set({ phase: 'playing', campaign: visited })
    if (visited !== stored) void backend.save(visited)
  },

  async begin(premise, concept) {
    if (get().pending) return
    set({ pending: true, error: null })

    try {
      const trimmedPremise = premise.trim().slice(0, MAX_PREMISE)
      const character = await createCharacter(concept.trim().slice(0, MAX_CONCEPT), trimmedPremise)
      const campaign = freshCampaign(trimmedPremise, character, Date.now())

      // Straight into the opening scene. A character sheet with no story
      // attached is a form the player just filled in; the first paragraph is
      // what makes it a person.
      set({ campaign, phase: 'playing' })
      const result = await takeTurn(campaign, '')
      const opened = applyTurn(campaign, result, Date.now())

      set({ campaign: opened, pending: false })
      void get().backend.save(opened)
    } catch (error) {
      set({
        pending: false,
        phase: get().campaign ? 'playing' : 'creating',
        error: error instanceof Error ? error.message : 'The cave is quiet. Try again.',
      })
    }
  },

  async act(action) {
    const { campaign, pending } = get()
    if (!campaign || pending) return

    const text = action.trim()
    if (!text) return

    set({ pending: true, error: null })

    // The player's own line appears immediately, before the DM has answered.
    // Waiting to render it until the whole turn resolves makes the game feel
    // like it dropped the input.
    set({
      campaign: { ...campaign, transcript: [...campaign.transcript, { kind: 'player', text }] },
    })

    try {
      const result = await takeTurn(campaign, text)
      const next = applyTurn(campaign, result, Date.now())
      set({ campaign: next, pending: false })
      void get().backend.save(next)
    } catch (error) {
      // Roll the optimistic line back out, so the player can edit and resend
      // rather than staring at an action the story never received.
      set({
        campaign,
        pending: false,
        error: error instanceof Error ? error.message : 'The telling faltered. Try that again.',
      })
    }
  },

  async abandon() {
    if (get().pending) return
    set({ phase: 'creating', campaign: null, error: null })
    await get().backend.clear()
  },

  dismissError() {
    set({ error: null })
  },
}))
