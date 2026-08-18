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
import { type Body, CONDITION_LABEL, CONDITION_PHRASE } from '@/app/dicebound/domain/body'
import type { Campaign } from '@/app/dicebound/domain/campaign'
import { type SkillRecord, usesToNextRank } from '@/app/dicebound/domain/character'

import { Items, Powers, SpeciesLine, Standing } from './kit'
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
        <SpeciesLine species={campaign.kit.species} />
        <Standing campaign={campaign} />
        <Condition body={campaign.body} />
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

      <Items campaign={campaign} />
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

/**
 * What is wrong with them, when anything is.
 *
 * **Nothing renders until it exists.** An unhurt character gets no element at
 * all — no empty bar, no greyed-out track with six rungs showing where the
 * damage will go, no "Condition: unhurt". The reason is not tidiness: a new
 * character shown a full-height damage track knows the game is about to hurt
 * them, and that is a promise the first ten minutes should not be making. It is
 * also the difference between a character sheet and a form to fill in. The same
 * rule governs `Standing`, `Powers`, `Items` and every section of the world
 * panel, and a test guards it here because it is the kind of rule a later
 * change breaks without anyone noticing.
 *
 * Words, not a bar and not a number. A segmented health meter reads as a
 * quantity to manage, and avoiding exactly that is why damage is a track rather
 * than hit points (#3769). The strings come from `domain/body.ts` so the sheet
 * and the dungeon master's prompt agree word for word — a player reading
 * "bloodied" here and hearing something else from the DM is the same class of
 * bug as prose disagreeing with the die card.
 *
 * `dying` looks different, and does not rely on colour to do it. The word
 * itself is the signal, which is what a screen reader and a monochrome display
 * both get; the heavier weight and the warmer rule are reinforcement on top of
 * a distinction that is already carried by text (CLAUDE.md #8). No alarm
 * styling beyond that — this is the cave, and the shell stays quiet even when
 * the news is bad.
 *
 * It is a labelled section rather than a bare adjective dropped between the
 * concept and the attributes, so it is announced as a sentence: "Condition.
 * Bloodied — bleeding in a way that is not going to simply stop."
 */
function Condition({ body }: { body: Body }) {
  if (body.condition === 'unhurt') return null

  const grave = body.condition === 'dying' || body.condition === 'dead'

  return (
    <section aria-labelledby="dicebound-condition" className="mt-3">
      <h3 id="dicebound-condition" className="sr-only">
        Condition
      </h3>
      <p
        className={`border-l-2 pl-3 text-sm ${
          grave
            ? 'border-ds-error text-on-surface'
            : 'border-ds-tertiary/50 text-on-surface-variant'
        }`}
      >
        <span
          className={`font-headline ${grave ? 'font-extrabold text-ds-error' : 'font-bold text-on-surface'}`}
        >
          {CONDITION_LABEL[body.condition]}
        </span>
        <span className="mx-1.5 text-on-surface-variant/50">—</span>
        {CONDITION_PHRASE[body.condition]}
      </p>
    </section>
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
