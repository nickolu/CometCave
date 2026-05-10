'use client'

import { useRouter } from 'next/navigation'

import { QuestionLibrary } from '@/app/trivia/components/QuestionLibrary'

export default function TriviaLibraryPage() {
  const router = useRouter()
  return <QuestionLibrary onBack={() => router.push('/trivia')} />
}
