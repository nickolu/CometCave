export type Character = {
  id: string;
  name: string;
  description: string;
};

export type ChatMessage = {
  id: string;
  character: Character;
  message: string;
  timestamp: number;
};

export type UserListState = {
  isCollapsed: boolean;
  characters: Character[];
};

export type ChatState = {
  messages: ChatMessage[];
  isTyping: boolean;
};

export type UserSelectorState = {
  isOpen: boolean;
  availableCharacters: Character[];
};

export type CustomCharacterFormState = {
  isOpen: boolean;
  name: string;
  description: string;
};
