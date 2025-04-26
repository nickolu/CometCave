export interface FantasyQuest {
  id: string;
  title: string;
  description: string;
  status: 'available' | 'active' | 'completed' | 'failed';
  giverNpcId: string;
  locationId: string;
  objectives: string[];
  rewards: {
    gold?: number;
    reputation?: number;
    items?: string[];
  };
  expiration?: string;
}
