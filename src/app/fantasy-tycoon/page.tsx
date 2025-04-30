"use client";
import GameUI from "./components/GameUI";
import { PageTemplate } from "./components/ui/PageTemplate";

export default function FantasyTycoonPage() {
  return <PageTemplate pageId="game">
    <GameUI />
  </PageTemplate>;
}
