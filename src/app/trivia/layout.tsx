import { AuthProvider } from '@/hooks/useAuth'

import type { ReactNode } from 'react'

export default function TriviaLayout({ children }: { children: ReactNode }) {
  return <AuthProvider>{children}</AuthProvider>
}
