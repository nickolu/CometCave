"use client";
import CharacterList from "../components/CharacterList";
import { PageTemplate } from "../components/ui/PageTemplate";

export default function FantasyTycoonPageCharacters() {
  return <PageTemplate pageId="characters">
    <CharacterList onSelect={(character) => console.log(character)} />
  </PageTemplate>;
}
