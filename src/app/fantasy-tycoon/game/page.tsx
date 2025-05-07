'use client';
import GameUI from '@/app/fantasy-tycoon/components/GameUI';
import { PageTemplate } from '@/app/fantasy-tycoon/components/ui/PageTemplate';
import { HudBar } from '@/app/fantasy-tycoon/components/HudBar';

export default function FantasyTycoonPage() {
  return (
    <PageTemplate pageId="game">
      <div className="flex-1">
        <HudBar />
      </div>
      <GameUI />
    </PageTemplate>
  );
}
