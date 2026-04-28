'use client'

import Link from 'next/link'

import { ChunkyButton } from '@/components/ui/chunky-button'
import { ChunkyCard, ChunkyCardContent } from '@/components/ui/chunky-card'

const REDIRECT = '/auth?redirect=/trivia'

export function SignInBanner({
  message,
  cta = 'Log in',
}: {
  message: string
  cta?: string
}) {
  return (
    <div className="w-full flex items-center justify-between gap-3 px-4 py-2.5 rounded-ds-sm bg-surface-variant/15 border border-surface-variant/30 text-sm">
      <span className="text-on-surface/80">{message}</span>
      <Link
        href={REDIRECT}
        className="text-ds-tertiary hover:text-ds-tertiary/80 underline-offset-4 hover:underline whitespace-nowrap font-semibold"
      >
        {cta} →
      </Link>
    </div>
  )
}

export function SignInCard({
  title,
  description,
}: {
  title: string
  description: string
}) {
  return (
    <ChunkyCard variant="surface-container-high" className="w-full">
      <ChunkyCardContent className="pt-5 pb-5 flex flex-col items-center gap-3 text-center">
        <h3 className="text-lg font-bold text-on-surface">{title}</h3>
        <p className="text-on-surface/70 text-sm">{description}</p>
        <Link href={REDIRECT} className="w-full">
          <ChunkyButton variant="primary" size="lg" className="w-full">
            Sign in
          </ChunkyButton>
        </Link>
      </ChunkyCardContent>
    </ChunkyCard>
  )
}
