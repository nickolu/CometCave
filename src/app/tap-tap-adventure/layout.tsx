'use client'

import { useEffect } from 'react'

export default function TapTapAdventureLayout({ children }: { children: React.ReactNode }) {
  // On mobile, hide site header/footer and make body scrollable
  useEffect(() => {
    document.body.classList.add('game-active')
    return () => document.body.classList.remove('game-active')
  }, [])

  return (
    <div className="w-full md:min-h-[700px] md:shadow-2xl">
      {children}
    </div>
  )
}
