"use client";
import GameUI from "./components/GameUI";
import { PageTemplate } from "./components/ui/PageTemplate";
import { useGameStore } from "./hooks/useGameStore";

import CharacterList from "./components/CharacterList";
import { HudBar } from "./components/HudBar";

type initialView = "game" | "characters";

export default function FantasyTycoonPage() {
  const { gameState } = useGameStore();

  let initialView: initialView = "characters";

  if (gameState?.selectedCharacterId) {
    initialView = "game";
  }

  return <PageTemplate pageId={initialView}>
    <div className="flex-1">
      <HudBar />
    </div>
    {initialView === "game" && <GameUI />}
    {initialView === "characters" && <CharacterList />}
  </PageTemplate>;
}
