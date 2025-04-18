# Core Logic & Unit Testing Plan for Chat Room of Infinity

## Progress & Status

### ✅ Completed
- **Message Sending Logic**
  - Unit tests implemented and passing:
    - Appending a user message to the messages array
    - Handling when the messages array is undefined
    - Preventing sending of empty or blank messages
  - Implementation updated so blank/empty messages are ignored

### ⏳ Remaining
- **Character Response Logic**
  - Add unit tests for adding character messages
  - Test toggle for `charactersRespondToEachOther`
  - Ensure correct handling of undefined/null messages array
- **Store Actions & State**
  - Unit tests for toggling settings and persistence
  - Store hydration with missing/partial data
  - Backward compatibility with old store structure
- **Safety & Error Handling**
  - Unit tests for `safe`/`isSafe` safety checks
  - Fallbacks for missing/undefined safety properties
  - Robustness against malformed/missing state

---

## 1. Identify Core Logic to Test
- **Message Sending Logic**
  - Handles sending messages (including null/undefined cases)
  - Appends new messages to the correct array
- **Character Response Logic**
  - Handles character responses depending on `charactersRespondToEachOther` toggle
  - Ensures correct character selection and message creation
- **Store State Management**
  - Zustand store actions: sending messages, adding character messages, toggling settings
  - Store hydration and persistence (especially with partial/missing data)
- **Safety & Error Handling**
  - Safety check logic for message sending (`safe`/`isSafe`)
  - Fallbacks for undefined/null/empty arrays

## 2. Proposed Test Cases

### a. Message Sending
- Sends a user message and appends to messages array
- Handles sending when messages array is undefined/null
- Prevents sending empty or malformed messages

### b. Character Response Logic
- Adds character message when appropriate
- Respects `charactersRespondToEachOther` toggle (on/off)
- Handles undefined/null messages array gracefully

### c. Store Actions & State
- Correctly toggles `charactersRespondToEachOther` and persists state
- Handles store hydration with missing/partial data (e.g., only settings present)
- Backward compatibility: does not break if old store structure is loaded

### d. Safety & Error Handling
- Accepts both `safe` and `isSafe` properties in safety checks
- Fallbacks for missing/undefined safety properties
- Does not crash on malformed or missing state

## 3. Test File Structure Proposal
- `/src/app/chat-room-of-infinity/__tests__/`
  - `messageLogic.test.ts`
  - `characterResponse.test.ts`
  - `store.test.ts`
  - `safetyChecks.test.ts`

## 4. Testing Tools
- **Jest** for test runner and assertions
- **(Optional) React Testing Library** only for logic in hooks, not for component rendering

## 5. Mocking
- Mock Zustand store for logic tests
- Mock API calls if needed for logic (but avoid integration scope)

---

**Summary:**
- Message sending logic is fully tested and robust. Next, we will implement and run unit tests for character response logic.
