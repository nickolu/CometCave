import { NextResponse } from 'next/server'

import { generateClassSkillTree } from '@/app/tap-tap-adventure/lib/classSkillTreeGenerator'
import { requireAiAccess } from '@/lib/api/ai-gate'

export async function POST(request: Request) {
  const gate = await requireAiAccess(request, 'tap-tap-text')
  if ('error' in gate) return gate.error

  try {
    const body = await request.json()
    const { classId, className, combatStyle } = body as {
      classId: string
      className: string
      combatStyle: string
    }

    if (!classId || !className || !combatStyle) {
      return NextResponse.json(
        { error: 'classId, className, and combatStyle are required' },
        { status: 400 }
      )
    }

    const skillTree = await generateClassSkillTree(classId, className, combatStyle)
    return NextResponse.json({ skillTree })
  } catch (error) {
    console.error('Error generating skill tree:', error)
    return NextResponse.json(
      { error: 'Failed to generate skill tree' },
      { status: 500 }
    )
  }
}
