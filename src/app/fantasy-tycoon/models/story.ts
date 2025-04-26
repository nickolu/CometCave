export interface FantasyStoryEvent {
  id: string;
  type: string;
  description: string;
  characterId: string;
  locationId: string;
  questId?: string;
  timestamp: string;
}

export interface FantasyDecisionOption {
  id: string;
  text: string;
  resultDescription?: string;
  effects?: {
    gold?: number;
    reputation?: number;
    distance?: number;
    statusChange?: string;
  };
}

export interface FantasyDecisionPoint {
  id: string;
  eventId: string;
  prompt: string;
  options: FantasyDecisionOption[];
  resolved: boolean;
  chosenOptionId?: string;
}
