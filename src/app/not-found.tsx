import Link from 'next/link'
import { ChunkyButton } from '@/components/ui/chunky-button'

export default function NotFound() {
  return (
    <div className="flex flex-col items-center justify-center min-h-[60vh] px-6 text-center">
      <div className="text-8xl font-bold text-on-surface/10 select-none mb-2">404</div>
      <h1 className="text-2xl font-bold text-on-surface mb-3">
        The cave has no memory of this path
      </h1>
      <p className="text-on-surface/50 text-sm max-w-sm mb-8">
        You've wandered beyond the mapped corridors. The walls here are smooth and unmarked — nothing echoes back.
      </p>
      <Link href="/">
        <ChunkyButton variant="primary" size="md">
          Return to the cave
        </ChunkyButton>
      </Link>
    </div>
  )
}
