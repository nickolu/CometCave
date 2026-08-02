'use client'

import { CosmicShell } from '@/app/comet-cards/components/cosmic/shell'

import { MicroLandGame } from './MicroLandGame'

/**
 * Micro Land takes over the viewport.
 *
 * A canvas world with a fixed tool dock can't share vertical space with the
 * site header — the controls end up below the fold and the world gets a
 * letterbox it doesn't need. Interaction model 2 covers this case: a game may
 * take over the viewport as long as it carries its own cave exit, which is the
 * ✕ CosmicShell already puts top-left.
 *
 * z-40 sits above the site nav (z-30) and below this game's own modals (z-50).
 */
export default function MicroLandPage() {
  return (
    <div className="fixed inset-0 z-40">
      <CosmicShell>
        <div style={{ position: 'relative', width: '100%', height: '100%' }}>
          <MicroLandGame />
        </div>
      </CosmicShell>
    </div>
  )
}
