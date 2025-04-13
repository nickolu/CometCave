# Chat Room of Infinity
Chat Room of Infinity is a chat room where users can add fictional characters to chat with and simulate a conversation.

## Plan

### Components to Build
 
[ ] User List - list of users currently in the chat room
  [ ] User List Item - individual user in the chat room
    [ ] Avatar - avatar of the user
    [ ] Name - name of the user
    [ ] Status - status of the user
    [ ] Kick User Button
  [ ] User List Add Character Button - opens User Selector
  [ ] Collapse User List Button - toggles the user list collapse state

[ ] Chat - chat window
  [ ] Self Message - individual message sent by the current user
  [ ] Other Message - individual message sent by another user
  [ ] Input - input field for chat
  [ ] Send Button - button to send chat message
  [ ] User Is Typing Message - indicator that another user is typing

[ ] User Selector - character selection (hidden by default)
  [ ] Character List - list of characters to choose from
  [ ] Custom Character Button - opens Custom Character Form

[ ] Custom Character Form - form to create a custom character
  [ ] Name - name of the character
  [ ] Description - description of the character
  [ ] Save Button - button to save the character

[ ] Chat Room of Infinity Page - main page for the game

### Application State

[ ] User List State - list of users currently in the chat room
[ ] Chat State - list of messages in the chat
[ ] User Selector State - list of characters to choose from
[ ] Custom Character Form State - form to create a custom character

### Agentic Workflow

#### Agents:

1. Conversation Manager Agent - selects which characters should respond to a chat message
2. Character Agent - responds to the conversation when prompted
3. Character Generator Agent - Generates Character ideas 
4. Safety Agent - prevents unsafe messages and characters

Typical Flow:


1. User sends a message
2. Safety Agent checks message for safety
3. Conversation Manager Agent selects which characters should respond
4. Character Agent responds to the conversation
5. Safety Agent checks response for safety


### API

type ChatMessage = {
  character: Character;
  message: string;
};

type Character = {
  name: string;
  description: string;
  id: string;
};

[ ] GET /v1/agent/conversationManager { chatMessages: ChatMessage[], characters: Character[] } => { respondingCharacter: Character }

[ ] GET /v1/agent/character { character: Character, chatMessages: ChatMessage[] } => { response: string }

[ ] GET /v1/agent/characterGenerator { previousCharacters: Character[], criteria: string } => { newCharacters: Character[] }

[ ] GET /v1/agent/safety { message: string } => { safe: boolean, reason: string }

