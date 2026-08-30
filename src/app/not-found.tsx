import Link from 'next/link'
import { ChunkyButton } from '@/components/ui/chunky-button'

export default function NotFound() {
  return (
    <div className="flex flex-col items-center justify-center min-h-[60vh] px-6 text-center">
      <div className="text-8xl font-bold text-on-surface/10 select-none mb-2">404</div>
      <h1 className="text-2xl font-bold text-on-surface mb-3">
        Page not found
      </h1>
      <p className="text-on-surface/50 text-sm max-w-sm mb-8">
        The page you're looking for doesn't exist.
      </p>
      <Link href="/">
        <ChunkyButton variant="primary" size="md">
          Go home
        </ChunkyButton>
      </Link>
    </div>
  )
}
