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

const SUGGESTIONS_HIDDEN_KEY = 'dicebound:suggestions-hidden'

function readSuggestionsHidden(): boolean {
  if (typeof window === 'undefined') return false
  try {
    return window.localStorage.getItem(SUGGESTIONS_HIDDEN_KEY) === 'true'
  } catch {
    return false
  }
}

function writeSuggestionsHidden(hidden: boolean): void {
  try {
    if (hidden) {
      window.localStorage.setItem(SUGGESTIONS_HIDDEN_KEY, 'true')
    } else {
      window.localStorage.removeItem(SUGGESTIONS_HIDDEN_KEY)
    }
  } catch {
    // storage blocked — preference is session-only
  }
}

import { getTodayPST, getYesterdayOf } from '@/lib/dates'

import { createCharacter, fetchSuggestions, takeTurn } from './api'
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
  /**
   * Three things the player might try, for the composer to offer.
   *
   * They belong to the scene rather than to the campaign, so they live here and
   * are never saved. Deliberately *not* cleared when the player acts: the old
   * three stay on screen, greyed and untappable, until the new three replace
   * them. Clearing would collapse the row and shove the composer down the
   * screen twice a turn, which on a phone means the send button moves under a
   * thumb that is already reaching for it.
   */
  suggestions: string[]
  /**
   * Which request the suggestions on screen belong to.
   *
   * A turn takes real seconds and a suggestion call is fired after every one of
   * them, so two can easily be in flight across a fast player's turn. Only the
   * newest may land — an older one arriving late would offer moves for a scene
   * that is already two paragraphs back.
   */
  suggestSeq: number
  suggestionsHidden: boolean

  attach: (backend: CampaignBackend) => Promise<void>
  begin: (premise: string, concept: string) => Promise<void>
  act: (action: string) => Promise<void>
  abandon: () => Promise<void>
  dismissError: () => void
  /** Ask for a fresh three. Called by the store itself after anything that moves the story. */
  refreshSuggestions: () => Promise<void>
  toggleSuggestions: () => void
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
  suggestions: [],
  suggestSeq: 0,
  suggestionsHidden: readSuggestionsHidden(),

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
      set({ phase: 'creating', campaign: null, suggestions: [] })
      return
    }

    const today = getTodayPST()
    const visited = withVisit(stored, today, getYesterdayOf(today))
    set({ phase: 'playing', campaign: visited })
    if (visited !== stored) void backend.save(visited)

    // A returning player finds the three under the scene they left on, rather
    // than an empty rail until they have taken one more turn (CLAUDE.md 3).
    void get().refreshSuggestions()
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

      const token = await get().backend.token()
      const { result, campaign: authoritative } = await takeTurn('', { token, campaign })
      const opened = authoritative ?? applyTurn(campaign, result, Date.now())

      set({ campaign: opened, pending: false })
      // Only the local path still writes from here. On the authoritative path
      // the server already saved before it answered, and saving again would
      // send the whole campaign straight back to the endpoint this change
      // exists to stop trusting.
      if (!authoritative) void get().backend.save(opened)
      void get().refreshSuggestions()
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
      const token = await get().backend.token()
      // `campaign` here is the pre-optimistic one on purpose. On the local path
      // it is what the result gets applied to, and applying a turn to a
      // campaign that already contains the player's line would record it twice.
      const { result, campaign: authoritative } = await takeTurn(text, { token, campaign })
      const next = authoritative ?? applyTurn(campaign, result, Date.now())

      set({ campaign: next, pending: false })
      if (!authoritative) void get().backend.save(next)
      // Fired after the turn is on screen, never awaited. The player is
      // already reading; the three arrive underneath them a beat later and the
      // turn never waits on a model whose answer it does not need.
      void get().refreshSuggestions()
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
    // The sequence moves so a call still in flight for the abandoned story
    // cannot land on the next one.
    set({
      phase: 'creating',
      campaign: null,
      error: null,
      suggestions: [],
      suggestSeq: get().suggestSeq + 1,
    })
    await get().backend.clear()
  },

  dismissError() {
    set({ error: null })
  },

  async refreshSuggestions() {
    const campaign = get().campaign
    if (!campaign || campaign.transcript.length === 0) return
    if (get().suggestionsHidden) return

    const seq = get().suggestSeq + 1
    set({ suggestSeq: seq })

    const token = await get().backend.token()
    const suggestions = await fetchSuggestions({ token, campaign })

    // A newer turn has already asked, or the story was abandoned underneath
    // this. Either way these are about a scene that has moved on.
    if (get().suggestSeq !== seq) return
    set({ suggestions })
  },

  toggleSuggestions() {
    const hidden = !get().suggestionsHidden
    writeSuggestionsHidden(hidden)
    if (hidden) {
      // Collapsing: bump seq so any in-flight fetch is discarded
      set({ suggestionsHidden: true, suggestSeq: get().suggestSeq + 1 })
    } else {
      // Expanding: fetch fresh suggestions
      set({ suggestionsHidden: false })
      void get().refreshSuggestions()
    }
  },
}))
