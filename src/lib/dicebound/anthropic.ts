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
 * the right trade here and nowhere else in this game.
 */
export const UTILITY_MODEL = 'claude-sonnet-5'

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

export async function callModel(options: CallOptions): Promise<ModelResponse> {
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

  if (!response.ok) {
    const detail = await response.text()
    throw new Error(`anthropic ${response.status}: ${detail.slice(0, 300)}`)
  }

  const data = (await response.json()) as ModelResponse
  if (data.stop_reason === 'refusal') throw new RefusedError()
  return data
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
