/**
 * The one place Dicebound talks to the model.
 *
 * Both routes here need the same thing — a Messages call with tools, a
 * multi-turn tool loop, and honest failure — so it lives once rather than
 * twice.
 *
 * This calls the Messages API directly rather than going through the AI SDK,
 * for the same reason the Micro Land summon route does: `generateObject`
 * hard-codes `temperature: 0` (ai@4 — `temperature != null ? temperature : 0`,
 * with no way to omit it), and Claude Opus 5 removed the sampling parameters
 * and rejects the request outright. The SDK path can only reach this model by
 * downgrading it, and the dungeon master is the last thing in this app that
 * should be running on a smaller model.
 *
 * We still borrow the SDK's `zodSchema` for zod → JSON Schema, which delegates
 * to the same `zod-to-json-schema` the lockfile already pins at a version this
 * app's zod satisfies — a direct dependency on that package does not.
 */
import { zodSchema } from 'ai'

import type { z } from 'zod'

export const API_URL = 'https://api.anthropic.com/v1/messages'

/** The dungeon master and the character creator are both felt moments. */
export const DM_MODEL = 'claude-opus-5'

/**
 * Condensing old turns into a synopsis is bookkeeping the player never reads
 * directly, and it happens on a turn that is already slow. A smaller model is
 * the right trade here, and nowhere else that writes the story.
 */
export const UTILITY_MODEL = 'claude-sonnet-5'

/**
 * The three lines offered beside the composer.
 *
 * The smallest model in the family, and not a compromise. The job is to read
 * one scene and write three sentences a player might plausibly type — a
 * fraction of what the dungeon master is doing, with none of the arithmetic and
 * none of the world to keep. What it needs instead is speed: these arrive after
 * the narration the player is still reading, and a suggestion that lands after
 * they have already started typing may as well not have come at all.
 */
export const SUGGEST_MODEL = 'claude-haiku-4-5-20251001'

export interface ToolDef {
  name: string
  description: string
  input_schema: Record<string, unknown>
}

export type ContentBlock =
  | { type: 'text'; text: string }
  | { type: 'tool_use'; id: string; name: string; input: unknown }
  | { type: 'tool_result'; tool_use_id: string; content: string }
  | { type: string; [key: string]: unknown }

export interface Message {
  role: 'user' | 'assistant'
  content: string | ContentBlock[]
}

export interface ModelResponse {
  stop_reason?: string
  content?: ContentBlock[]
}

/** Raised when the safety classifiers decline. Callers answer in voice. */
export class RefusedError extends Error {
  constructor() {
    super('refused')
    this.name = 'RefusedError'
  }
}

export class NoApiKeyError extends Error {
  constructor() {
    super('ANTHROPIC_API_KEY is not set')
    this.name = 'NoApiKeyError'
  }
}

export function requireApiKey(): string {
  const key = process.env.ANTHROPIC_API_KEY
  if (!key) throw new NoApiKeyError()
  return key
}

/** zod → an Anthropic `input_schema`, with the meta-key Anthropic rejects removed. */
export function toolSchema(schema: z.ZodTypeAny): Record<string, unknown> {
  const { $schema, ...rest } = zodSchema(schema).jsonSchema as Record<string, unknown>
  void $schema
  return rest
}

export interface CallOptions {
  apiKey: string
  model?: string
  system: string
  messages: Message[]
  tools?: ToolDef[]
  toolChoice?: { type: 'tool'; name: string } | { type: 'auto' }
  maxTokens: number
  signal?: AbortSignal
}

/**
 * Statuses worth trying again.
 *
 * 529 is the one that actually bites: a 20-turn measured run lost 8 of its
 * turns to `overloaded_error` in a single afternoon, and each one reached the
 * player as "The telling faltered." Overload is a statement about the next few
 * seconds, not about the request, so the request is still good.
 *
 * 429 is here because a rate limit answers the same way, and the 5xx family
 * because a gateway that could not reach the model has told us nothing about
 * whether the model would have answered. Everything else — 400, 401, 403 — is
 * a fact about the request, and sending it again is just a slower failure.
 */
const RETRY_STATUSES = new Set([429, 500, 502, 503, 504, 529])

/** Attempts in total, not retries after the first. */
const MAX_ATTEMPTS = 3

/** Doubling from here. Short, because a turn is already the slowest thing here. */
const RETRY_BASE_MS = 600

/** The longest any single wait may be, however long the server asks for. */
const RETRY_CAP_MS = 2_000

function retryDelay(attempt: number, header: string | null): number {
  // `retry-after` is the server saying how long it actually needs. Prefer it
  // over guessing, but cap it hard. A turn can make several model calls, each
  // of which may retry, inside a 105-second deadline — so an honest 600-second
  // hint is simply not usable here, and waiting even five would eat the budget
  // the player is actually waiting on.
  const advised = Number(header)
  if (Number.isFinite(advised) && advised > 0) return Math.min(advised * 1000, RETRY_CAP_MS)
  return RETRY_BASE_MS * 2 ** attempt
}

function sleep(ms: number, signal?: AbortSignal): Promise<void> {
  return new Promise((resolve, reject) => {
    if (signal?.aborted) {
      reject(new DOMException('Aborted', 'AbortError'))
      return
    }
    const timer = setTimeout(() => {
      signal?.removeEventListener('abort', onAbort)
      resolve()
    }, ms)
    function onAbort() {
      clearTimeout(timer)
      reject(new DOMException('Aborted', 'AbortError'))
    }
    signal?.addEventListener('abort', onAbort, { once: true })
  })
}

/**
 * One call to the model, retried when the failure was about the moment rather
 * than the request.
 *
 * Retrying lives here rather than in the turn loop because every path through
 * the game funnels through this function — a turn, a condense, a
 * reconciliation, building a character — and a transient failure in any of them
 * is equally recoverable and equally invisible to the player. The alternative
 * was four call sites each deciding for themselves.
 *
 * The caller's abort signal still bounds the whole thing. A turn has a hard
 * deadline, and a retry that would land after it is worse than no retry: the
 * player has already been waiting, and the answer would arrive to nobody.
 */
export async function callModel(options: CallOptions): Promise<ModelResponse> {
  let lastError: Error | undefined

  for (let attempt = 0; attempt < MAX_ATTEMPTS; attempt++) {
    const response = await fetch(API_URL, {
      method: 'POST',
      signal: options.signal,
      headers: {
        'x-api-key': options.apiKey,
        'anthropic-version': '2023-06-01',
        'content-type': 'application/json',
      },
      body: JSON.stringify({
        model: options.model ?? DM_MODEL,
        max_tokens: options.maxTokens,
        system: options.system,
        messages: options.messages,
        ...(options.tools ? { tools: options.tools } : {}),
        ...(options.toolChoice ? { tool_choice: options.toolChoice } : {}),
      }),
    })

    if (response.ok) {
      const data = (await response.json()) as ModelResponse
      // A refusal is a decision, not a hiccup. Asking again would get the same
      // answer more slowly, and the caller already answers it in voice.
      if (data.stop_reason === 'refusal') throw new RefusedError()
      return data
    }

    const detail = await response.text()
    lastError = new Error(`anthropic ${response.status}: ${detail.slice(0, 300)}`)

    const last = attempt === MAX_ATTEMPTS - 1
    if (!RETRY_STATUSES.has(response.status) || last) break

    await sleep(retryDelay(attempt, response.headers.get('retry-after')), options.signal)
  }

  throw lastError ?? new Error('anthropic call failed')
}

/** Force one tool call and hand back its input verbatim. */
export async function callForTool(
  options: Omit<CallOptions, 'tools' | 'toolChoice'> & { tool: ToolDef }
): Promise<unknown> {
  const data = await callModel({
    ...options,
    tools: [options.tool],
    toolChoice: { type: 'tool', name: options.tool.name },
  })

  const block = data.content?.find(b => b.type === 'tool_use' && b.name === options.tool.name)
  const input = (block as { input?: unknown } | undefined)?.input
  if (input === undefined) throw new Error('no tool_use block in response')
  return input
}

/** All text blocks in a response, joined. */
export function textOf(data: ModelResponse): string {
  return (data.content ?? [])
    .filter((b): b is { type: 'text'; text: string } => b.type === 'text')
    .map(b => b.text)
    .join('\n')
    .trim()
}

/** Every tool_use block in a response, in order. */
export function toolUses(data: ModelResponse): { id: string; name: string; input: unknown }[] {
  return (data.content ?? []).filter(
    (b): b is { type: 'tool_use'; id: string; name: string; input: unknown } =>
      b.type === 'tool_use'
  )
}
