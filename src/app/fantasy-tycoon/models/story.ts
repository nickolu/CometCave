export interface FantasyStoryEvent {
  id: string;
  type: string;
  description: string;
  characterId: string;
  locationId: string;
  questId?: string;
  timestamp: string;
  // For decision events
  selectedOptionId?: string;
  selectedOptionText?: string;
  outcomeDescription?: string;
  resourceDelta?: {
    gold?: number;
    reputation?: number;
    distance?: number;
    statusChange?: string;
    rewardItems?: RewardItem[];
  };
  rewardItems?: RewardItem[];

}

export interface RewardItem {
  id: string;
  qty: number;
}

export interface FantasyDecisionOption {
  id: string;
  text: string;
  // Probability of success (0-1)
  baseProbability?: number;
  // Which character attributes affect this option (e.g., ['strength', 'luck'])
  relevantAttributes?: Array<'strength' | 'intelligence' | 'luck'>;
  // How much each attribute modifies probability per point (optional, default 0.01)
  attributeModifiers?: Partial<Record<'strength' | 'intelligence' | 'luck', number>>;
  // Effects and description on success
  successDescription?: string;
  successEffects?: {
    gold?: number;
    reputation?: number;
    distance?: number;
    statusChange?: string;
    rewardItems?: RewardItem[];
  };
  // Effects and description on failure
  failureDescription?: string;
  failureEffects?: {
    gold?: number;
    reputation?: number;
    distance?: number;
    statusChange?: string;
    rewardItems?: RewardItem[];
  };
  // For backward compatibility
  resultDescription?: string;
  effects?: {
    gold?: number;
    reputation?: number;
    distance?: number;
    statusChange?: string;
    rewardItems?: RewardItem[];
  };
  // Direct reward (for simple events)
  rewardItems?: RewardItem[];
}

export interface FantasyDecisionPoint {
  id: string;
  eventId: string;
  prompt: string;
  options: FantasyDecisionOption[];
  resolved: boolean;
  chosenOptionId?: string;
}
