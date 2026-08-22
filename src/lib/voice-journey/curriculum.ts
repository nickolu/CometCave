/**
 * The sixteen-week singing course, and the shape of one child's progress
 * through it.
 *
 * The course is content, not configuration: edit it freely. Progress is stored
 * against item ids, so renaming a title or swapping a video keeps the check
 * marks — but changing an `id` orphans whatever was ticked against the old one,
 * and the server will drop it on the next write (see `sanitizeProgress`).
 * Add weeks by appending; ids only ever need to be unique.
 */

export type ItemType = 'warmup' | 'concept' | 'song'

export interface CourseItem {
  id: string
  type: ItemType
  /** What she actually does. Shown as the step title. */
  title: string
  /** A YouTube search, not a fixed video — results stay fresh as channels change. */
  url: string
  /** Rough minutes, so a day can be sized before it starts. */
  min: number
}

export interface CourseWeek {
  id: string
  label: string
  items: CourseItem[]
}

export interface CoursePhase {
  id: string
  name: string
  tagline: string
  weeks: CourseWeek[]
}

const yt = (q: string) => `https://www.youtube.com/results?search_query=${encodeURIComponent(q)}`

export const COURSE: CoursePhase[] = [
  {
    id: 'p1',
    name: 'Foundations',
    tagline: 'Breath, posture, pitch — and making practice a habit',
    weeks: [
      {
        id: 'w1',
        label: 'Week 1',
        items: [
          {
            id: 'w1a',
            type: 'warmup',
            title: 'Cheryl Porter — beginner warm-up',
            url: yt('Cheryl Porter vocal warm up beginner'),
            min: 10,
          },
          {
            id: 'w1b',
            type: 'concept',
            title: 'Posture & breathing basics (VLTW Ep. 1)',
            url: yt('Voice Lessons To The World Ep 1'),
            min: 12,
          },
          {
            id: 'w1c',
            type: 'song',
            title: 'Sing an easy favorite song, focus on posture',
            url: yt('easy songs to sing for beginners'),
            min: 10,
          },
        ],
      },
      {
        id: 'w2',
        label: 'Week 2',
        items: [
          {
            id: 'w2a',
            type: 'warmup',
            title: 'Cheryl Porter — lip trills & sirens',
            url: yt('Cheryl Porter lip trill warm up'),
            min: 10,
          },
          {
            id: 'w2b',
            type: 'concept',
            title: 'Breathing from the diaphragm (Dr. Dan)',
            url: yt('Dr Dan Voice Essentials diaphragm breathing'),
            min: 12,
          },
          {
            id: 'w2c',
            type: 'song',
            title: 'Same song — breathe low before each phrase',
            url: yt('how to breathe while singing a song'),
            min: 10,
          },
        ],
      },
      {
        id: 'w3',
        label: 'Week 3',
        items: [
          {
            id: 'w3a',
            type: 'warmup',
            title: 'Jacobs Vocal Academy — daily warm-up',
            url: yt('Jacobs Vocal Academy 10 minute warm up'),
            min: 10,
          },
          {
            id: 'w3b',
            type: 'concept',
            title: 'Matching pitch & singing in tune',
            url: yt('how to match pitch singing beginner'),
            min: 12,
          },
          {
            id: 'w3c',
            type: 'song',
            title: 'Record yourself once — listen back for pitch',
            url: yt('how to practice singing with recording'),
            min: 10,
          },
        ],
      },
      {
        id: 'w4',
        label: 'Week 4',
        items: [
          {
            id: 'w4a',
            type: 'warmup',
            title: 'Cheryl Porter — five-tone scales',
            url: yt('Cheryl Porter five tone scale exercise'),
            min: 10,
          },
          {
            id: 'w4b',
            type: 'concept',
            title: 'Vocal Nebula — breathing for singing pt. 1–2',
            url: yt('Vocal Nebula breathing for singing beginners'),
            min: 15,
          },
          {
            id: 'w4c',
            type: 'song',
            title: 'New song of her choice, apply breath support',
            url: yt('breath support singing practice'),
            min: 10,
          },
        ],
      },
      {
        id: 'w5',
        label: 'Week 5',
        items: [
          {
            id: 'w5a',
            type: 'warmup',
            title: 'Rotate her favorite warm-up so far',
            url: yt('vocal warm up for kids and teens'),
            min: 10,
          },
          {
            id: 'w5b',
            type: 'concept',
            title: 'Good tone without pushing (VLTW)',
            url: yt('Voice Lessons To The World tone quality'),
            min: 12,
          },
          {
            id: 'w5c',
            type: 'song',
            title: 'Sing soft vs. loud on purpose — dynamics play',
            url: yt('singing dynamics exercise beginner'),
            min: 10,
          },
        ],
      },
      {
        id: 'w6',
        label: 'Week 6',
        items: [
          {
            id: 'w6a',
            type: 'warmup',
            title: 'Warm-up + gentle cool-down (Dr. Dan)',
            url: yt('Dr Dan vocal cool down'),
            min: 12,
          },
          {
            id: 'w6b',
            type: 'concept',
            title: 'Phase recap — what does good practice feel like?',
            url: yt('how to practice singing effectively beginner'),
            min: 10,
          },
          {
            id: 'w6c',
            type: 'song',
            title: "Mini 'concert': perform 1–2 songs for family",
            url: yt('performing for family practice confidence'),
            min: 15,
          },
        ],
      },
    ],
  },
  {
    id: 'p2',
    name: 'Technique',
    tagline: 'One concept a week: registers, the break, vowels, range',
    weeks: [
      {
        id: 'w7',
        label: 'Week 7',
        items: [
          {
            id: 'w7a',
            type: 'warmup',
            title: 'Daily warm-up rotation',
            url: yt('Jacobs Vocal Academy warm up head voice'),
            min: 10,
          },
          {
            id: 'w7b',
            type: 'concept',
            title: 'Chest voice vs. head voice (VLTW)',
            url: yt('Voice Lessons To The World chest voice head voice'),
            min: 12,
          },
          {
            id: 'w7c',
            type: 'song',
            title: 'Find both voices in a song she knows',
            url: yt('chest voice head voice song examples'),
            min: 10,
          },
        ],
      },
      {
        id: 'w8',
        label: 'Week 8',
        items: [
          {
            id: 'w8a',
            type: 'warmup',
            title: 'Sirens & slides warm-up',
            url: yt('vocal siren exercise warm up'),
            min: 10,
          },
          {
            id: 'w8b',
            type: 'concept',
            title: 'Releasing the vocal break (Madeleine Harvey)',
            url: yt('Madeleine Harvey vocal break'),
            min: 12,
          },
          {
            id: 'w8c',
            type: 'song',
            title: 'Gentle passes over the break in a song',
            url: yt('smooth vocal break singing exercise'),
            min: 10,
          },
        ],
      },
      {
        id: 'w9',
        label: 'Week 9',
        items: [
          {
            id: 'w9a',
            type: 'warmup',
            title: 'Vowel-focused warm-up',
            url: yt('vowel modification warm up singing'),
            min: 10,
          },
          {
            id: 'w9b',
            type: 'concept',
            title: 'Vowels & clear words while singing (VLTW)',
            url: yt('Voice Lessons To The World vowels diction'),
            min: 12,
          },
          {
            id: 'w9c',
            type: 'song',
            title: 'Exaggerate vowels in a chorus, then relax them',
            url: yt('singing diction exercise'),
            min: 10,
          },
        ],
      },
      {
        id: 'w10',
        label: 'Week 10',
        items: [
          {
            id: 'w10a',
            type: 'warmup',
            title: 'Range-stretch warm-up (gentle!)',
            url: yt('gentle range extension warm up singing'),
            min: 10,
          },
          {
            id: 'w10b',
            type: 'concept',
            title: 'Extending range safely (Dr. Dan)',
            url: yt('Dr Dan Voice Essentials extend vocal range safely'),
            min: 12,
          },
          {
            id: 'w10c',
            type: 'song',
            title: "Move a song's key up/down to fit her voice",
            url: yt('change song key to fit your voice'),
            min: 10,
          },
        ],
      },
      {
        id: 'w11',
        label: 'Week 11',
        items: [
          {
            id: 'w11a',
            type: 'warmup',
            title: 'Agility runs — simple riffs',
            url: yt('Cheryl Porter riffs and runs beginner'),
            min: 10,
          },
          {
            id: 'w11b',
            type: 'concept',
            title: 'Intro to riffs & runs (start slow)',
            url: yt('riffs and runs for beginners slow'),
            min: 12,
          },
          {
            id: 'w11c',
            type: 'song',
            title: 'Learn ONE tiny riff from a song she loves',
            url: yt('easy riffs to learn singing'),
            min: 10,
          },
        ],
      },
      {
        id: 'w12',
        label: 'Week 12',
        items: [
          {
            id: 'w12a',
            type: 'warmup',
            title: 'Her pick — favorite warm-up',
            url: yt('fun vocal warm up'),
            min: 10,
          },
          {
            id: 'w12b',
            type: 'concept',
            title: 'Vibrato basics — what it is, no forcing',
            url: yt('what is vibrato singing beginner'),
            min: 12,
          },
          {
            id: 'w12c',
            type: 'song',
            title: 'Record & compare to Week 3 recording',
            url: yt('track singing progress recording'),
            min: 15,
          },
        ],
      },
    ],
  },
  {
    id: 'p3',
    name: 'Songs & Style',
    tagline: 'Technique in service of music she loves',
    weeks: [
      {
        id: 'w13',
        label: 'Week 13',
        items: [
          {
            id: 'w13a',
            type: 'warmup',
            title: 'Warm-up rotation',
            url: yt('daily vocal warm up 10 minutes'),
            min: 10,
          },
          {
            id: 'w13b',
            type: 'concept',
            title: 'Song breakdown — how pros learn a song',
            url: yt('Tara Simon song breakdown tutorial'),
            min: 12,
          },
          {
            id: 'w13c',
            type: 'song',
            title: "Pick a 'project song' for the month",
            url: yt('how to learn a song step by step singing'),
            min: 15,
          },
        ],
      },
      {
        id: 'w14',
        label: 'Week 14',
        items: [
          {
            id: 'w14a',
            type: 'warmup',
            title: 'Warm-up rotation',
            url: yt('vocal warm up before singing songs'),
            min: 10,
          },
          {
            id: 'w14b',
            type: 'concept',
            title: 'Phrasing & emotion (Eric Arceneaux)',
            url: yt('Eric Arceneaux phrasing emotion singing'),
            min: 12,
          },
          {
            id: 'w14c',
            type: 'song',
            title: 'Project song: verse + chorus polished',
            url: yt('song phrasing practice'),
            min: 15,
          },
        ],
      },
      {
        id: 'w15',
        label: 'Week 15',
        items: [
          {
            id: 'w15a',
            type: 'warmup',
            title: 'Warm-up rotation',
            url: yt('vocal warm up routine'),
            min: 10,
          },
          {
            id: 'w15b',
            type: 'concept',
            title: 'Stage presence & confidence basics',
            url: yt('stage presence for young singers'),
            min: 12,
          },
          {
            id: 'w15c',
            type: 'song',
            title: 'Full run-throughs, standing, like a show',
            url: yt('performance practice singing'),
            min: 15,
          },
        ],
      },
      {
        id: 'w16',
        label: 'Week 16',
        items: [
          {
            id: 'w16a',
            type: 'warmup',
            title: 'Warm-up + cool-down',
            url: yt('vocal warm up and cool down'),
            min: 12,
          },
          {
            id: 'w16b',
            type: 'concept',
            title: "Reflect: favorite thing she's learned",
            url: yt('singing progress reflection'),
            min: 5,
          },
          {
            id: 'w16c',
            type: 'song',
            title: 'Living-room concert! Record the performance',
            url: yt('home concert performance'),
            min: 20,
          },
        ],
      },
    ],
  },
]

/** Every item id the course knows about — the allowlist the server validates against. */
export const ITEM_IDS: ReadonlySet<string> = new Set(
  COURSE.flatMap(p => p.weeks.flatMap(w => w.items.map(i => i.id)))
)

export const TOTAL_ITEMS = ITEM_IDS.size
