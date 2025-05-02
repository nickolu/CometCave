"use client";
import GameUI from "@/app/fantasy-tycoon/components/GameUI";
import { PageTemplate } from "@/app/fantasy-tycoon/components/ui/PageTemplate";

export default function FantasyTycoonPage() {
  return <PageTemplate pageId="game">
    <GameUI />
  </PageTemplate>;
}
