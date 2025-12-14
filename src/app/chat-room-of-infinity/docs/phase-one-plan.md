# Chat Room of Infinity

Chat Room of Infinity is a chat room where users can add fictional characters to chat with and simulate a conversation.

## Phase 1 Plan

### Components to Build

[x] User List - list of users currently in the chat room
[x] Human User Item - represent the current user in the chat, no option to remove
[x] Avatar - avatar of the user
[x] Name - name of the user - can click to edit
[x] Status - status of the user - click to open dropdown to select

[x] User List Item - individual user in the chat room
[x] Avatar - avatar of the user
[x] Name - name of the user
[x] Status - status of the user
[x] Kick User Button
[x] User List Add Character Button - opens User Selector
[x] Collapse User List Button - toggles the user list collapse state

[x] Chat - chat window
[x] Self Message - individual message sent by the current user
[x] Other Message - individual message sent by another user
[x] Input - input field for chat
[x] Send Button - button to send chat message
[x] User Is Typing Message - indicator that another user is typing
[x] Scroll to Bottom Button - button to scroll to bottom of chat
[x] Reset Chat Button - button to reset the chat

[x] User Selector - character selection (hidden by default)
[x] Character List - list of characters to choose from
[x] Custom Character Button - opens Custom Character Form
[x] Generate More Characters Form - inline form to generate more characters
[x] Generate More Characters Input (optional)
[x] Generate More Characters Button

[x] Custom Character Form - form to create a custom character
[x] Name - name of the character
[x] Description - description of the character
[x] Save Button - button to save the character

[x] Chat Room of Infinity Page - main page for the game

[x] User Profile Form Dialog - form to edit user profile (opens when clicking human user avatar)
[x] Name - name of the user
[x] Status - status of the user
[x] Description - description of the user
[x] Save Button - button to save the user profile

### Application State

[x] User List State - list of users currently in the chat room
[x] Chat State - list of messages in the chat
[x] User Selector State - list of characters to choose from
[x] Custom Character Form State - form to create a custom character

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

[ ] GET /v1/agent/conversationManager { chatMessages: ChatMessage[], characters: Character[] } => { respondingCharacters: Character[] }

[ ] GET /v1/agent/character { character: Character, chatMessages: ChatMessage[] } => { response: string }

[ ] GET /v1/agent/characterGenerator { previousCharacters: Character[], criteria: string } => { newCharacters: Character[] }

[x] GET /v1/agent/safety { message: string } => { safe: boolean, reason: string }
