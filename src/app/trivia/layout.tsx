import { AuthProvider } from '@/hooks/useAuth'

import type { ReactNode } from 'react'

export default function TriviaLayout({ children }: { children: ReactNode }) {
  return (
    <AuthProvider>
      <div className="min-h-screen">{children}</div>
    </AuthProvider>
  )
}
