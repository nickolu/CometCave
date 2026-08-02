import { beforeEach, describe, expect, it, vi } from 'vitest'

import type { DailyQuestionsDocument } from '@/lib/trivia/dailyQuestionsDb'
import {
  getAvailableDates,
  getDailyQuestions,
  setDailyQuestions,
} from '@/lib/trivia/dailyQuestionsDb'

vi.mock('@/lib/firebase/server', () => ({
  getFirestoreDb: vi.fn(),
}))

vi.mock('firebase-admin/firestore', () => ({
  FieldValue: {
    serverTimestamp: vi.fn(() => 'SERVER_TIMESTAMP'),
  },
}))

import { getFirestoreDb } from '@/lib/firebase/server'

const mockGetFirestoreDb = vi.mocked(getFirestoreDb)

function buildMockDb({
  snapExists,
  snapData,
  docSet,
  queryDocs,
}: {
  snapExists?: boolean
  snapData?: () => unknown
  docSet?: ReturnType<typeof vi.fn>
  queryDocs?: { id: string }[]
}) {
  const snap = {
    exists: snapExists ?? false,
    data: snapData ?? vi.fn(() => undefined),
  }

  const querySnap = {
    docs: queryDocs ?? [],
  }

  const setFn = docSet ?? vi.fn(() => Promise.resolve())

  const docRef = {
    get: vi.fn(() => Promise.resolve(snap)),
    set: setFn,
  }

  const queryRef = {
    get: vi.fn(() => Promise.resolve(querySnap)),
  }

  const withSelect = {
    select: vi.fn(() => queryRef),
  }

  const withOrderBy = {
    orderBy: vi.fn(() => withSelect),
  }

  const withSecondWhere = {
    where: vi.fn(() => withOrderBy),
  }

  const collectionRef = {
    doc: vi.fn(() => docRef),
    where: vi.fn(() => withSecondWhere),
  }

  const db = {
    collection: vi.fn(() => collectionRef),
  }

  return { db, docRef, setFn, querySnap, collectionRef, withSecondWhere, withOrderBy, withSelect }
}

const fixture: DailyQuestionsDocument = {
  date: '2026-01-15',
  categoryId: 9,
  categoryName: 'General Knowledge',
  questions: [
    {
      id: 'q1',
      question: 'What is 2 + 2?',
      options: ['1', '2', '4', '5'],
      difficulty: 'easy',
      category: 'General Knowledge',
      source: 'opentdb',
      correctAnswer: '4',
      explanation: 'Basic arithmetic.',
    },
  ],
  createdAt: 'SERVER_TIMESTAMP' as unknown as FirebaseFirestore.Timestamp,
}

describe('getDailyQuestions', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('returns null when document does not exist', async () => {
    const { db } = buildMockDb({ snapExists: false })
    mockGetFirestoreDb.mockReturnValue(db as unknown as ReturnType<typeof getFirestoreDb>)

    const result = await getDailyQuestions('2026-01-15')

    expect(result).toBeNull()
  })

  it('returns document data when it exists', async () => {
    const { db } = buildMockDb({
      snapExists: true,
      snapData: () => fixture,
    })
    mockGetFirestoreDb.mockReturnValue(db as unknown as ReturnType<typeof getFirestoreDb>)

    const result = await getDailyQuestions('2026-01-15')

    expect(result).not.toBeNull()
    expect(result!.date).toBe('2026-01-15')
    expect(result!.categoryId).toBe(9)
    expect(result!.questions).toHaveLength(1)
  })
})

describe('setDailyQuestions', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('calls set with data merged with createdAt', async () => {
    const setFn = vi.fn(() => Promise.resolve())
    const { db } = buildMockDb({ docSet: setFn })
    mockGetFirestoreDb.mockReturnValue(db as unknown as ReturnType<typeof getFirestoreDb>)

    const payload: Omit<DailyQuestionsDocument, 'createdAt'> = {
      date: '2026-01-15',
      categoryId: 9,
      categoryName: 'General Knowledge',
      questions: fixture.questions,
    }

    await setDailyQuestions('2026-01-15', payload)

    expect(setFn).toHaveBeenCalledOnce()

    const calledWith = setFn.mock.calls[0][0] as Record<string, unknown>
    expect(calledWith.date).toBe('2026-01-15')
    expect(calledWith.categoryId).toBe(9)
    expect(calledWith.categoryName).toBe('General Knowledge')
    expect(calledWith.questions).toBe(fixture.questions)
    expect(calledWith.createdAt).toBe('SERVER_TIMESTAMP')
  })
})

describe('getAvailableDates', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('returns document IDs in range', async () => {
    const queryDocs = [
      { id: '2026-01-13' },
      { id: '2026-01-14' },
      { id: '2026-01-15' },
    ]
    const { db } = buildMockDb({ queryDocs })
    mockGetFirestoreDb.mockReturnValue(db as unknown as ReturnType<typeof getFirestoreDb>)

    const result = await getAvailableDates('2026-01-13', '2026-01-15')

    expect(result).toEqual(['2026-01-13', '2026-01-14', '2026-01-15'])
  })
})
