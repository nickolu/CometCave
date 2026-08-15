'use client'

/**
 * What the character has become, and what they can do.
 *
 * Level, class and powers — the three things the sheet did not show once they
 * became real. It lives beside `world.tsx` rather than inside `sheet.tsx` for
 * the same reason that file does: the sheet is a layout, and the panels that
 * fill it each have their own rule about when to say nothing.
 *
 * That rule is invariant 17, and it is the whole design here. **Nothing renders
 * until it exists.** No greyed-out power slots, no "Class: —", no locked panel
 * hinting at what unlocks it. A character who has never been granted a power
 * must not be able to tell the system is there — because five systems all
 * announcing themselves as empty is how a hand-made thing starts feeling like a
 * form to fill in. Almost nothing else protects this rule; the component test
 * beside it is the protection.
 *
 * Two smaller decisions worth keeping:
 *
 * A spent power still reads as a power. Zero of three charges is a fact about
 * tonight, not about the character, so it is never a disabled row — the name
 * stays at full contrast and only the pips go hollow.
 *
 * Provenance is the point. "Taught by Keeper Imra" is what makes a power feel
 * like something that happened rather than something that was awarded, and it
 * is the world graph earning its keep somewhere the player can actually see.
 */
import type { Campaign } from '@/app/dicebound/domain/campaign'
import { earnedRanks } from '@/app/dicebound/domain/character'
import { type Item, type Power, type Species, levelFor } from '@/app/dicebound/domain/kit'
import type { World } from '@/app/dicebound/domain/world'

function Heading({ children }: { children: React.ReactNode }) {
  return (
    <h3 className="font-label text-label-caps uppercase tracking-widest text-on-surface-variant">
      {children}
    </h3>
  )
}

/**
 * Level and class, as one quiet line under the concept.
 *
 * Level 1 is not shown. Everyone starts there, so printing it says nothing
 * about this character and everything about there being a ladder — which is
 * precisely the framing the game does not want on turn one. It appears the
 * moment it means something, which is also the moment it is worth noticing.
 */
export function Standing({ campaign }: { campaign: Campaign }) {
  const level = levelFor(earnedRanks(campaign.character))
  const className = campaign.kit.className

  if (level <= 1 && !className) return null

  return (
    <p className="mt-2 flex flex-wrap items-baseline gap-x-2 gap-y-1 text-sm">
      {level > 1 && (
        <span className="font-headline font-extrabold tabular-nums text-ds-tertiary">
          Level {level}
        </span>
      )}
      {className && <span className="text-on-surface">{className}</span>}
    </p>
  )
}

export function Powers({ campaign }: { campaign: Campaign }) {
  const powers = campaign.kit.powers
  if (powers.length === 0) return null

  return (
    <section>
      <Heading>What you can do</Heading>
      <ul className="mt-3 flex flex-col gap-3">
        {powers.map(power => (
          <PowerRow key={power.id} power={power} world={campaign.world} />
        ))}
      </ul>
    </section>
  )
}

/**
 * Species beside the concept, not in a list.
 *
 * It is what the character is, so it lives in the header next to the sentence
 * they wrote. Both the trait and the drawback are named — the cost is the reason
 * the package is interesting, and hiding it would make species read as a free bonus.
 */
export function SpeciesLine({ species }: { species: Species | null }) {
  if (!species) return null

  const traitStr = species.trait.label
  const drawbackStr = species.drawback.label

  return (
    <p className="mt-1 text-sm text-on-surface-variant">
      <span className="font-semibold text-on-surface">{species.name}</span>
      {species.note ? ` — ${species.note}` : ''}
      {'. '}
      <span>{traitStr}</span>
      <span className="mx-1 text-on-surface-variant/50">·</span>
      <span className="text-on-surface-variant/80">{drawbackStr}</span>
    </p>
  )
}

/**
 * The pack — what the character is currently carrying.
 *
 * Item name, note, and each trait label. The bonus number appears only when it
 * is not zero: most items are +0 and that is the design, but a column of "+0"
 * reads as a game that has run out of things to give; the label alone reads as
 * a description of a rope.
 *
 * Nothing renders when the pack is empty. Invariant 17.
 */
export function Items({ campaign }: { campaign: Campaign }) {
  const { items } = campaign.kit
  if (items.length === 0) return null

  return (
    <section>
      <Heading>What you carry</Heading>
      <p className="mt-1 text-xs text-on-surface-variant/70">
        {items.length} of 12 slots
      </p>
      <ul className="mt-3 flex flex-col gap-3">
        {items.map(item => (
          <ItemRow key={item.id} item={item} world={campaign.world} />
        ))}
      </ul>
    </section>
  )
}

function ItemRow({ item, world }: { item: Item; world: World }) {
  const from = item.origin ? (world.entities[item.origin]?.name ?? null) : null

  return (
    <li className="border-l-2 border-outline-variant/40 pl-3">
      <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1">
        <p className="text-sm font-semibold text-on-surface">{item.name}</p>
        {item.charges && (
          <span className="tabular-nums text-xs text-on-surface-variant">
            {item.charges.now}/{item.charges.max} uses
          </span>
        )}
      </div>

      {item.note && <p className="mt-0.5 text-xs text-on-surface-variant">{item.note}</p>}

      {item.traits.length > 0 && (
        <ul className="mt-1 flex flex-wrap gap-x-3 gap-y-0.5 text-xs text-on-surface-variant/70">
          {item.traits.map(trait => (
            <li key={trait.label}>
              {trait.label}
              {trait.bonus !== 0 && (
                <span className="ml-1 font-mono text-ds-tertiary">
                  {trait.bonus > 0 ? `+${trait.bonus}` : `${trait.bonus}`}
                </span>
              )}
            </li>
          ))}
        </ul>
      )}

      {from && <p className="mt-1 text-xs text-on-surface-variant/60">From {from}</p>}
    </li>
  )
}

function PowerRow({ power, world }: { power: Power; world: World }) {
  const spent = power.charges.now <= 0
  const from = provenance(power, world)

  return (
    <li className="border-l-2 border-ds-tertiary/40 pl-3">
      <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1">
        {/* Full contrast whether or not it is spent. A power you have used up
            tonight is still a power you have. */}
        <p className="text-sm font-semibold text-on-surface">{power.name}</p>
        <Charges now={power.charges.now} max={power.charges.max} />
      </div>

      {power.note && <p className="mt-0.5 text-xs text-on-surface-variant">{power.note}</p>}

      <p className="mt-1 flex flex-wrap gap-x-2 text-xs text-on-surface-variant/70">
        {from && <span>{from}</span>}
        <span>
          {spent
            ? power.refresh === 'rest'
              ? 'Back after you rest'
              : 'Back next chapter'
            : power.refresh === 'rest'
              ? 'Refreshes on a rest'
              : 'Refreshes each chapter'}
        </span>
        {power.cost && <span>Costs: {power.cost}</span>}
      </p>
    </li>
  )
}

/**
 * Where it came from, in words, or nothing.
 *
 * The id is looked up in the graph rather than printed. `keeper-imra` is a
 * database key and the player never agreed to read one; if the entity has aged
 * out of the world the line is simply dropped, because a slug on the sheet is
 * worse than a missing sentence.
 */
function provenance(power: Power, world: World): string | null {
  const from = world.entities[power.source]
  return from ? `From ${from.name}` : null
}

/**
 * Charges as pips, plus the same fact in words.
 *
 * The pips are decorative and `aria-hidden`; the sentence beside them is what a
 * screen reader gets, and it is also the fallback for anyone who cannot tell
 * the filled pip from the hollow one. Charges must not be carried by colour or
 * shape alone (CLAUDE.md #8), and a row of dots is exactly the kind of thing
 * that quietly becomes colour-only when someone restyles it later.
 */
function Charges({ now, max }: { now: number; max: number }) {
  return (
    <span className="flex shrink-0 items-center gap-1.5">
      <span aria-hidden className="flex items-center gap-1">
        {Array.from({ length: max }, (_, index) => (
          <span
            key={index}
            className={`h-2 w-2 rounded-full ${
              index < now ? 'bg-ds-tertiary' : 'border border-outline-variant bg-transparent'
            }`}
          />
        ))}
      </span>
      <span className="tabular-nums text-xs text-on-surface-variant">
        {now}/{max}
      </span>
      <span className="sr-only">
        {now === 0 ? 'no charges left' : `${now} of ${max} charges left`}
      </span>
    </span>
  )
}
