// Stratified set of (categoryId, difficulty) cells the trivia generation
// pipeline must handle. Each cell is replayed N times per eval run; the
// pipeline picks its own seed/modifier internally, so trials against the
// same cell sample the *distribution* of quality the generator produces
// rather than testing one specific seed.
//
// Smoke covers the first SMOKE_CATEGORY_COUNT categories × all 3
// difficulties for fast iteration. The full set covers the broad surface
// for pre-merge regression checking.

export type Difficulty = 'easy' | 'medium' | 'hard'

export interface GoldenCell {
  categoryId: number
  categoryName: string
  difficulty: Difficulty
}

const DIFFICULTIES: Difficulty[] = ['easy', 'medium', 'hard']

// Ordered: smoke-relevant categories first. Picked for breadth of failure
// modes — General Knowledge stresses the "what counts as easy" bar, Film
// and Music churn through specialist labels, Science and Geography are
// where factual errors bite hardest, History is where the "named entity
// vs date" flip rule matters most.
const GOLDEN_CATEGORIES: Array<{ id: number; name: string }> = [
  { id: 9, name: 'General Knowledge' },
  { id: 11, name: 'Film' },
  { id: 17, name: 'Science & Nature' },
  { id: 22, name: 'Geography' },
  { id: 23, name: 'History' },
  // ── smoke ends here (5 cats × 3 diffs = 15 cells) ──
  { id: 12, name: 'Music' },
  { id: 14, name: 'Television' },
  { id: 15, name: 'Video Games' },
  { id: 21, name: 'Sports' },
  { id: 20, name: 'Mythology' },
  { id: 10, name: 'Books' },
  { id: 18, name: 'Computers' },
  { id: 27, name: 'Animals' },
  { id: 24, name: 'Politics' },
  { id: 25, name: 'Art' },
  { id: 28, name: 'Vehicles' },
  { id: 32, name: 'Cartoons & Animation' },
]

const SMOKE_CATEGORY_COUNT = 5

export function getGoldenCells(smoke: boolean): GoldenCell[] {
  const cats = smoke
    ? GOLDEN_CATEGORIES.slice(0, SMOKE_CATEGORY_COUNT)
    : GOLDEN_CATEGORIES
  return cats.flatMap((c) =>
    DIFFICULTIES.map((d) => ({
      categoryId: c.id,
      categoryName: c.name,
      difficulty: d,
    }))
  )
}
