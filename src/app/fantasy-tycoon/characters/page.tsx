'use client';
import CharacterList from '../components/CharacterList';
import { HudBar } from '../components/HudBar';
import { PageTemplate } from '../components/ui/PageTemplate';

export default function FantasyTycoonPageCharacters() {
  return (
    <PageTemplate pageId="characters">
      <div className="flex-1">
        <HudBar />
      </div>
      <CharacterList />
    </PageTemplate>
  );
}
