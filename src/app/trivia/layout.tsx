import { AuthProvider } from '@/hooks/useAuth'

import type { ReactNode } from 'react'

export default function TriviaLayout({ children }: { children: ReactNode }) {
  // No height styling here — the root <main> in src/app/layout.tsx is
  // already flex-1 inside a min-h-screen flex column with header + footer,
  // so trivia content fills exactly the leftover viewport space.
  return <AuthProvider>{children}</AuthProvider>
}
