/* ---------------------------------------------------------------------------
   Blanks — the story template and the finished story.

   A template is a story with holes in it. The model writes the prose with
   the hint for each missing word inside a marker, `{{plural noun}}` or
   `{{a type of soup}}`; `parseTemplate` turns that into segments the client
   can walk without ever parsing text itself, and refuses anything malformed
   so a bad generation is retried instead of shown. (An earlier shape kept the
   hints in a separate numbered list; the model could not keep the two in
   step, so the hint now lives where the blank is.)

   A finished story is small enough to live in a link (`/blanks#s=…`), so a
   shared story can be read by anyone without an account and without a model
   call. Everything decoded from a link is untrusted: lengths are capped and
   shapes checked, and `decodeShared` returns null rather than a half story.
   -------------------------------------------------------------------------- */

export const MIN_BLANKS = 6
export const MAX_BLANKS = 20
export const TOPIC_MAX_CHARS = 80
export const WORD_MAX_CHARS = 40
const HINT_MAX_CHARS = 60
const TITLE_MAX_CHARS = 120
const TEXT_MAX_CHARS = 4000
const MAX_LINK_CHARS = 12000

export type Segment = { kind: 'text'; text: string } | { kind: 'blank'; hint: string }

export interface StoryTemplate {
  title: string
  segments: Segment[]
  /** Hints in the order the blanks appear in the story. */
  hints: string[]
}

/** What the model hands back before it is checked. */
export interface RawTemplate {
  title: string
  story: string
}

const MARKER = /\{\{([^{}]*)\}\}/g

function tidy(s: string): string {
  return s.replace(/\s+/g, ' ').trim()
}

/** "3: plural noun" and "plural noun" both mean plural noun. */
function cleanHint(inner: string): string {
  return tidy(inner.replace(/^\s*\d+\s*[:.)-]?\s*/, '')).replace(/[.:]+$/, '')
}

/**
 * Turn the model's marked-up story into segments. Returns null when it cannot
 * be played: too few or too many blanks, an empty or overlong hint, stray
 * braces, or barely any prose around the holes.
 */
export function parseTemplate(raw: RawTemplate): StoryTemplate | null {
  const title = tidy(raw.title ?? '').slice(0, TITLE_MAX_CHARS)
  if (!title) return null

  const story = (raw.story ?? '').replace(/\r\n?/g, '\n').trim()
  if (story.length > TEXT_MAX_CHARS) return null

  const segments: Segment[] = []
  const hints: string[] = []
  let prose = 0
  let last = 0
  for (const match of story.matchAll(MARKER)) {
    const hint = cleanHint(match[1])
    if (!hint || hint.length > HINT_MAX_CHARS) return null
    const text = story.slice(last, match.index)
    if (text) {
      segments.push({ kind: 'text', text })
      prose += text.trim().length
    }
    segments.push({ kind: 'blank', hint })
    hints.push(hint)
    last = match.index + match[0].length
  }
  const tail = story.slice(last)
  if (tail) {
    segments.push({ kind: 'text', text: tail })
    prose += tail.trim().length
  }

  if (hints.length < MIN_BLANKS || hints.length > MAX_BLANKS) return null
  if (prose < 120) return null
  if (/[{}]/.test(segments.map(s => (s.kind === 'text' ? s.text : '')).join(''))) return null

  return { title, segments, hints }
}

/** Trim a player's topic to something the prompt can carry. Empty means "no topic". */
export function cleanTopic(input: unknown): string {
  if (typeof input !== 'string') return ''
  return tidy(input.replace(/[\u0000-\u001f\u007f]/g, ' ')).slice(0, TOPIC_MAX_CHARS)
}

export function cleanWord(input: string): string {
  return tidy(input).slice(0, WORD_MAX_CHARS)
}

/* --- Finished stories and share links --------------------------------- */

export type FilledPart =
  | { kind: 'text'; text: string }
  | { kind: 'word'; hint: string; word: string }

export interface FilledStory {
  title: string
  parts: FilledPart[]
}

export function fillTemplate(template: StoryTemplate, words: string[]): FilledStory {
  let i = 0
  const parts: FilledPart[] = template.segments.map(seg =>
    seg.kind === 'text'
      ? { kind: 'text', text: seg.text }
      : { kind: 'word', hint: seg.hint, word: cleanWord(words[i++] ?? '') || '____' }
  )
  return { title: template.title, parts }
}

/** The story as plain text, for the clipboard and the share sheet. */
export function storyText(story: FilledStory): string {
  return `${story.title}\n\n${story.parts.map(p => (p.kind === 'text' ? p.text : p.word)).join('')}`
}

const VERSION = 1

function toBase64Url(s: string): string {
  const b64 = typeof btoa === 'function' ? btoa(s) : Buffer.from(s, 'binary').toString('base64')
  return b64.replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')
}

function fromBase64Url(s: string): string {
  const b64 = s.replace(/-/g, '+').replace(/_/g, '/')
  return typeof atob === 'function' ? atob(b64) : Buffer.from(b64, 'base64').toString('binary')
}

export function encodeShared(story: FilledStory): string {
  const parts = story.parts.map(p => (p.kind === 'text' ? p.text : [p.hint, p.word]))
  // Escape to ASCII so btoa never sees a character it cannot encode.
  const json = JSON.stringify([VERSION, story.title, parts]).replace(
    /[^\x20-\x7e]/g,
    c => `\\u${c.charCodeAt(0).toString(16).padStart(4, '0')}`
  )
  return toBase64Url(json)
}

function str(v: unknown, max: number): string | null {
  if (typeof v !== 'string') return null
  const s = v.length > max ? null : v
  return s
}

export function decodeShared(payload: string): FilledStory | null {
  if (!payload || payload.length > MAX_LINK_CHARS) return null
  let data: unknown
  try {
    data = JSON.parse(fromBase64Url(payload))
  } catch {
    return null
  }
  if (!Array.isArray(data) || data[0] !== VERSION || !Array.isArray(data[2])) return null
  const title = str(data[1], TITLE_MAX_CHARS)
  if (!title || !title.trim()) return null
  const raw = data[2] as unknown[]
  if (raw.length === 0 || raw.length > MAX_BLANKS * 2 + 1) return null

  const parts: FilledPart[] = []
  let words = 0
  for (const item of raw) {
    if (typeof item === 'string') {
      const text = str(item, TEXT_MAX_CHARS)
      if (text === null) return null
      parts.push({ kind: 'text', text })
    } else if (Array.isArray(item) && item.length === 2) {
      const hint = str(item[0], HINT_MAX_CHARS)
      const word = str(item[1], WORD_MAX_CHARS)
      if (hint === null || word === null || !word.trim()) return null
      parts.push({ kind: 'word', hint, word })
      words++
    } else {
      return null
    }
  }
  if (words === 0 || words > MAX_BLANKS) return null
  return { title: title.trim(), parts }
}

/** Read a shared story out of a location hash like `#s=…`. */
export function sharedFromHash(hash: string): FilledStory | null {
  const match = /(?:^#|&)s=([A-Za-z0-9_-]+)/.exec(hash)
  return match ? decodeShared(match[1]) : null
}

/* --- Topic suggestions -------------------------------------------------- */

export const TOPIC_IDEAS: readonly string[] = [
  'A dragon who is afraid of toast',
  'The worst day at the aquarium',
  'My pet goldfish runs for mayor',
  'A field trip to the moon',
  'Grandma joins a skateboard gang',
  'The haunted lunchbox',
  'A robot learns to bake',
  'Lost in a giant shopping mall',
  'The great sock heist',
  'A birthday party for a volcano',
  'The dentist is a wizard',
  'A sleepover at the museum',
  'The world’s slowest race car',
  'Pirates who hate the ocean',
  'The cat who became a chef',
  'A snow day in July',
  'The library after midnight',
  'My little brother is a secret agent',
  'A camping trip with a yeti',
  'The talent show disaster',
  'An alien tries pizza for the first time',
  'The bakery that only sells one cupcake',
  'A penguin moves to the desert',
  'The school bus that could fly',
  'A knight who is scared of horses',
  'The treehouse that kept growing',
  'A detective who only solves lost mittens',
  'The day all the clocks stopped',
  'A ghost who is bad at haunting',
  'The dog park Olympics',
  'A tiny witch and her enormous hat',
  'The ice cream truck that never stops',
  'Dinosaurs at the dentist',
  'A mermaid tries roller skating',
  'The garden gnome goes on vacation',
  'The loudest whisper in the world',
]

export function pickTopics(count: number, random: () => number = Math.random): string[] {
  const pool = [...TOPIC_IDEAS]
  for (let i = pool.length - 1; i > 0; i--) {
    const j = Math.floor(random() * (i + 1))
    ;[pool[i], pool[j]] = [pool[j], pool[i]]
  }
  return pool.slice(0, count)
}

/* --- Plain-language help for the common grammar hints ------------------- */

const HELP: readonly [RegExp, string][] = [
  [/plural noun/, 'More than one of something, like “pickles” or “clouds”.'],
  [/proper noun|someone.s name|a name|celebrity|famous person/, 'A name. Anyone you like.'],
  [/\bnoun\b/, 'A person, place, or thing, like “bucket”.'],
  [/adjective/, 'A describing word, like “fuzzy” or “enormous”.'],
  [/adverb/, 'How something is done, like “slowly” or “loudly”.'],
  [/-ing/, 'An action ending in -ing, like “dancing”.'],
  [/past tense|past-tense|\bpast\b/, 'An action that already happened, like “sneezed”.'],
  [/\bverb\b/, 'An action, like “jump” or “whisper”.'],
  [/exclamation|interjection/, 'Something you shout, like “Yikes!”'],
  [/number/, 'Any number. The sillier, the better.'],
  [/body part/, 'Like “elbow” or “nose”.'],
]

/** A one-line explanation of a hint, for players who do not know the grammar words. */
export function hintHelp(hint: string): string | null {
  const h = hint.toLowerCase()
  for (const [re, help] of HELP) if (re.test(h)) return help
  return null
}
