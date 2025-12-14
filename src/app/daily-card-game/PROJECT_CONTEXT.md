Balatro-Inspired Game Architecture (POC)

This document summarizes the core architectural decisions for modeling scoring, jokers, and rules in this Balatro-inspired card game. The goal is to enable flexible, data-driven behavior (especially jokers) without hard-coding logic into the scoring system.

High-Level Goal

Avoid logic like:
if (joker.type === 'HEART_BONUS') { ... }

Instead, build a system where:

- Scoring emits events
- Jokers and other modifiers react to events
- Scoring logic is unaware of jokers
- All behavior is data + effects

This allows new jokers to be added without changing scoring code.

Core Idea: Event-Driven Scoring

Scoring does not calculate outcomes directly.
It narrates what happens via events.

Example scoring flow:

1. Emit HAND_SCORING_START
2. For each card:

   - Emit CARD_SCORED

3. Emit HAND_SCORING_END

Scoring itself is linear and dumb. All complexity lives in effects.

Game Events

A minimal first-pass event model:

GameEvent is a discriminated union with:

- HAND_SCORING_START (handCards, score)
- CARD_SCORED (card, index, score)
- HAND_SCORING_END (handCards, score)
- ROUND_START (round)
- ROUND_END (round)
- JOKER_TRIGGERED (jokerId, sourceEvent)

This small set supports most Balatro-style jokers.

Score State

Do not store score as a single number.
Use structured state that effects can mutate.

ScoreState:

- chips
- mult

Final score is derived (chips \* mult), not stored.

Effects (Core Abstraction)

Jokers, Arcane cards, Tags, Vouchers, and Stakes all work the same way internally.
They provide effects.

An Effect consists of:

- event: which GameEvent it listens for
- priority: explicit ordering
- condition: optional gate
- apply: mutates shared context

Effects are not identified by name or switch statements.

EffectContext

EffectContext is the shared reality that effects can read and mutate while reacting to an event.

Minimal POC EffectContext:

- event: the current GameEvent
- game: the GameState
- score: the current ScoreState

Effects must only interact through this context.

Example JokerDefinition Effect

JokerDefinition: +10 chips for every Heart card scored

Effect:

- Listens to CARD_SCORED
- Checks card suit
- Mutates score.chips

Scoring code never changes to support this.

Effect Dispatching

When an event is emitted:

- Gather all effects listening to that event
- Sort by priority
- Run condition checks
- Apply effects to shared context

A simple dispatcher is sufficient for a text-only POC.

Design Principles

- Scoring narrates events, effects rewrite outcomes
- No rule names, no switches
- All modifiers are behavior, not identifiers
- Order is explicit and priority-based
- Effects mutate shared context
- UI is optional; console logging is enough

Mental Model

Scoring does not calculate.
Scoring tells a story.
Jokers rewrite the story.

This architecture is intentionally minimal for a POC, but scales cleanly to retriggering jokers, temporary effects, per-round decay, and complex Balatro-style interactions.
