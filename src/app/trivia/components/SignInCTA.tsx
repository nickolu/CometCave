'use client'

import Link from 'next/link'

import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'

const REDIRECT = '/auth?redirect=/trivia'

export function SignInBanner({
  message,
  cta = 'Log in',
}: {
  message: string
  cta?: string
}) {
  return (
    <div className="w-full flex items-center justify-between gap-3 px-4 py-2.5 rounded-lg bg-space-purple/15 border border-space-purple/30 text-sm">
      <span className="text-cream-white/80">{message}</span>
      <Link
        href={REDIRECT}
        className="text-space-gold hover:text-space-gold/80 underline-offset-4 hover:underline whitespace-nowrap font-semibold"
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
    <Card className="w-full bg-space-purple/15 border-space-purple/40">
      <CardContent className="pt-5 pb-5 flex flex-col items-center gap-3 text-center">
        <h3 className="text-lg font-bold text-cream-white">{title}</h3>
        <p className="text-cream-white/70 text-sm">{description}</p>
        <Link href={REDIRECT} className="w-full">
          <Button variant="space" size="lg" className="w-full">
            Sign in
          </Button>
        </Link>
      </CardContent>
    </Card>
  )
}
