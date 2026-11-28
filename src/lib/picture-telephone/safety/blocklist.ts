/* A small local blocklist: the cheap first layer before the moderation model.
   Terms are matched as whole words (plus simple endings) after normalising
   case, accents, leetspeak, spacing and stretched letters.

   Keep this list short and obvious. The moderation model does the heavy
   lifting. Slurs are intentionally left to that model (hate threshold 0.20);
   extend the list here if a playtest shows gaps. Never ship this file's
   contents to the client: it is imported by server code only. */

export const BLOCKLIST: readonly string[] = [
  // sexual
  'porn', 'porno', 'pornography', 'nude', 'nudes', 'naked', 'nsfw', 'hentai', 'erotic', 'orgasm',
  'masturbate', 'masturbation', 'blowjob', 'handjob', 'dildo', 'penis', 'vagina', 'boobs', 'boobies',
  'titties', 'cum', 'cumshot', 'sex', 'sexy', 'sexual', 'rape', 'rapist', 'molest', 'fetish', 'strip club',
  'sex toy', 'onlyfans',
  // profanity
  'fuck', 'fucking', 'motherfucker', 'shit', 'bullshit', 'bitch', 'asshole', 'bastard', 'dick', 'cock',
  'pussy', 'cunt', 'whore', 'slut', 'piss',
  // self-harm
  'suicide', 'suicidal', 'kill myself', 'kill yourself', 'self harm', 'cut myself', 'hang myself',
  'overdose', 'anorexia', 'pro ana',
  // gore and violence
  'gore', 'gory', 'decapitate', 'decapitated', 'beheaded', 'beheading', 'dismember', 'dismembered',
  'mutilate', 'mutilated', 'disembowel', 'torture', 'massacre', 'genocide', 'school shooting',
  'mass shooting', 'bloodbath', 'corpse', 'dead body',
  // drugs
  'cocaine', 'heroin', 'meth', 'methamphetamine', 'crack cocaine', 'fentanyl', 'lsd', 'ecstasy', 'mdma',
  'opioid', 'drug dealer',
  // weapon-making and terror
  'make a bomb', 'build a bomb', 'pipe bomb', 'molotov', 'nerve gas', 'terrorist', 'terrorism',
  'isis', 'nazi', 'swastika', 'hitler', 'ku klux klan', 'kkk',
]

const LEET: Readonly<Record<string, string>> = {
  '0': 'o', '1': 'i', '3': 'e', '4': 'a', '5': 's', '7': 't', '@': 'a', '$': 's',
}

/** Lowercase, strip accents, map leetspeak, turn everything else into single spaces. */
export function normalize(text: string): string {
  const base = text
    .normalize('NFKD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[013457@$]/g, ch => LEET[ch] ?? ch)
  return base.replace(/[^a-z]+/g, ' ').trim()
}

/** Collapse runs of the same letter ("fuuuck" -> "fuck"). */
export function squeeze(text: string): string {
  return text.replace(/([a-z])\1+/g, '$1')
}

/** Rejoin letters spread out with spaces or dots ("f u c k" -> "fuck"). */
export function joinSpaced(text: string): string {
  return text.replace(/\b(?:[a-z] ){2,}[a-z]\b/g, run => run.replace(/ /g, ''))
}

const SUFFIX = '(?:s|es|ed|ing|er|ers|y)?'

function escapeRe(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}

interface Compiled {
  term: string
  plain: RegExp
  squeezed: RegExp | null
}

const cache = new WeakMap<readonly string[], Compiled[]>()

function compile(list: readonly string[]): Compiled[] {
  const hit = cache.get(list)
  if (hit) return hit
  const out = list.map(term => {
    const t = normalize(term)
    const words = t.split(' ').map(escapeRe).join(' ')
    const sq = squeeze(t)
    return {
      term,
      plain: new RegExp(`(?:^| )${words}${SUFFIX}(?= |$)`),
      // Squeezed matching is only safe for terms with no doubled letters:
      // "ass" would become the ordinary word "as", "boobs" would become "bobs".
      squeezed:
        sq === t
          ? new RegExp(`(?:^| )${sq.split(' ').map(escapeRe).join(' ')}${SUFFIX}(?= |$)`)
          : null,
    }
  })
  cache.set(list, out)
  return out
}

/** The first blocklisted term found in the text, or null. The list is injectable for tests. */
export function matchesBlocklist(text: string, list: readonly string[] = BLOCKLIST): string | null {
  const n = normalize(text)
  const joined = joinSpaced(n)
  const variants = [n, joined]
  const squeezedVariants = [squeeze(n), squeeze(joined)]
  for (const c of compile(list)) {
    if (variants.some(v => c.plain.test(v))) return c.term
    if (c.squeezed && squeezedVariants.some(v => c.squeezed!.test(v))) return c.term
  }
  return null
}
