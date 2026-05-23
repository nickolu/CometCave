'use client'
import { useEffect, useState } from 'react'

const QUERY = '(max-height: 500px) and (orientation: landscape)'

export function useLandscapeMobile(): boolean {
  const [matches, setMatches] = useState(false)
  useEffect(() => {
    const mql = window.matchMedia(QUERY)
    setMatches(mql.matches)
    const handler = (e: MediaQueryListEvent) => setMatches(e.matches)
    mql.addEventListener('change', handler)
    return () => mql.removeEventListener('change', handler)
  }, [])
  return matches
}
