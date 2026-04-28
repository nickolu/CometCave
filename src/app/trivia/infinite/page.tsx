'use client'
import { useRouter } from 'next/navigation'
import { InfiniteGame } from '@/app/trivia/components/InfiniteGame'

export default function InfiniteTriviaPage() {
  const router = useRouter()
  return <InfiniteGame onBack={() => router.push('/trivia')} />
}
