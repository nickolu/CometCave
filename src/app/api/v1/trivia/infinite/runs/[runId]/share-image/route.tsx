import { ImageResponse } from 'next/og'
import { type NextRequest } from 'next/server'
import { getRunByIdPublic } from '@/lib/trivia/infiniteRuns'

export const runtime = 'nodejs'

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ runId: string }> }
) {
  const { runId } = await params
  const result = await getRunByIdPublic(runId)
  if (!result) {
    return new Response('Run not found', { status: 404 })
  }
  const { run } = result

  const questionsAnswered = run.answers.length

  return new ImageResponse(
    (
      <div
        style={{
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          width: '100%',
          height: '100%',
          backgroundColor: '#1a1025',
          color: '#e0d8f0',
          fontFamily: 'sans-serif',
          padding: '60px',
        }}
      >
        <div style={{ display: 'flex', fontSize: '32px', color: '#a78bfa', marginBottom: '20px' }}>
          CometCave Infinite Trivia
        </div>
        <div style={{ display: 'flex', fontSize: '80px', marginBottom: '10px' }}>
          🔥 {run.longestStreak} Streak
        </div>
        <div style={{ display: 'flex', gap: '60px', fontSize: '28px', color: '#c4b5fd', marginTop: '20px' }}>
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
            <div style={{ display: 'flex', fontSize: '48px', color: '#e0d8f0', fontWeight: 'bold' }}>{run.score.toLocaleString()}</div>
            <div style={{ display: 'flex' }}>Score</div>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
            <div style={{ display: 'flex', fontSize: '48px', color: '#e0d8f0', fontWeight: 'bold' }}>{questionsAnswered}</div>
            <div style={{ display: 'flex' }}>Questions</div>
          </div>
          {run.trailblazes > 0 && (
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
              <div style={{ display: 'flex', fontSize: '48px', color: '#e0d8f0', fontWeight: 'bold' }}>{run.trailblazes}</div>
              <div style={{ display: 'flex' }}>First Answers</div>
            </div>
          )}
        </div>
        <div style={{ display: 'flex', fontSize: '20px', color: '#7c3aed', marginTop: '40px' }}>
          cometcave.com/trivia
        </div>
      </div>
    ),
    {
      width: 1200,
      height: 630,
    }
  )
}
