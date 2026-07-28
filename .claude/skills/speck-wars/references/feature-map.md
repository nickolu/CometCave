# Speck Wars — Feature Map

Last updated after epic #2327 simplification (all stat-modifier sprawl removed).

## Core systems (all active)

### Production
- Each building spawns units at a fixed interval; `spawnTimer` counts down each tick.
- Surge (`SURGE` input): doubles spawn rate for 8 s, 45 s cooldown. Player only.
- Spawn type per building: player switches between basic / heavy / scout via keys 1/2/3.
- Capturing an outpost grants a new production building; owning all three doubles total output.

### Movement and orders
- `RALLY` — move selection to world position; updates `assignedRallyX/Y` on each speck.
- `ATTACK_MOVE` — move and engage enemies en route.
- `STOP` — set state to `idle`.
- `HOLD` — set `holdPosition = true`; speck stays put, attacks only adjacent enemies.
- `SET_BUILDING_RALLY` — per-building rally; specks spawned from that building march there immediately.
- Guard bubble: player specks at their rally engage enemy buildings within 130 px (`GUARD_ENGAGE_RANGE`).
- AI specks attack-move to the nearest enemy building autonomously.

### Combat
- Melee range: 6–8 px depending on unit type.
- Rock-paper-scissors type advantage: Heavy > Basic (×1.3), Scout > Heavy (×1.35), Basic > Scout (×1.25).
- Veteran kills bonuses: 3 kills = +20% dmg, 6 kills = +35%, 12 kills = +50% + AoE splash.
- Buildings lose HP from adjacent enemy specks; regen when not attacked for 5 s.
- Base regen: 0.5 HP/s. Outpost regen: 2 HP/s.

### Capture
- Specks within 100 px of a neutral/enemy outpost advance capture at rate 1.0 (flat — no unit-count scaling).
- Contested: opponent presence reverses capture at rate 0.5.
- Full capture takes 5 000 ms (`CAPTURE_TIME`).

### Victory
- Destroy enemy base → destruction victory.
- Hold all 3 outposts for 60 s → domination victory (`DOMINATION_TIME`).
- AI base HP ≤ 20% → AI may surrender (difficulty-dependent).

### Fog of war
- Vision: 150 px per speck, 300 px around player base, 180 px around owned buildings.
- Fog alpha: 0.85. Implemented in `rendering/layers/fog-layer.ts`.

### AI
- Three personalities: `aggressive`, `macro`, `balanced`.
- Hard/very-hard: coordinated wave assaults every 90 s, 15 s duration.
- AI counter-spawns to exploit type advantage.
- No rubber-banding; no adaptive difficulty.

### Minimap
- Downsampled live speck positions + building positions.
- Left-click on minimap → rally player specks to that world position.

## Removed systems (epic #2327)
Do not reference these in new code or tests:

- Garrison / recall garrison (`garrison.ts` deleted)
- Research / upgrade tiers
- Fortification (outpost fortify timer, +25% dmg aura)
- Creep camps and camp boost
- Daily modifier (spawn multiplier, damage modifier pool)
- Commander / hero unit
- Sacrifice mechanic
- Player build-turret action (turrets still fire as building fixtures; player cannot place them)
- Player stance system (aggressive / defensive / balanced)
- Adaptive AI difficulty / rubber-banding (`dominanceTimer`, `lastStandTriggered`)
- Construction system (`construction.ts` deleted, `underConstruction` flag)
- Supply cap
- Rally cry (HP-threshold global buff)
- Triple-outpost +2× production bonus
- AI last-stand forced rally override
- Unit abilities (`unit-abilities.ts` deleted)
