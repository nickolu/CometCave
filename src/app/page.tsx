import Link from 'next/link'

import { ChunkyButton } from '@/components/ui/chunky-button'
import { ChunkyCard, ChunkyCardContent } from '@/components/ui/chunky-card'
import { Pill } from '@/components/ui/pill'

import { ROUTE_CONSTANTS } from './route-constants'

const games: readonly { title: string; icon: string; href: string; description: string; hot?: boolean }[] = [
  { title: 'Daily Trivia', icon: 'quiz', href: ROUTE_CONSTANTS.TRIVIA, description: 'Test your knowledge with daily AI-curated questions', hot: true },
  { title: 'I-Ching Oracle', icon: 'auto_awesome', href: ROUTE_CONSTANTS.ORACLE, description: 'Seek wisdom and guidance from the ancient I-Ching' },
  { title: 'Tap Tap Adventure', icon: 'swords', href: ROUTE_CONSTANTS.TAP_TAP_ADVENTURE, description: 'Tap to travel, fight monsters, and collect loot' },
  { title: 'Secret Word', icon: 'lock', href: ROUTE_CONSTANTS.SECRET_WORD, description: 'Guess the secret word!' },
  { title: 'Voters', icon: 'how_to_vote', href: ROUTE_CONSTANTS.VOTERS, description: 'Create AI voters and see how they vote on topics' },
  { title: 'Whowouldwininator', icon: 'sports_mma', href: ROUTE_CONSTANTS.WHOWOULDWININATOR, description: 'Create two characters and see who would win' },
  { title: 'Chat Room of Infinity', icon: 'chat', href: ROUTE_CONSTANTS.CHAT_ROOM, description: 'Chat with fictional characters in a chat room' },
  { title: 'Avatar Maker', icon: 'face', href: ROUTE_CONSTANTS.AVATAR_MAKER, description: 'Create unique AI-powered avatars from your photos' },
]

export default function Home() {
  return (
    <div className="flex flex-col gap-12 py-12 max-w-5xl mx-auto">
      {/* Hero */}
      <ChunkyCard variant="surface-container" shadow="hero" className="border-[6px]">
        <ChunkyCardContent className="py-12 px-8 text-center flex flex-col items-center gap-6">
          <Pill tone="info" icon="rocket_launch">NEW RELEASE</Pill>
          <h1 className="font-headline text-headline-lg text-on-surface drop-shadow-[0_4px_0_var(--surface-container-lowest)]">
            Comet Cave
          </h1>
          <p className="text-body-lg text-on-surface-variant max-w-xl">
            AI Dream Arcade — explore an infinite galaxy of games, challenges, and cosmic adventures.
          </p>
          <Link href={ROUTE_CONSTANTS.TRIVIA}>
            <ChunkyButton variant="primary" size="hero" iconEnd={<span className="material-symbols-outlined">play_circle</span>}>
              START QUESTING
            </ChunkyButton>
          </Link>
        </ChunkyCardContent>
      </ChunkyCard>

      {/* Arcade Floor */}
      <section>
        <h2 className="font-headline text-headline-md text-on-surface mb-6 flex items-center gap-3">
          <span className="material-symbols-outlined text-ds-tertiary text-[32px]" style={{ fontVariationSettings: "'FILL' 1" }}>
            sports_esports
          </span>
          Arcade Floor
        </h2>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-gutter">
          {games.map((game) => (
            <Link key={game.href} href={game.href}>
              <ChunkyCard variant="surface-variant" interactive cornerGlow="primary" className="h-full">
                <ChunkyCardContent className="pt-6 pb-6 flex flex-col items-center text-center gap-3">
                  <div className="flex items-center justify-center w-16 h-16 rounded-full bg-ds-surface border-2 border-outline-variant">
                    <span className="material-symbols-outlined text-[32px] text-ds-primary" style={{ fontVariationSettings: "'FILL' 1" }}>
                      {game.icon}
                    </span>
                  </div>
                  {game.hot && <Pill tone="hot" pulse icon="local_fire_department">HOT!</Pill>}
                  <h3 className="font-headline text-lg font-bold text-on-surface">{game.title}</h3>
                  <p className="text-body-md text-on-surface-variant text-sm">{game.description}</p>
                </ChunkyCardContent>
              </ChunkyCard>
            </Link>
          ))}
        </div>
      </section>
    </div>
  )
}
