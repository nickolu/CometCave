import { type AiFeature } from '@/lib/ai/limits'

import { mockDescribeLine, mockImageDataUrl } from '../mock'
import {
  IMAGE_MIME,
  IMAGE_REJECTED_MESSAGE,
  MAX_DESCRIBE_IMAGE_CHARS,
  MAX_MODERATE_TEXT,
  MAX_SENTENCE_RAW,
  SAFE_SCENE_SENTENCE,
  TEXT_REJECTED_MESSAGE,
  imageModel,
} from '../safety/config'
import { cleanDescription, describeWithPersona } from '../safety/describe'
import { isMockMode } from '../safety/mock-mode'
import { type ModerationFn, isUnavailable, moderateImage } from '../safety/moderate'
import { REWRITE_SYSTEM, STARTER_SYSTEM, isKnownPersona, personaSystem } from '../safety/personas'
import { buildImagePrompt, buildSaferPrompt } from '../safety/prompt'
import { getSigningKey, imageDigest, parseImageDataUrl, signImage, verifyImage } from '../safety/signing'
import { type TextVerdict, checkTextSafety } from '../safety/text-safety'
import { cleanSentence } from '../settings'
import { STARTER_THEMES, randomStarter } from '../starters'

import type { AuthClaims } from '@/lib/users/profile'

/* The four routes' logic, with every outside thing injected. The route files
   only wire the real dependencies in, so this is what the tests exercise.

   Order of operations, so rejected input costs nothing:
   sign-in -> validate -> flags -> text safety -> spend -> model call. */

type Env = Record<string, string | undefined>

export class ContentPolicyError extends Error {
  constructor() {
    super('content policy')
    this.name = 'ContentPolicyError'
  }
}

export interface TextRequest {
  system: string
  user: string
  image?: { base64: string; mime: string }
  maxTokens: number
  temperature: number
}

export interface Deps {
  env: Env
  requireSignedIn(request: Request): Promise<{ claims: AuthClaims } | { error: Response }>
  spend(claims: AuthClaims, feature: AiFeature): Promise<{ error: Response } | null>
  moderation: ModerationFn
  imageGenerationAllowed(): boolean
  imageDisableReason(): string
  /** Returns base64 jpeg bytes. Throws ContentPolicyError for a policy refusal, anything else is upstream. */
  generateImage(prompt: string, model: string): Promise<string>
  completeText(req: TextRequest): Promise<string>
  checkModerateLimit(uid: string): Promise<{ limited: boolean }>
  random(): number
}

function json(body: Record<string, unknown>, status = 200): Response {
  return Response.json(body, { status })
}

function fail(status: number, code: string, error: string, retryable = false): Response {
  return json({ error, code, retryable }, status)
}

const badRequest = (msg: string) => fail(400, 'BAD_REQUEST', msg)
const textRejected = () => fail(422, 'TEXT_REJECTED', TEXT_REJECTED_MESSAGE)
const moderationDown = () =>
  fail(503, 'MODERATION_UNAVAILABLE', 'The picture checker is not available right now. Try again in a minute.', true)
const notConfigured = () => fail(503, 'NOT_CONFIGURED', 'Picture Telephone is not set up on this server yet.')
const upstream = () => fail(502, 'UPSTREAM', 'The artist got stuck. Try again.', true)

async function readJson(request: Request): Promise<Record<string, unknown> | null> {
  const body: unknown = await request.json().catch(() => null)
  return body && typeof body === 'object' && !Array.isArray(body) ? (body as Record<string, unknown>) : null
}

/** Text layers for a human or model sentence. Mock mode runs the blocklist only. */
function textVerdict(deps: Deps, text: string): Promise<TextVerdict> {
  return checkTextSafety(text, isMockMode(deps.env) ? null : deps.moderation)
}

function verdictResponse(v: Extract<TextVerdict, { ok: false }>): Response {
  return v.reason === 'unavailable' ? moderationDown() : textRejected()
}

/** Never log prompts, sentences or messages: names and status only. */
function logFailure(where: string, err: unknown): void {
  const e = err as { name?: string; status?: number; code?: string } | null
  console.error(`[picture-telephone] ${where} failed`, { name: e?.name, status: e?.status, code: e?.code })
}

/* ------------------------------------------------------------------ image */

type Attempt = { kind: 'ok'; b64: string } | { kind: 'content' } | { kind: 'unavailable' }

async function attemptImage(deps: Deps, prompt: string): Promise<Attempt> {
  let b64: string
  try {
    b64 = await deps.generateImage(prompt, imageModel(deps.env))
  } catch (err) {
    if (err instanceof ContentPolicyError) return { kind: 'content' }
    throw err
  }
  const decision = await moderateImage(`data:${IMAGE_MIME};base64,${b64}`, deps.moderation)
  if (decision.allowed) return { kind: 'ok', b64 }
  return { kind: isUnavailable(decision) ? 'unavailable' : 'content' }
}

async function saferSentence(deps: Deps, sentence: string): Promise<string> {
  try {
    const raw = await deps.completeText({
      system: REWRITE_SYSTEM,
      user: `Sentence to rewrite:\n"""\n${sentence}\n"""`,
      maxTokens: 60,
      temperature: 0.5,
    })
    const rewritten = cleanSentence(raw.split(/\r?\n/)[0].replace(/^["'\s]+|["'\s]+$/g, ''))
    if (!rewritten) return SAFE_SCENE_SENTENCE
    const verdict = await textVerdict(deps, rewritten)
    return verdict.ok ? rewritten : SAFE_SCENE_SENTENCE
  } catch (err) {
    logFailure('rewrite', err)
    return SAFE_SCENE_SENTENCE
  }
}

export async function handleImage(request: Request, deps: Deps): Promise<Response> {
  const gate = await deps.requireSignedIn(request)
  if ('error' in gate) return gate.error

  const body = await readJson(request)
  if (!body || typeof body.sentence !== 'string' || body.sentence.length > MAX_SENTENCE_RAW) {
    return badRequest('A sentence is required.')
  }
  const sentence = cleanSentence(body.sentence)
  if (!sentence) return textRejected()

  const mock = isMockMode(deps.env)
  if (!mock && !deps.imageGenerationAllowed()) {
    return fail(403, 'IMAGES_DISABLED', deps.imageDisableReason())
  }

  const verdict = await textVerdict(deps, sentence)
  if (!verdict.ok) return verdictResponse(verdict)

  if (mock) {
    // SVG is not describable by the real model, so mock pictures carry no signature.
    return json({ image: mockImageDataUrl(sentence), signature: null, mock: true })
  }

  const key = getSigningKey(deps.env)
  if (!key) return notConfigured()

  const spent = await deps.spend(gate.claims, 'picture-telephone-image')
  if (spent) return spent.error

  try {
    let result = await attemptImage(deps, buildImagePrompt(sentence))
    if (result.kind === 'content') {
      // One regenerate, from a gentler rewrite of the sentence.
      const safer = await saferSentence(deps, sentence)
      result = await attemptImage(deps, buildSaferPrompt(safer))
    }
    if (result.kind === 'unavailable') return moderationDown()
    if (result.kind === 'content') return fail(422, 'IMAGE_REJECTED', IMAGE_REJECTED_MESSAGE)

    const signature = signImage(Buffer.from(result.b64, 'base64'), key)
    return json({ image: `data:${IMAGE_MIME};base64,${result.b64}`, signature, mock: false })
  } catch (err) {
    logFailure('image', err)
    return upstream()
  }
}

/* --------------------------------------------------------------- describe */

export async function handleDescribe(request: Request, deps: Deps): Promise<Response> {
  const gate = await deps.requireSignedIn(request)
  if ('error' in gate) return gate.error

  const body = await readJson(request)
  if (!body || !isKnownPersona(body.personalityId)) return badRequest('Unknown player.')
  const personalityId = body.personalityId
  const parsed = parseImageDataUrl(body.image, MAX_DESCRIBE_IMAGE_CHARS)

  if (isMockMode(deps.env)) {
    // Mock pictures are SVG and carry no signature; no model is called.
    return json({ text: mockDescribeLine(personalityId, typeof body.image === 'string' ? body.image : ''), mock: true })
  }

  if (!parsed) return badRequest('A picture is required.')
  const key = getSigningKey(deps.env)
  if (!key) return notConfigured()
  if (!verifyImage(parsed.bytes, body.signature, key)) {
    return fail(403, 'IMAGE_NOT_SIGNED', 'That picture did not come from this game.')
  }

  const spent = await deps.spend(gate.claims, 'picture-telephone-describe')
  if (spent) return spent.error

  try {
    const base64 = parsed.bytes.toString('base64')
    const seed = parseInt(imageDigest(parsed.bytes).slice(0, 8), 16)
    const outcome = await describeWithPersona(personalityId, {
      seed,
      model: extra =>
        deps.completeText({
          system: personaSystem(personalityId, extra),
          user: 'Describe this picture.',
          image: { base64, mime: parsed.mime },
          maxTokens: 60,
          temperature: 0.9,
        }),
      check: text => textVerdict(deps, text),
    })
    if (!outcome.ok) return moderationDown()
    return json({ text: outcome.text, fallback: outcome.fallback })
  } catch (err) {
    logFailure('describe', err)
    return upstream()
  }
}

/* ---------------------------------------------------------------- starter */

export async function handleStarter(request: Request, deps: Deps): Promise<Response> {
  const gate = await deps.requireSignedIn(request)
  if ('error' in gate) return gate.error

  if (isMockMode(deps.env)) return json({ text: randomStarter(deps.random), mock: true })

  const spent = await deps.spend(gate.claims, 'picture-telephone-starter')
  if (spent) return spent.error

  // Curated sentences are hand-written and trusted, so they are the safe fallback.
  const curated = () => json({ text: randomStarter(deps.random), fallback: true })
  try {
    const theme = STARTER_THEMES[Math.floor(deps.random() * STARTER_THEMES.length)]
    const raw = await deps.completeText({
      system: STARTER_SYSTEM,
      user: `Theme: ${theme}`,
      maxTokens: 60,
      temperature: 1,
    })
    const text = cleanDescription(raw)
    if (!text) return curated()
    const verdict = await textVerdict(deps, text)
    return verdict.ok ? json({ text, fallback: false }) : curated()
  } catch (err) {
    logFailure('starter', err)
    return curated()
  }
}

/* --------------------------------------------------------------- moderate */

export async function handleModerate(request: Request, deps: Deps): Promise<Response> {
  const gate = await deps.requireSignedIn(request)
  if ('error' in gate) return gate.error

  const body = await readJson(request)
  if (!body || typeof body.text !== 'string' || body.text.length > MAX_MODERATE_TEXT) {
    return badRequest('Text is required.')
  }

  try {
    const { limited } = await deps.checkModerateLimit(gate.claims.uid)
    if (limited) return fail(429, 'RATE_LIMITED', 'Slow down a little and try again soon.', true)
  } catch (err) {
    // Cannot count, so cannot allow.
    logFailure('moderate-limit', err)
    return moderationDown()
  }

  const text = cleanSentence(body.text)
  if (!text) return json({ ok: false, reason: 'blocked', message: TEXT_REJECTED_MESSAGE })
  const verdict = await textVerdict(deps, text)
  if (verdict.ok) return json({ ok: true })
  if (verdict.reason === 'unavailable') return moderationDown()
  return json({ ok: false, reason: verdict.reason, message: TEXT_REJECTED_MESSAGE })
}
