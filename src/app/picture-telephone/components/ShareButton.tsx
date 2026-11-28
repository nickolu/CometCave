'use client'

import { useRef, useState } from 'react'

import { ChunkyButton } from '@/components/ui/chunky-button'
import { composeChainImage, downloadFile, shareOrDownload } from '@/lib/picture-telephone/share/compose'

import type { Entry, Seat } from '@/lib/picture-telephone/types'

type Status = { tone: 'ok' | 'error'; text: string } | null

/** "Share picture" (native sheet where it works, else a download) and an always-visible "Download". */
export function ShareButton({ entries, seats }: { entries: Entry[]; seats: Seat[] }) {
  const [busy, setBusy] = useState<'share' | 'download' | null>(null)
  const [status, setStatus] = useState<Status>(null)
  // Reuse the finished file so a second tap does not compose again.
  const cached = useRef<File | null>(null)
  const disabled = entries.length === 0 || busy !== null

  const run = async (mode: 'share' | 'download') => {
    if (disabled) return
    setBusy(mode)
    setStatus(null)
    try {
      cached.current ??= await composeChainImage(entries, seats)
      if (mode === 'download') {
        downloadFile(cached.current)
        setStatus({ tone: 'ok', text: 'Saved as picture-telephone.png.' })
      } else {
        const outcome = await shareOrDownload(cached.current)
        if (outcome === 'downloaded') setStatus({ tone: 'ok', text: 'Saved as picture-telephone.png.' })
        if (outcome === 'shared') setStatus({ tone: 'ok', text: 'Shared.' })
      }
    } catch {
      setStatus({ tone: 'error', text: 'Could not make the picture. Please try again.' })
    } finally {
      setBusy(null)
    }
  }

  return (
    <>
      <ChunkyButton variant="utility" size="lg" disabled={disabled} onClick={() => run('share')}>
        {busy === 'share' ? 'Making picture…' : 'Share picture'}
      </ChunkyButton>
      <ChunkyButton variant="utility" size="lg" disabled={disabled} onClick={() => run('download')}>
        {busy === 'download' ? 'Making picture…' : 'Download'}
      </ChunkyButton>
      <p role="status" className={status?.tone === 'error' ? 'pt-notice w-full' : 'pt-sub w-full'}>
        {status?.text}
      </p>
    </>
  )
}
