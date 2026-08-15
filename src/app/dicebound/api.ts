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

export interface TurnResponse {
  result: TurnResult
  /**
   * The campaign the server saved. Present only on the authoritative path —
   * when it is here, it replaces whatever the client was holding, and the
   * client does not apply the result itself.
   */
  campaign?: Campaign
}

/**
 * Take a turn.
 *
 * With a token the body is a sentence: the server loads its own campaign,
 * resolves against that, saves, and returns what it saved.
 *
 * The one exception is the opening turn, which carries the campaign character
 * creation just built, because the server has nothing to load yet. Every turn
 * after that sends the action alone — which is the point, since a campaign
 * grows to six figures of bytes and was being uploaded on every line the player
 * typed.
 *
 * Without a token there is no server-side story, so the old shape stands: send
 * the campaign, get a result, apply it here.
 */
export async function takeTurn(
  action: string,
  { token, campaign }: { token: string | null; campaign: Campaign }
): Promise<TurnResponse> {
  const creating = campaign.transcript.length === 0
  const body = token ? (creating ? { action, campaign } : { action }) : { campaign, action }

  const response = await fetch('/api/v1/dicebound/turn', {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    body: JSON.stringify(body),
  })

  if (!response.ok) {
    throw await errorFrom(response, 'The telling faltered. Try that again.')
  }

  return (await response.json()) as TurnResponse
}

/**
 * Three things the player might try next.
 *
 * The one call in this file that cannot fail. Everything else here throws so
 * the store can put an in-character line in front of the player; this returns
 * an empty list instead, because there is no failure worth telling them about.
 * The suggestions are an offer beside a working game, and a player who never
 * finds out they were meant to be there has lost nothing — whereas "the cave
 * could not think of anything" over a story that is fine would be pure noise.
 *
 * Same two shapes as a turn: with a token the server loads its own campaign and
 * the body is empty, without one there is no server-side story to read.
 */
export async function fetchSuggestions({
  token,
  campaign,
}: {
  token: string | null
  campaign: Campaign
}): Promise<string[]> {
  try {
    const response = await fetch('/api/v1/dicebound/suggest', {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
      body: JSON.stringify(token ? {} : { campaign }),
    })

    if (!response.ok) return []

    const body = (await response.json()) as { suggestions?: unknown }
    return Array.isArray(body.suggestions)
      ? body.suggestions.filter((line): line is string => typeof line === 'string')
      : []
  } catch {
    return []
  }
}
