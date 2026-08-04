import { NextResponse } from 'next/server'
import { getWrongAnswersGallery } from '@/lib/trivia/wrongAnswers'

export async function GET() {
  try {
    const entries = await getWrongAnswersGallery(20)
    return NextResponse.json({ entries })
  } catch (error) {
    console.error('Error fetching wrong answers gallery:', error)
    return NextResponse.json({ entries: [] })
  }
}
