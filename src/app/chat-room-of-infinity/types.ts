export type CharacterStatus = 'online' | 'away' | 'busy' | 'offline'

export type HumanUser = {
  name: string
  status: CharacterStatus
  description?: string
  avatar?: string
}

export type Character = {
  id: string
  name: string
  description: string
}

export type ChatMessage = {
  id: string
  character: Character
  message: string
  timestamp: number
}

export type UserListState = {
  isCollapsed: boolean
  characters: Character[]
  humanUser: HumanUser
}

export interface ChatState {
  messages: ChatMessage[]
  isTyping: boolean
  typingCharacters: Character[]
}

export type UserSelectorState = {
  isOpen: boolean
  availableCharacters: Character[]
}

export type CustomCharacterFormState = {
  isOpen: boolean
  name: string
  description: string
}
