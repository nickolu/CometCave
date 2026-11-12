import Link from 'next/link'

import { ChunkyButton } from '@/components/ui/chunky-button'
import { ChunkyCard, ChunkyCardContent } from '@/components/ui/chunky-card'
import { Pill } from '@/components/ui/pill'

import { ROUTE_CONSTANTS } from './route-constants'

const games: readonly { title: string; icon: string; href: string; description: string; hot?: boolean }[] = [
  { title: 'Daily Trivia', icon: 'quiz', href: ROUTE_CONSTANTS.TRIVIA, description: 'Ten fresh questions a day — beat the clock, keep your streak', hot: true },
  { title: 'Clusters', icon: 'grid_view', href: ROUTE_CONSTANTS.CLUSTERS, description: 'Sixteen words hide four groups of four — find them all before four mistakes' },
  { title: 'Meteor Coins', icon: 'toll', href: ROUTE_CONSTANTS.METEOR_COINS, description: 'Time your drops from a swinging arm and push a heap of coins over the edge' },
  { title: 'Hum', icon: 'graphic_eq', href: ROUTE_CONSTANTS.HUM, description: 'Turn a flat line into sound one knob at a time, then build a beat from it' },
  { title: 'Starmatch', icon: 'hub', href: ROUTE_CONSTANTS.STARMATCH, description: 'Two star charts, one shared sign — race to spot the twin' },
  { title: 'Comet Cards', icon: 'style', href: ROUTE_CONSTANTS.COMET_CARDS, description: 'Daily Cards — Stack chips, multiply, and bend the rules with jokers' },
  { title: 'I-Ching Oracle', icon: 'auto_awesome', href: ROUTE_CONSTANTS.ORACLE, description: 'Seek wisdom and guidance from the ancient I-Ching' },
  { title: 'Tap Tap Adventure', icon: 'swords', href: ROUTE_CONSTANTS.TAP_TAP_ADVENTURE, description: 'Tap to travel, fight monsters, and collect loot' },
  { title: 'Secret Word', icon: 'lock', href: ROUTE_CONSTANTS.SECRET_WORD, description: 'Guess the secret word!' },
  { title: 'Voters', icon: 'how_to_vote', href: ROUTE_CONSTANTS.VOTERS, description: 'Invent a crowd of voters and see how they split on any question' },
  { title: 'Whowouldwininator', icon: 'sports_mma', href: ROUTE_CONSTANTS.WHOWOULDWININATOR, description: 'Create two characters and see who would win' },
  { title: 'Chat Room of Infinity', icon: 'chat', href: ROUTE_CONSTANTS.CHAT_ROOM, description: 'Chat with fictional characters in a chat room' },
  { title: 'Avatar Maker', icon: 'face', href: ROUTE_CONSTANTS.AVATAR_MAKER, description: 'Turn a photo into an avatar in any style you can name' },
  { title: 'Speck Wars', icon: 'bug_report', href: ROUTE_CONSTANTS.SPECK_WARS, description: 'Command your specks to capture enemy bases in this real-time strategy micro-battle' },
  { title: 'Disneyland Hunt', icon: 'search', href: ROUTE_CONSTANTS.DISNEYLAND_HUNT, description: 'Scavenger hunt checklist for your Disneyland visit — track finds, earn bonus stars' },
  { title: 'Micro Land', icon: 'pest_control', href: ROUTE_CONSTANTS.MICRO_LAND, description: 'A tiny living world — build the ground, summon creatures, and watch them eat each other' },
  { title: 'Dicebound', icon: 'casino', href: ROUTE_CONSTANTS.DICEBOUND, description: 'Tell a dungeon master what you attempt — the dice decide whether it works' },
]

export default function Home() {
  return (
    <div className="flex flex-col gap-12 py-12 max-w-5xl mx-auto">
      {/* Hero */}
      <ChunkyCard variant="surface-container" shadow="hero" className="border-[6px]">
        <ChunkyCardContent className="grid md:grid-cols-[minmax(0,1fr)_auto] items-center text-center md:text-left gap-6 md:gap-8 px-5 pt-10 pb-8 md:px-10 md:py-12">
          <div className="flex flex-col items-center md:items-start gap-3.5 min-w-0">
            <h1 className="font-headline font-extrabold text-[2.25rem] md:text-[2.75rem] leading-[1.1] tracking-[-0.025em] text-balance text-on-surface drop-shadow-[0_4px_0_var(--surface-container-lowest)]">
              Comet Cave
            </h1>
            <p className="text-body-lg text-on-surface-variant max-w-[30rem] text-pretty">
              A collection of browser games — play daily trivia, card games, strategy, and more.
            </p>
          </div>
          <div className="flex flex-col items-center gap-4 w-full md:w-auto px-8 py-7 rounded-ds-sm bg-surface-container-low shadow-rim-inset-deep border-4 border-surface-container-lowest">
            <Pill tone="info" icon="rocket_launch">NEW RELEASE</Pill>
            <Link href={ROUTE_CONSTANTS.TRIVIA} className="inline-flex rounded-full">
              <ChunkyButton variant="primary" size="hero" iconEnd={<span className="material-symbols-outlined" aria-hidden="true">play_circle</span>}>
                PLAY NOW
              </ChunkyButton>
            </Link>
          </div>
        </ChunkyCardContent>
      </ChunkyCard>

      {/* Arcade Floor */}
      <section>
        <h2 className="font-headline text-headline-md text-on-surface mb-6 flex items-center gap-3">
          <span className="material-symbols-outlined text-ds-tertiary text-[32px]" style={{ fontVariationSettings: "'FILL' 1" }} aria-hidden="true">
            sports_esports
          </span>
          Arcade Floor
        </h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-gutter">
          {games.map((game) => (
            <Link key={game.href} href={game.href}>
              <ChunkyCard variant="surface-variant" interactive cornerGlow="primary" className="h-full">
                <ChunkyCardContent className="pt-5 pb-6 flex flex-col gap-4 text-left">
                  <div className="flex items-center justify-between gap-3">
                    <div className="flex items-center justify-center w-11 h-11 shrink-0 rounded-full bg-ds-surface border-2 border-outline-variant">
                      <span className="material-symbols-outlined text-[22px] text-ds-primary" style={{ fontVariationSettings: "'FILL' 1" }} aria-hidden="true">
                        {game.icon}
                      </span>
                    </div>
                    {game.hot && <Pill tone="hot" size="xs" pulse icon="local_fire_department">HOT!</Pill>}
                  </div>
                  <div className="flex flex-col gap-1.5">
                    <h3 className="font-headline font-extrabold text-[1.4375rem] leading-[1.15] tracking-[-0.02em] text-on-surface text-balance">{game.title}</h3>
                    <p className="text-body-md text-on-surface-variant text-sm text-pretty">{game.description}</p>
                  </div>
                </ChunkyCardContent>
              </ChunkyCard>
            </Link>
          ))}
        </div>
      </section>
    </div>
  )
}
