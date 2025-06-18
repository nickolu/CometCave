import type React from 'react';
import Link from 'next/link';
import { MoonIcon } from '@/components/moon-icon';
import { PlanetIcon } from '@/components/planet-icon';
import { StarIcon } from '@/components/star-icon';
import { BallotIcon } from '@/components/ballot-icon';
import { ROUTE_CONSTANTS } from './route-constants';
import { SecretWordIcon } from '@/components/secret-word-icon';

export default function Home() {
  return (
    <div className="flex flex-col gap-12 py-12">
      <div className="text-center max-w-3xl mx-auto">
        <h1 className="text-7xl font-bold text-cream-white mb-6">Comet Cave</h1>
        <p className="text-slate-400 text-xl">AI Dream Arcade</p>
      </div>

      <div
        id="games"
        className="max-w-4xl mx-auto w-full mt-8 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6"
      >
        <GameCard
          title="Secret Word"
          icon={<SecretWordIcon />}
          href={ROUTE_CONSTANTS.SECRET_WORD}
          description="Guess the secret word!"
        />

        <GameCard
          title="Voters"
          icon={<BallotIcon />}
          href={ROUTE_CONSTANTS.VOTERS}
          description="Create AI voters and see how they vote on different topics!"
        />

        <GameCard
          title="Fantasy Tycoon"
          icon={<StarIcon />}
          href={ROUTE_CONSTANTS.FANTASY_TYCOON}
          description="Play as a fantasy character and explore the world!"
        />

        <GameCard
          title="Ring Toss"
          icon={<MoonIcon />}
          href={ROUTE_CONSTANTS.RING_TOSS}
          description="Test your aim in this classic carnival game!"
        />

        <GameCard
          title="AI Character Chat Room"
          icon={<PlanetIcon />}
          href={ROUTE_CONSTANTS.CHAT_ROOM}
          description="Chat with fictional characters in a chat room!"
        />
      </div>
    </div>
  );
}

function GameCard({
  title,
  icon,
  href,
  description,
}: {
  title: string;
  icon: React.ReactNode;
  href: string;
  description: string;
}) {
  return (
    <Link
      href={href}
      className="bg-space-dark rounded-2xl p-6 flex flex-col items-center hover:bg-space-dark/80 transition-colors border border-space-dark hover:border-space-purple/30 group"
    >
      <div className="w-24 h-24 mb-4 transform group-hover:scale-105 transition-transform">
        {icon}
      </div>
      <h3 className="text-xl font-bold text-cream-white text-center">{title}</h3>
      <p className="text-slate-400 text-sm text-center mt-2">{description}</p>
    </Link>
  );
}
