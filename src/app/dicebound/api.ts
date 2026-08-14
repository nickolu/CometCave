/**
 * The two calls that make the game happen: build a character, take a turn.
 *
 * Thin on purpose. Both routes already own their validation, their fallbacks
 * and their voice, so there is nothing to do here but carry JSON and turn a
 * non-OK response into a thrown `TurnError` the UI can render in character.
 */
import type { Campaign } from './domain/campaign'
import type { Character } from './domain/character'
import type { TurnResult } from './domain/turn'

export class TurnError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'TurnError'
  }
}

async function errorFrom(response: Response, fallback: string): Promise<TurnError> {
  try {
    const body = (await response.json()) as { error?: unknown }
    return new TurnError(typeof body.error === 'string' ? body.error : fallback)
  } catch {
    return new TurnError(fallback)
  }
}

export async function createCharacter(concept: string, premise: string): Promise<Character> {
  const response = await fetch('/api/v1/dicebound/character', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ concept, premise }),
  })

  if (!response.ok) {
    throw await errorFrom(response, 'The cave could not picture you. Try again.')
  }

  const body = (await response.json()) as { character: Character }
  return body.character
}

export async function takeTurn(campaign: Campaign, action: string): Promise<TurnResult> {
  const response = await fetch('/api/v1/dicebound/turn', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ campaign, action }),
  })

  if (!response.ok) {
    throw await errorFrom(response, 'The telling faltered. Try that again.')
  }

  const body = (await response.json()) as { result: TurnResult }
  return body.result
}
