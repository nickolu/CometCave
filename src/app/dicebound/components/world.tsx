'use client'

/**
 * What the story has written down.
 *
 * Everything here has been recorded for a while — places, people and loose ends
 * have been accumulating on the server since the world graph landed — and none
 * of it was visible. This is the part of the sheet that says the game has been
 * paying attention.
 *
 * Three rules shape it.
 *
 * Nothing renders until it exists. Every section returns null when it is empty,
 * so a brand-new character sees a name, some numbers and a couple of skills,
 * exactly as before. An empty "People you know" heading would advertise a system
 * the player has not met yet and make the sheet feel like a form to fill in.
 *
 * No numbers where a relationship belongs. Disposition is rendered by
 * `describeDisposition` as words and never as a value — a visible +2 turns a
 * person into a stat to farm, and a player choosing dialogue for the increment
 * has stopped playing the game.
 *
 * Loose ends come last and are the reason to come back. Pressure is shown
 * because "urgent" is the difference between a list and a reason to open the
 * tab; the fuse time behind it is not, because a countdown in minutes would
 * turn the fiction into a timer.
 */
import type { Campaign } from '@/app/dicebound/domain/campaign'
import {
  type ActorEntity,
  type Entity,
  PLAYER_ID,
  type ThreadEntity,
  type World,
  currentPlace,
  describeClock,
  describeDisposition,
  openThreads,
  relevanceWindow,
} from '@/app/dicebound/domain/world'

const PRESSURE_STYLE: Record<string, string> = {
  urgent: 'text-ds-error',
  pressing: 'text-ds-tertiary',
  patient: 'text-on-surface-variant/70',
}

export function WorldPanel({ campaign }: { campaign: Campaign }) {
  const world = campaign.world

  // The same window the dungeon master is given, so the player sees the cast the
  // DM is actually holding in mind rather than a different, longer list.
  const { entities } = relevanceWindow(world)
  const here = currentPlace(world)
  const threads = openThreads(world)

  const people = entities.filter(
    (entity): entity is ActorEntity => entity.kind === 'actor' && entity.id !== PLAYER_ID
  )
  const things = entities.filter(
    (entity): entity is Entity => entity.kind === 'thing' || entity.kind === 'place'
  )
  const elsewhere = things.filter(entity => entity.id !== here?.id)

  // A world nobody has written to yet. The story is still just prose, which is
  // a perfectly good state — say nothing rather than show empty headings.
  if (!here && people.length === 0 && elsewhere.length === 0 && threads.length === 0) {
    return null
  }

  return (
    <>
      <Where world={world} here={here} />
      <People people={people} />
      <Around things={elsewhere} />
      <LooseEnds threads={threads} />
    </>
  )
}

function Heading({ children }: { children: React.ReactNode }) {
  return (
    <h3 className="font-label text-label-caps uppercase tracking-widest text-on-surface-variant">
      {children}
    </h3>
  )
}

function Where({ world, here }: { world: World; here: Entity | null }) {
  return (
    <section>
      <Heading>Where you are</Heading>
      <p className="mt-2 text-body-md text-on-surface">
        {here ? here.name : 'Somewhere the story has not named yet'}
      </p>
      {here?.state && <p className="mt-0.5 text-sm text-on-surface-variant">{here.state}</p>}
      <p className="mt-1.5 text-xs uppercase tracking-wide text-on-surface-variant/70">
        {describeClock(world.clock)}
      </p>
    </section>
  )
}

function People({ people }: { people: ActorEntity[] }) {
  if (people.length === 0) return null

  return (
    <section>
      <Heading>People you know</Heading>
      <ul className="mt-3 flex flex-col gap-2.5">
        {people.map(person => {
          const standing = describeDisposition(person.disposition)
          return (
            <li key={person.id}>
              <p className="text-sm text-on-surface">{person.name}</p>
              {(standing || person.state) && (
                <p className="text-xs text-on-surface-variant">
                  {[person.state, standing].filter(Boolean).join(' — ')}
                </p>
              )}
            </li>
          )
        })}
      </ul>
    </section>
  )
}

function Around({ things }: { things: Entity[] }) {
  if (things.length === 0) return null

  return (
    <section>
      <Heading>On record</Heading>
      <ul className="mt-3 flex flex-col gap-2">
        {things.map(thing => (
          <li key={thing.id}>
            <p className="text-sm text-on-surface">{thing.name}</p>
            {thing.state && <p className="text-xs text-on-surface-variant">{thing.state}</p>}
          </li>
        ))}
      </ul>
    </section>
  )
}

function LooseEnds({ threads }: { threads: ThreadEntity[] }) {
  if (threads.length === 0) return null

  return (
    <section>
      <Heading>Loose ends</Heading>
      <ul className="mt-3 flex flex-col gap-2.5">
        {threads.map(thread => (
          <li key={thread.id}>
            <p className="text-sm text-on-surface">{thread.name}</p>
            <p
              className={`text-xs uppercase tracking-wide ${
                PRESSURE_STYLE[thread.pressure] ?? 'text-on-surface-variant/70'
              }`}
            >
              {thread.pressure}
            </p>
          </li>
        ))}
      </ul>
    </section>
  )
}
