'use client'

/**
 * The character sheet.
 *
 * This is the game's second screen and its main reason to come back, so it is
 * built to reward re-reading rather than to be complete. Attributes are fixed
 * and shown plainly; skills are the interesting half, because a new sheet has
 * none at all and every one that appears is a record of something the player
 * actually did.
 *
 * Skills in progress are shown too, greyed, with the progress toward the next
 * rank. Hiding them until they land would make ranks feel like they arrive at
 * random; showing the counter turns "the DM keeps asking me to balance" into
 * a goal the player can see coming. The counter keeps running after the first
 * rank lands, for the same reason — see `SkillRow`.
 */
import {
  ATTRIBUTES,
  ATTRIBUTE_GROUPS,
  ATTRIBUTE_IDS,
  type AttributeId,
  SKILLS,
  type SkillId,
} from '@/app/dicebound/domain/attributes'
import type { Campaign } from '@/app/dicebound/domain/campaign'
import { type SkillRecord, usesToNextRank } from '@/app/dicebound/domain/character'

import { Powers, Standing } from './kit'
import { WorldPanel } from './world'

function sign(value: number): string {
  return value >= 0 ? `+${value}` : `${value}`
}

export function Sheet({ campaign }: { campaign: Campaign }) {
  const { character, stats } = campaign

  const touched = Object.entries(character.skills)
    .map(([skill, record]) => ({ skill: skill as SkillId, record: record as SkillRecord }))
    .filter(entry => entry.record.rank !== 0 || entry.record.uses > 0)

  return (
    <div className="flex h-full flex-col gap-6 overflow-y-auto p-5">
      <header>
        <h2 className="font-headline text-headline-md text-on-surface">{character.name}</h2>
        <p className="mt-1 text-body-md text-on-surface-variant">{character.concept}</p>
        <Standing campaign={campaign} />
        {character.reading && (
          <p className="mt-3 border-l-2 border-ds-tertiary/50 pl-3 text-sm italic text-on-surface-variant">
            {character.reading}
          </p>
        )}
      </header>

      <section>
        <h3 className="font-label text-label-caps uppercase tracking-widest text-on-surface-variant">
          Attributes
        </h3>
        <div className="mt-3 flex flex-col gap-4">
          {ATTRIBUTE_GROUPS.map(group => (
            <div key={group}>
              <p className="mb-1.5 text-xs uppercase tracking-wide text-on-surface-variant/70">
                {group}
              </p>
              <ul className="flex flex-col gap-1">
                {ATTRIBUTE_IDS.filter(id => ATTRIBUTES[id].group === group).map(id => (
                  <AttributeRow key={id} id={id} value={character.attributes[id]} />
                ))}
              </ul>
            </div>
          ))}
        </div>
      </section>

      <section>
        <h3 className="font-label text-label-caps uppercase tracking-widest text-on-surface-variant">
          Skills
        </h3>
        {touched.length === 0 ? (
          <p className="mt-2 text-sm text-on-surface-variant">
            None yet. Skills are earned by using them — keep playing and the sheet will fill itself
            in.
          </p>
        ) : (
          <ul className="mt-3 flex flex-col gap-2">
            {touched
              .sort(
                (a, b) =>
                  b.record.rank - a.record.rank ||
                  b.record.uses - a.record.uses ||
                  SKILLS[a.skill].name.localeCompare(SKILLS[b.skill].name)
              )
              .map(({ skill, record }) => (
                <SkillRow key={skill} skill={skill} record={record} />
              ))}
          </ul>
        )}
      </section>

      <Powers campaign={campaign} />

      <WorldPanel campaign={campaign} />

      <section>
        <h3 className="font-label text-label-caps uppercase tracking-widest text-on-surface-variant">
          At the table
        </h3>
        <dl className="mt-3 grid grid-cols-2 gap-x-4 gap-y-2 text-sm">
          <Stat label="Turns" value={stats.turns} />
          <Stat label="Checks" value={stats.checks} />
          <Stat
            label="Made"
            value={
              stats.checks > 0 ? `${Math.round((stats.successes / stats.checks) * 100)}%` : '—'
            }
          />
          <Stat label="Day streak" value={campaign.currentStreak} />
          <Stat label="Natural 20s" value={stats.naturalTwenties} tone="text-ds-tertiary" />
          <Stat label="Natural 1s" value={stats.naturalOnes} tone="text-ds-error" />
        </dl>
      </section>
    </div>
  )
}

function AttributeRow({ id, value }: { id: AttributeId; value: number }) {
  return (
    <li className="flex items-baseline justify-between gap-3 border-b border-outline-variant/50 pb-1">
      <span className="text-body-md text-on-surface">{ATTRIBUTES[id].name}</span>
      <span
        className={`font-headline tabular-nums font-extrabold ${
          value > 0 ? 'text-ds-primary' : value < 0 ? 'text-ds-error' : 'text-on-surface-variant'
        }`}
      >
        {sign(value)}
      </span>
    </li>
  )
}

function SkillRow({ skill, record }: { skill: SkillId; record: SkillRecord }) {
  const innate = SKILLS[skill].innate
  // Non-zero, not positive: an innate Size of −2 is live on every Size check,
  // so it belongs on the sheet as a number rather than as an em dash.
  const active = record.rank !== 0
  // Innate ranks never advance, so they never show progress toward a next one.
  // `usesToNextRank` returns null at max rank too, which is the other case with
  // nothing left to count toward.
  const remaining = innate ? null : usesToNextRank(record.uses)

  return (
    <li className="flex items-baseline justify-between gap-3">
      <span className={`text-sm ${active ? 'text-on-surface' : 'text-on-surface-variant/70'}`}>
        {SKILLS[skill].name}
        {/*
          Shown at every rank, not only before the first one. This used to be
          gated on `!active` against a hardcoded `RANK_THRESHOLDS[0]`, which
          meant the counter vanished the moment a skill reached +1 — and since
          rank 2 is 8 uses and rank 3 is 18, the five or ten checks spent
          climbing toward them were invisible on the one screen that exists to
          record what the player did. A sheet that shows 3/3 and then nothing
          reads as a game where +1 is the ceiling. The denominator is derived
          from `usesToNextRank` rather than named, so it follows the thresholds
          wherever they land next.
        */}
        {remaining !== null && (
          <span className="ml-2 text-xs text-on-surface-variant/60">
            {record.uses}/{record.uses + remaining}
          </span>
        )}
      </span>
      <span
        className={`shrink-0 tabular-nums text-sm font-semibold ${
          record.rank > 0
            ? 'text-ds-tertiary'
            : record.rank < 0
              ? 'text-ds-error'
              : 'text-on-surface-variant/50'
        }`}
      >
        {active ? sign(record.rank) : '—'}
        {innate && active && (
          <span className="ml-1 text-xs font-normal text-on-surface-variant/60">innate</span>
        )}
      </span>
    </li>
  )
}

function Stat({
  label,
  value,
  tone = 'text-on-surface',
}: {
  label: string
  value: string | number
  tone?: string
}) {
  return (
    <div className="flex items-baseline justify-between gap-2">
      <dt className="text-on-surface-variant">{label}</dt>
      <dd className={`font-headline tabular-nums font-extrabold ${tone}`}>{value}</dd>
    </div>
  )
}
