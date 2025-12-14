# Fantasy Tycoon: Move Forward Event System – Micro Sprints

## 1. Implement LLM Agentic Workflow for Event Generation

**Goal:**  
Create a workflow to call the LLM and generate 3 structured event objects, given the story context and character state.

**Tasks:**

- Define the schema for an event (description, options, probabilities, outcomes).
- Write a prompt for the LLM to generate events in this schema.
- Implement a function to call the LLM, pass context, and parse the structured response.
- Add error handling and fallback logic for malformed LLM outputs.

---

## 2. Add Character Attributes to Game State

**Goal:**  
Extend the character model to include relevant attributes (e.g., strength, intelligence, luck).

**Tasks:**

- Decide on a set of attributes relevant to event outcomes.
- Update the character type/interface and storage.
- Ensure attributes are accessible in event generation and resolution logic.

---

## 3. Update Move Forward Logic

**Goal:**  
Integrate the new event system into the move-forward API route.

**Tasks:**

- If roll = 0, return a random generic message.
- If roll = 1, use the LLM workflow to generate and return event options.
- Refactor the API response structure to support both cases.

---

## 4. UI: Display Events and Options

**Goal:**  
Update the frontend to display generated events and allow user option selection.

**Tasks:**

- Render event descriptions and options in the UI.
- Allow the user to select an option and trigger the resolution flow.
- Handle generic messages for roll = 0.

---

## 5. Implement Option Resolution Logic

**Goal:**  
Determine success/failure for user-chosen options, factoring in character attributes.

**Tasks:**

- Calculate the probability of success using option base probability and relevant attributes.
- Roll to determine outcome, then apply success/failure results.
- Update the game state and story feed accordingly.

---

## 6. Refactor, Document, and Test

**Goal:**  
Ensure code clarity, maintainability, and robustness.

**Tasks:**

- Refactor for separation of concerns (event generation, resolution, attribute management).
- Add/Update TypeScript types and interfaces.
- Write tests for the new logic.
- Document the system and usage.

---
