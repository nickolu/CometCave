# Chat Room of Infinity

Chat Room of Infinity is a chat room where users can add fictional characters to chat with and simulate a conversation.

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
