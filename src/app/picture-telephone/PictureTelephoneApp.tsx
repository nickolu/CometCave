'use client'

import { getPersonality } from '@/lib/picture-telephone/personalities'
import { buildSteps } from '@/lib/picture-telephone/rotation'

import { CaveExit } from './components/CaveExit'
import { Handoff } from './components/Handoff'
import { Reveal } from './components/Reveal'
import { Setup } from './components/Setup'
import { Turn } from './components/Turn'
import { Working } from './components/Working'
import { usePictureTelephone } from './store'

/* Picture Telephone — a pass-the-device game with an immersive layout (the game
   owns the window and its own exit). Anyone can open the page; starting a game
   goes through AiGate unless the client mock is on. The session is
   `setup -> (handoff | turn | working)* -> reveal`, and the whole game lives in
   memory. */

export default function PictureTelephoneApp() {
  const { state, dispatch, start, submit } = usePictureTelephone()
  const { phase, settings, entries, actorId, job, error, notice, stepIndex } = state

  const seat = settings?.seats.find(s => s.id === actorId)
  const total = settings ? buildSteps(settings.chainLength, settings.seats.length).length : 0
  const inProgress = phase !== 'setup' && phase !== 'reveal'
  const last = entries[entries.length - 1]

  return (
    <div className="pt-root">
      <header className="pt-bar">
        <CaveExit inProgress={inProgress} />
        <span className="pt-title">Picture Telephone</span>
        {inProgress && (
          <span className="pt-progress" aria-label={`Step ${Math.min(stepIndex + 1, total)} of ${total}`}>
            {Math.min(stepIndex + 1, total)}/{total}
          </span>
        )}
      </header>

      <div className="pt-stage">
        {phase === 'setup' && <Setup onStart={start} />}

        {phase === 'handoff' && seat && (
          <Handoff key={`handoff-${stepIndex}`} name={seat.name} onReady={() => dispatch({ type: 'HANDOFF_READY' })} />
        )}

        {phase === 'turn' && seat && settings && (
          <Turn
            key={`turn-${stepIndex}-${seat.id}`}
            name={seat.name}
            image={last?.kind === 'image' ? last.src : null}
            isFinal={stepIndex === 2 * settings.chainLength}
            canAiStart={entries.length === 0}
            notice={notice}
            onSubmit={submit}
            onAiStarts={() => dispatch({ type: 'AI_STARTS' })}
          />
        )}

        {phase === 'working' && job && (
          <Working
            kind={job.kind}
            name={seat && seat.kind === 'ai' ? seat.name : 'The AI'}
            emoji={seat?.kind === 'ai' ? getPersonality(seat.personalityId).emoji : undefined}
            error={error}
            onRetry={() => dispatch({ type: 'RETRY' })}
          />
        )}

        {phase === 'reveal' && settings && (
          <Reveal
            entries={entries}
            seats={settings.seats}
            onPlayAgain={() => dispatch({ type: 'START', settings })}
            onNewSetup={() => dispatch({ type: 'RESET' })}
          />
        )}
      </div>
    </div>
  )
}
