'use client'

import Link from 'next/link'

export const Navigation = ({ pageId }: { pageId: string }) => {
  const baseClasses = 'rounded-md border border-[#3a3c56] px-4 py-2 font-medium transition-colors'
  const activeClasses = 'bg-[#3a3c56] text-white'
  const inactiveClasses = 'bg-[#1e1f30] text-gray-400 hover:bg-[#2a2b3f] hover:text-white'

  const className = (id: string) =>
    `${baseClasses} ${pageId === id ? activeClasses : inactiveClasses}`

  return (
    <div className="flex space-x-2">
      <Link href="/fantasy-tycoon/characters" className={className('characters')}>
        Characters
      </Link>
      <Link href="/fantasy-tycoon/game" className={className('game')}>
        Game
      </Link>
    </div>
  )
}
