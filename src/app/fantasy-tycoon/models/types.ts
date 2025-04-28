// Central re-export for all Fantasy Tycoon models and schemas (Zod-first, single source of truth)

import { FantasyCharacter } from "./character";
import { Item } from "./item";
import { FantasyLocation } from "./location";
import { FantasyDecisionPoint, FantasyStoryEvent } from "./story";

export type { Item, ItemSchema } from "./item";
export type { FantasyAbility, FantasyAbilitySchema, FantasyCharacter, FantasyCharacterSchema, FantasyNPC, FantasyNPCSchema } from "./character";
export type { FantasyLocation, FantasyLocationSchema, FantasyLocationChoice, FantasyLocationChoiceSchema } from "./location";
export type { FantasyPlayer, FantasyPlayerSchema } from "./player";
export type { FantasyQuest, FantasyQuestSchema } from "./quest";
export type { FantasyStoryEvent, FantasyStoryEventSchema, FantasyDecisionOption, FantasyDecisionOptionSchema, FantasyDecisionPoint, FantasyDecisionPointSchema } from "./story";

type GameState = {
  player: {
    id: string;
    settings: Record<string, unknown>;
  };
  character: FantasyCharacter | null;
  locations: FantasyLocation[];
  storyEvents: FantasyStoryEvent[];
  decisionPoint: FantasyDecisionPoint | null;
  genericMessage: string | null;
  inventory: Item[];
};
export type { GameState };
