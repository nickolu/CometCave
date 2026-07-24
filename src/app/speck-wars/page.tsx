'use client'

import { CosmicShell } from '../comet-cards/components/cosmic/shell'
import { SpeckWarsGame } from './SpeckWarsGame'

export default function SpeckWarsPage() {
  return (
    <CosmicShell>
      <div style={{ position: 'relative', width: '100%', height: '100%' }}>
        <SpeckWarsGame />
      </div>
    </CosmicShell>
  )
}
