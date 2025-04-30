# Fantasy Tycoon: Inventory Management System

## Overview

The inventory system in Fantasy Tycoon enables each player to collect, store, and manage items acquired throughout their adventure. Items are primarily gained as rewards from story events and decision outcomes. The system is designed to be robust, strictly typed, and client-authoritative, ensuring consistency and a smooth user experience.

---

## Inventory Data Model

- **Inventory**: Each player has an `inventory` array, stored as part of the `GameState` object.  
- **Item**: Each inventory item is represented by an `Item` type:

```typescript
interface Item {
  id: string;
  name: string;
  description: string;
  icon: string;
  quantity: number;
}
```

---

## How Items Are Awarded

### 1. Event-Driven Rewards

Items are awarded to players primarily through **story events** and **decision outcomes**. There are several ways an event can specify item rewards:

- **Root-level `rewardItems`**: Some events or decision options may specify a `rewardItems` array directly.
- **Effects-based rewards**: Item rewards can be included in the `effects`, `successEffects`, or `failureEffects` objects of a decision option.
- **LLM Extraction**: If the outcome text of an event or decision describes a reward, a utility function (`extractRewardItemsFromText`) uses either regex or the OpenAI API to extract item rewards from the text.

### 2. Server API Behavior

- The server-side API routes (`/api/v1/fantasy-tycoon/resolve-decision` and `/move-forward`) are **stateless** regarding inventory.
- When resolving an event or decision, the API gathers all possible item rewards from the event structure and outcome text, and returns them as a `rewardItems` array in the response.
- The API does **not** mutate or persist inventory; it only reports rewards.

### 3. Client-Side Inventory Mutation

- **All inventory changes happen on the client.**  
- When the client receives a response from the server containing `rewardItems`, it uses the `addItem` utility to update the local inventory state. This ensures all item rewards are reflected in the player's inventory.
- This logic is implemented in the React hooks:
  - `useResolveDecisionMutation`: Handles rewards from decision outcomes.
  - `useMoveForwardMutation`: Handles rewards from random or LLM-driven events.
- The updated inventory is persisted to localStorage as part of the `GameState`.

---

## Inventory Actions

- **Add Item**: The `addItem` utility ensures that adding an item will increment the quantity if the item already exists, or add a new entry if it does not.
- **Remove Item**: The `removeItem` utility removes an item from the inventory.
- **Update Quantity**: The `updateQuantity` utility sets the quantity of an item, removing it if the quantity is zero or less.

---

## Example Reward Flow

1. **Player makes a decision** in the game.
2. The client sends the decision to the server API.
3. The server determines the outcome and collects all item rewards into a `rewardItems` array.
4. The client receives the response, loops through all `rewardItems`, and applies them to the local inventory.
5. The inventory is updated and persisted, and the UI reflects the new items.

---

## Best Practices & Notes

- **Never mutate inventory on the server.** All inventory logic is client-authoritative for consistency and reliability.
- **Strict typing** is enforced throughout the inventory system for safety and maintainability.
- **Reward extraction** is robust: even if an event only describes a reward in text, the system attempts to extract and award it.
- **UI**: The inventory panel displays all items, and updates in real time as rewards are acquired.

---

## Extending the System

- To add new item types, update the item database and ensure new events reference valid item IDs.
- To add new reward sources, ensure they include a `rewardItems` array or descriptive text that can be parsed by the extraction utility.

---

**Summary:**  
The inventory system is designed to be reliable, extensible, and user-centric. All item rewards flow from events and decisions through the API to the client, where inventory is updated and persisted, ensuring that players always see the correct items they have earned.
