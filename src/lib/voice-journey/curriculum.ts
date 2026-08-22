/**
 * The sixteen-week singing course, and the shape of one child's progress
 * through it.
 *
 * The course is content, not configuration: edit it freely. Progress is stored
 * against item ids, so renaming a title or swapping a video keeps the check
 * marks — but changing an `id` orphans whatever was ticked against the old one,
 * and the server will drop it on the next write (see `sanitizeProgress`).
 * Add weeks by appending; ids only ever need to be unique.
 *
 * A step is not always one video. Some pair a warm-up with a cool-down or run
 * to two parts, some are a thing she does rather than watches, and the warm-up
 * rotations deliberately point back at earlier weeks rather than repeating
 * their links — one video, one place to fix it.
 */

export type ItemType = 'warmup' | 'concept' | 'song'

export interface CourseVideo {
  url: string
  /** Names this one when a step offers more than one. */
  label?: string
  /**
   * A YouTube search rather than a video we picked. Honest about itself so the
   * page can say "find one" instead of promising a specific lesson.
   */
  search?: boolean
}

export interface CourseItem {
  id: string
  type: ItemType
  /** What she actually does. Shown as the step title. */
  title: string
  /** Rough minutes, so a day can be sized before it starts. */
  min: number
  /** Watch these, in order. Empty when the step is something she does. */
  videos: CourseVideo[]
  /**
   * Ids of earlier steps whose videos this one offers instead of its own — the
   * warm-ups she rotates through. Resolved by `videosFor`.
   */
  rotates?: string[]
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

const watch = (id: string, label?: string): CourseVideo =>
  label
    ? { url: `https://www.youtube.com/watch?v=${id}`, label }
    : { url: `https://www.youtube.com/watch?v=${id}` }

/** For the few steps where no single video is the right answer. */
const search = (q: string): CourseVideo[] => [
  { url: `https://www.youtube.com/results?search_query=${encodeURIComponent(q)}`, search: true },
]

/** The three warm-ups Phase 3 rotates between, and Week 5 and 12 pick from. */
const WARMUP_ROTATION = ['w1a', 'w3a', 'w7a']

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
            title: 'Cheryl Porter — 10 Minute Daily Vocal Workout',
            min: 10,
            videos: [watch('1XHXezdnL0A')],
          },
          {
            id: 'w1b',
            type: 'concept',
            title: 'VLTTW Ep. 98 — Voice Lessons for Beginners, Pt 1',
            min: 12,
            videos: [watch('1dPPo3MvTbc')],
          },
          {
            id: 'w1c',
            type: 'song',
            title: 'Sing an easy favorite song, focus on posture',
            min: 10,
            videos: search('easy songs to sing for beginners'),
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
            title: 'Cheryl Porter — 10 Minute Vocal Workout',
            min: 10,
            videos: [watch('6tbii7Azhzg')],
          },
          {
            id: 'w2b',
            type: 'concept',
            title: 'Dr Dan — Breath Management for Voice',
            min: 12,
            videos: [watch('gvb9jQm_GVs')],
          },
          {
            id: 'w2c',
            type: 'song',
            title: 'Same song — breathe low before each phrase',
            min: 10,
            videos: search('how to breathe while singing a song'),
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
            title: 'Jacobs Vocal Academy — 10 Minute Vocal Warm Up',
            min: 10,
            videos: [watch('ck1pzgy07ZU')],
          },
          {
            id: 'w3b',
            type: 'concept',
            title: '30 Day Singer — How to Match Pitch for Beginners',
            min: 12,
            videos: [watch('-PExRMSit_I')],
          },
          {
            id: 'w3c',
            type: 'song',
            title: 'Record yourself once — listen back for pitch',
            min: 10,
            videos: search('how to practice singing with recording'),
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
            title: 'Cheryl Porter — 10 Minute Daily Vocal Workout (2023)',
            min: 10,
            videos: [watch('9dVW9E40-Gw')],
          },
          {
            id: 'w4b',
            type: 'concept',
            title: 'Vocal Nebula — Breathing for Singing, Pt 1 & 2',
            min: 15,
            videos: [watch('FZcgYe4zljQ', 'Part 1'), watch('H8Ve6Hzozik', 'Part 2')],
          },
          {
            id: 'w4c',
            type: 'song',
            title: 'New song of her choice, apply breath support',
            min: 10,
            videos: search('breath support singing practice'),
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
            title: 'Her pick — a warm-up she already knows',
            min: 10,
            videos: [],
            rotates: ['w1a', 'w2a', 'w3a'],
          },
          {
            id: 'w5b',
            type: 'concept',
            title: 'VLTTW Ep. 99 — Voice Lessons for Beginners, Pt 2',
            min: 12,
            videos: [watch('9427xS0X1dM')],
          },
          {
            id: 'w5c',
            type: 'song',
            title: 'Sing soft vs. loud on purpose — dynamics play',
            min: 10,
            videos: search('singing dynamics exercise beginner'),
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
            title: 'Jacobs — 5 Minute Warm Up, then a cool-down',
            min: 12,
            videos: [
              watch('YCLyAmXtpfY', 'Warm-up · Jacobs'),
              watch('4SaweGqe4dA', 'Cool-down · Vocal Warmups with Kathleen'),
            ],
          },
          {
            id: 'w6b',
            type: 'concept',
            title: 'Dr Dan — Turbocharge Your Vocal Practice',
            min: 10,
            videos: [watch('aI_r-yUvMd8')],
          },
          {
            id: 'w6c',
            type: 'song',
            title: "Mini 'concert': perform 1–2 songs for family",
            min: 15,
            videos: search('performing for family practice confidence'),
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
            title: 'Jacobs — 15 Minute Vocal Warm Up',
            min: 10,
            videos: [watch('1f_SVJMRx5s')],
          },
          {
            id: 'w7b',
            type: 'concept',
            title: 'VLTTW Ep. 86 — How to Sing Chest Voice',
            min: 12,
            videos: [watch('Rg2qjuzloKE')],
          },
          {
            id: 'w7c',
            type: 'song',
            title: 'VLTTW Ep. 87 — How to Sing Head Voice, then find both in a song',
            min: 12,
            videos: [watch('KaMJ9YvnUNw')],
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
            min: 10,
            videos: search('vocal siren exercise warm up'),
          },
          {
            id: 'w8b',
            type: 'concept',
            title: 'VLTTW Ep. 88 — How to Sing Mix Voice',
            min: 12,
            videos: [watch('obzz4a3tO4U')],
          },
          {
            id: 'w8c',
            type: 'song',
            title: 'Gentle passes over the break in a song',
            min: 10,
            videos: search('smooth vocal break singing exercise'),
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
            title: 'VLTTW Ep. 61 — The Open “Oh” Vowel',
            min: 10,
            videos: [watch('4MGTAjklUQ4')],
          },
          {
            id: 'w9b',
            type: 'concept',
            title: 'VLTTW Ep. 38 — The Deadly “I” Vowel',
            min: 12,
            videos: [watch('YAOqF2lc57Q')],
          },
          {
            id: 'w9c',
            type: 'song',
            title: 'Exaggerate vowels in a chorus, then relax them',
            min: 10,
            videos: search('singing diction exercise'),
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
            min: 10,
            videos: search('gentle range extension warm up singing'),
          },
          {
            id: 'w10b',
            type: 'concept',
            title: 'Dr Dan — How to Expand Your Vocal Range Safely',
            min: 12,
            videos: [watch('Mve47WHSumY')],
          },
          {
            id: 'w10c',
            type: 'song',
            title: "Move a song's key up/down to fit her voice",
            min: 10,
            videos: search('change song key to fit your voice'),
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
            title: 'Jacobs — Riffs and Runs (Beginner)',
            min: 10,
            videos: [watch('wOgDwAsQUxg')],
          },
          {
            id: 'w11b',
            type: 'concept',
            title: '30 Day Singer — Riffs and Runs, Super Easy for Beginners',
            min: 12,
            videos: [watch('wqNHZHi984k')],
          },
          {
            id: 'w11c',
            type: 'song',
            title: 'Learn ONE tiny riff from a song she loves',
            min: 10,
            videos: search('easy riffs to learn singing'),
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
            title: 'Her pick — a warm-up she already knows',
            min: 10,
            videos: [],
            rotates: WARMUP_ROTATION,
          },
          {
            id: 'w12b',
            type: 'concept',
            title: 'Singeo — How to Sing With Vibrato',
            min: 12,
            videos: [watch('gXVVQ-5o5YE')],
          },
          {
            id: 'w12c',
            type: 'song',
            title: 'Record & compare to Week 3 recording',
            min: 15,
            videos: search('track singing progress recording'),
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
            min: 10,
            videos: [],
            rotates: WARMUP_ROTATION,
          },
          {
            id: 'w13b',
            type: 'concept',
            title: '30 Day Singer — How to Sing a Song for Beginners',
            min: 12,
            videos: [watch('v2D0RsSvwD0')],
          },
          {
            id: 'w13c',
            type: 'song',
            title: "Pick a 'project song' for the month",
            min: 15,
            videos: search('how to learn a song step by step singing'),
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
            min: 10,
            videos: [],
            rotates: WARMUP_ROTATION,
          },
          {
            id: 'w14b',
            type: 'concept',
            title: 'Stevie Mackey — How to Sing with Emotion',
            min: 12,
            videos: [watch('4rxr_vTw9LE')],
          },
          {
            id: 'w14c',
            type: 'song',
            title: 'Project song: verse + chorus polished',
            min: 15,
            videos: search('song phrasing practice'),
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
            min: 10,
            videos: [],
            rotates: WARMUP_ROTATION,
          },
          {
            id: 'w15b',
            type: 'concept',
            title: '30 Day Singer — Build Singing Confidence On-Stage',
            min: 12,
            videos: [watch('x8U6lwfAK8M')],
          },
          {
            id: 'w15c',
            type: 'song',
            title: 'Full run-throughs, standing, like a show',
            min: 15,
            videos: search('performance practice singing'),
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
            min: 12,
            videos: [],
            rotates: ['w6a'],
          },
          // Nothing to watch — the whole step is her answering the question.
          {
            id: 'w16b',
            type: 'concept',
            title: "Reflect: favorite thing she's learned",
            min: 5,
            videos: [],
          },
          {
            id: 'w16c',
            type: 'song',
            title: 'Living-room concert! Record the performance',
            min: 20,
            videos: search('home concert performance'),
          },
        ],
      },
    ],
  },
]

const BY_ID = new Map<string, { item: CourseItem; week: CourseWeek }>(
  COURSE.flatMap(p => p.weeks.flatMap(w => w.items.map(i => [i.id, { item: i, week: w }] as const)))
)

/**
 * What this step actually offers to watch, with rotations expanded.
 *
 * A rotating warm-up borrows from the weeks it points at and is labelled with
 * their titles, so "her pick" reads as a real choice between lessons she has
 * already done rather than three anonymous links. One level deep only: a
 * rotation never points at another rotation.
 */
export function videosFor(item: CourseItem): CourseVideo[] {
  if (!item.rotates?.length) return item.videos

  const borrowed = item.rotates.flatMap(id => {
    const source = BY_ID.get(id)
    if (!source) return []
    // Named by the week as well as the title: the rotation offers two Cheryl
    // Porter workouts whose names differ by one word, and "Week 1" is what
    // actually tells them apart.
    const from = `${source.week.label} · ${source.item.title}`
    return source.item.videos.map(video => ({
      ...video,
      label: video.label ? `${from} · ${video.label}` : from,
    }))
  })

  return [...item.videos, ...borrowed]
}

/** Every item id the course knows about — the allowlist the server validates against. */
export const ITEM_IDS: ReadonlySet<string> = new Set(BY_ID.keys())

export const TOTAL_ITEMS = ITEM_IDS.size
