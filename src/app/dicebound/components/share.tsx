'use client'

/**
 * Share (interaction model 6 / CLAUDE.md principle 6).
 *
 * What gets shared is the most recent roll, not the game. A link saying
 * "I'm playing Dicebound" is an advertisement; "Pell Tannerby needed a 15 to
 * pick the lock and rolled a natural 20" is a story, and it carries the rules
 * of the game inside it — someone reading it learns what this game *is* from
 * the shape of the sentence.
 *
 * Before the first roll there is nothing worth sharing but the premise, so
 * that is what it falls back to. The link always drops the visitor straight
 * into play (principle 1), never onto a marketing page.
 */
import { useState } from 'react'

import { SKILLS } from '@/app/dicebound/domain/attributes'
import type { Campaign, CheckEntry } from '@/app/dicebound/domain/campaign'
import { BAND_LABEL } from '@/app/dicebound/domain/dice'

function lastCheck(campaign: Campaign): CheckEntry | null {
  for (let i = campaign.transcript.length - 1; i >= 0; i--) {
    const entry = campaign.transcript[i]
    if (entry.kind === 'check') return entry
  }
  return null
}

export function shareText(campaign: Campaign): string {
  const check = lastCheck(campaign)
  const who = campaign.character.name

  if (!check) {
    return `${who} is about to find out what happens in "${campaign.title}" — ${campaign.premise}.`
  }

  const skill = check.skill ? ` (${SKILLS[check.skill].name})` : ''
  const flourish = check.roll === 20 ? ' Natural 20.' : check.roll === 1 ? ' Natural 1.' : ''

  return `${who} tried to ${check.attempt.toLowerCase()}${skill}. Needed ${check.dc}, rolled ${check.roll}${check.modifier >= 0 ? '+' : '−'}${Math.abs(check.modifier)} = ${check.total}. ${BAND_LABEL[check.band]}.${flourish}`
}

export function ShareButton({ campaign }: { campaign: Campaign }) {
  const [copied, setCopied] = useState(false)

  const share = async () => {
    const url = typeof window !== 'undefined' ? `${window.location.origin}/dicebound` : ''
    const text = shareText(campaign)

    // The OS sheet where there is one, clipboard everywhere else. A cancelled
    // share throws AbortError, which is not a failure worth reporting.
    if (typeof navigator !== 'undefined' && navigator.share) {
      try {
        await navigator.share({ title: campaign.title, text, url })
        return
      } catch {
        return
      }
    }

    try {
      await navigator.clipboard.writeText(`${text}\n\n${url}`)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    } catch {
      // Clipboard blocked. Nothing useful to say, and nothing broken.
    }
  }

  return (
    <button
      type="button"
      onClick={share}
      className="shrink-0 rounded-full border-2 border-outline-variant bg-surface-container px-3 py-2 text-sm text-on-surface-variant transition-colors hover:border-ds-primary/60 hover:text-on-surface focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ds-primary"
    >
      <span className="material-symbols-outlined align-middle text-[20px]" aria-hidden="true">
        {copied ? 'check' : 'ios_share'}
      </span>
      <span className="sr-only">{copied ? 'Copied' : 'Share this roll'}</span>
      <span aria-live="polite" className="sr-only">
        {copied ? 'Copied to clipboard' : ''}
      </span>
    </button>
  )
}
