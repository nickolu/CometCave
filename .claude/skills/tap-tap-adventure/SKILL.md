---
name: tap-tap-adventure
description: Working on Tap Tap Adventure (src/app/tap-tap-adventure) — the walk-and-see RPG at /tap-tap-adventure where every tap is a step, the road writes the story and the player answers it from a playbill. Load before changing the stage (GameStage, Drawers, PlaybillStrip, the panels), the walk/decision/combat mutations, the Zustand store, landmarks and maps, mounts, party and hiring, or any of its API routes. Covers the rule that the store is frozen and mutations write through a clone, the loop of "the bill is asking, so the road waits", the Paper Stage material rules, how to verify a change against the dev preview, and the hazards that make a win look fine and quietly leave the fight open.
---

# Tap Tap Adventure — Skill Document

## What this covers

Tap Tap Adventure is a one-button RPG at `/tap-tap-adventure`. Tap WALK to take
a step; hold it to keep walking. Things happen on the road — events with
choices, landmarks, towns, strangers, fights, shops — and the player answers
them on the playbill. Everything lives under `src/app/tap-tap-adventure`, plus
the routes under `src/app/api/v1/tap-tap-adventure`.

- `references/architecture.md` — the file map, the three loops (walk, decide,
  fight), how state flows from a route into the store, and where each piece of
  the screen is drawn.
- `src/app/tap-tap-adventure/stage/README.md` — the Paper Stage: the four
  materials, the three type faces, and the rules every panel is set in. Read it
  before touching anything visible.
- `src/app/tap-tap-adventure/README.md` is a stale "Fantasy Tycoon" document
  from the game's first life. Don't trust it; don't delete it without asking.

## Whose game this is

Product direction is Nick's. When a change is a design decision rather than a
repair, offer real options back — plain language, but each option has to
change what gets built and say what it costs.

Decisions already made, not to be reopened by a PR:

- **November 2026 redesign, "The Paper Stage".** A Victorian paper toy theatre:
  peacock-blue and gilt proscenium (never red — red plus a wood type read as a
  saloon), painted card flats per region, cut-outs on sticks for the actors,
  playbill cream for anything that carries text, Comet Mint for the WALK bar and
  nothing else. Built in code; the image-generation fallback is dead in this
  environment, so assets are SVG and CSS.
- **Every feature stayed.** The redesign cut no panels. The journey (WALK plus
  the unfolding story) is the stage; everything else is one of six drawers:
  Pack, Gear, Quests, Map, Party, Town.
- **The game owns the whole window.** Tap Tap is in `IMMERSIVE_ROUTES`
  (`src/components/layout-shell.tsx`); the cave's chrome is not shown inside it
  and the "Cave" door top-left is the exit. No page scroll: the theatre is
  `100dvh`, wings and apron scroll inside it.
- **Logic, store, hooks and API are fixed; everything visible is open.** The
  redesign re-set rendering only. Keep it that way: a visual change should not
  need a store change, and a rules change should not need a new panel.
- **The game sits behind `<AiGate>`.** It is generated content, so it needs a
  real sign-in and draws from the daily allowance (`tap-tap-text`, weight 2, in
  `src/lib/ai/limits.ts`). Don't add an anonymous path.

Nick's playtest decisions from November 2026, all shipped and not to be undone:
tap-to-step and hold-to-walk with the same keyboard shortcuts as before; the
map drawer stays open while walking (docked beside the stage on desktop, a
sheet over it on phones with WALK still underneath); no walking while the bill
is asking; the location list is on the map as well as on arrival; the area map
has no landmark-to-landmark roads; a map item opens the map on what it
revealed; hiring happens in town only; distance reads as whole kilometres.

## The game in one paragraph

A character is a name, a race, a class and four stats (strength, intelligence,
luck, charisma), with HP, mana, gold, reputation and a distance walked that
sets level and day. The world is a tree of fourteen-plus countries, each with
a few landmarks laid out in 2D and an exit per neighbouring country; the
player picks a target and each step moves toward it. Arriving at a landmark
asks explore-or-pass; a town opens doors (shop, inn, notice board, stable,
mailbox, blacksmith, waypoints, townspeople); an exit asks whether to enter the
next country, which the first time means a guardian fight. Between those, a
model writes events with two to four options and the server resolves the pick
against the stats. Fights are turn-based with action points, items, spells,
combos, mounts, mercenaries and companions. Beating a country's guardian
conquers it for the main quest; dying ends the run, pays soul essence to the
meta-progression camp, and leaves an heirloom.

## Invariants

1. **The store is frozen. Never write into an object you got from it.** The
   store is Zustand with `immer`'s `produce`, which deep-freezes every state it
   returns, and ES modules are strict, so `character.mainQuest.status = …`
   throws. `getSelectedCharacter()`, `useGameStore.getState().gameState.*` and
   everything reached from them are read-only. Library functions take the
   object and return a new one (`claimNewMilestones` is the worked example;
   it used to mutate and the guardian fight could never be won). If a function
   "mutates in place", it is a bug waiting for the first frozen caller.

2. **A mutation writes through its builder clone, then commits once.**
   `useGameStateBuilder()` takes `structuredClone(gameState)` on every render
   and hands back writers (`updateSelectedCharacter`, `addItem`,
   `addStoryEvent`, `setCombatState`, `setDecisionPoint`, `setShopState`,
   `setGenericMessage`) that edit the clone, and `commit()` that saves the
   whole clone over the store. Consequences that are easy to miss:
   - A direct store write (`useGameStore.getState().someAction()`) made
     between the clone and `commit()` is **overwritten by the commit**. Either
     do it through the builder or do it after `commit()`. The win-combats daily
     challenge was lost this way for months.
   - Inside a mutation, `useGameStore.getState()` sees the **pre-commit**
     store, not the clone. To read what you have written so far, read the
     builder's `gameState` (exported from the hook as the clone).
   - Anything that throws before `commit()` leaves the store exactly as it
     was. In the combat mutation that means the fight stays open, the enemy
     keeps its HP, and the player can win it again. Keep the victory path free
     of anything that can throw after the server has answered; put optional
     bookkeeping after the essential writes.

3. **When the bill is asking, the road waits.** An unresolved
   `decisionPoint` (an event, an arrival, a town, a stranger), an active
   `combatState`, or an open `shopState` all block walking. `GameStage`'s
   `roadBlocked()` reads the live store so a stale auto-walk interval cannot
   slip a step through, the pointer handlers refuse to start auto-walk, the
   keyboard handler returns early, and the footlights swap the WALK bar for a
   brass placard that says why ("Choose on the bill", "In Hearthwood", "The
   road waits", "Browsing the stall"). A new interrupting state must be added
   to all of those, not just to the apron.

4. **Decision option ids are a protocol between server and stage.** The
   move-forward service builds options with ids the client switches on:
   `explore-landmark`, `bypass-landmark`, `bypass-toward-<index|exit>`,
   `enter-town`, `leave-town`, `travel-<regionId>`, `turn-back`, `stay`,
   `visit-shop` / `rest-at-inn` / `visit-stable` / `check-mailbox` /
   `visit-notice-board` / `visit-blacksmith` / `visit-waypoints`,
   `talk-to-npc-<id>`, `engage-conversation` / `walk-away`, `pay-bounty`,
   `fight-secret-boss`. `handleResolveDecision` in `GameStage.tsx` intercepts
   the ones that open a door client-side, `useResolveDecisionMutation` resolves
   bypass and travel client-side without a round trip, and the `skipResults`
   list decides which ids print a "What came of it" result. A new id has to be
   threaded through every one of those or it either does nothing or prints an
   empty result.

5. **Landmark indices are positions, and exits sit past the last landmark.**
   `landmarkState.activeTargetIndex` and `nextLandmarkIndex` index into
   `landmarks`; the exit for connected country *i* is `landmarks.length + i`.
   Anything that inserts into `landmarks` (a map item generating a new place)
   must shift every index at or after the insertion point, including an exit
   target. `itemEffects.ts` does this; copy it rather than re-deriving.

6. **One rule for how much of a place the player can see.** `discoveryTier`
   in `lib/discovery.ts` turns distance plus `{ explored, hidden, mapped }`
   into `hidden | distant | unknown | revealed`, and the area map, the
   playbill caption and the server's arrival options all call it. `mapped` is
   set by maps and charts and means "known by name at any distance"; without it
   a revealed place more than 100 km away silently disappears again. Don't
   re-implement the ladder anywhere.

7. **Distance is tenths of a kilometre in storage and whole kilometres on the
   bill.** Mounts step 1.2, 1.3, 1.4 or 1.5 km and float addition drifts into
   `1493.4999999999868`. Every write to `distance` or `positionInRegion` goes
   through `roundKm` in `lib/leveling.ts`; every print uses `Math.round`.

8. **Hiring happens in town.** `MercenaryPanel` takes `canHire` and only prints
   the tavern lists when the Town drawer is live (`!!townHub`). Companions met
   on the road are recruited through dialogue (`NPCDialoguePanel.onRecruit`),
   which is the "special event" path and works anywhere.

9. **Model routes go through the gate; engine routes don't.** `combat/start`,
   `resolve-decision`, `shop/generate`, `npc/dialogue`, `party/dialogue`,
   `quest/generate`, `classes/generate` and `skill-tree/generate` call
   `requireAiAccess(req, 'tap-tap-text')` and are reached with `aiFetch`,
   which turns a refusal into a message fit to show. `combat/action`,
   `shop/sell`, `shop/purchase` and `leaderboard` are pure code and use plain
   `fetch`. **Open gap:** `move-forward` calls gpt-4o through
   `generateLLMEvents` on most steps and is not gated. It is reached with plain
   `fetch`. Gating it at weight 2 would spend the daily allowance in sixty
   steps, so this is a budget decision for Nick, not a drive-by fix.

10. **The Paper Stage rules are not optional.** Four materials, three type
    faces on the Tailwind ramp, `PaperButton` for every action, a `Stamp` for
    every tag, `BrassPlate` for every number, no hex, no gradients, no glows,
    no emoji as a control icon, and Comet Mint only on the WALK bar. The full
    list with the component for each case is in `stage/README.md`. Chrome copy
    is plain ("Something went wrong. Try again."); the bill's copy is the
    game's voice.

11. **Persisted shape changes need a migration.** The store persists to
    localStorage under `fantasy-tycoon-storage` (name kept for old saves) at
    `version: 40` with a `migrate`. A new optional field with a zod `.default`
    or `.optional()` needs nothing; a renamed or re-typed field needs the
    version bumped and a migrate step, or every returning player loads a
    broken save.

## Verifying a change

- **Unit tests:** `npx vitest run src/app/tap-tap-adventure` — 55 files, under
  five seconds, no network. The engines (combat, items, landmarks, leveling,
  quests, crafting) are well covered; the stage and the mutations are not, so a
  behaviour fix in a hook should come with a test of the library function
  underneath it (`mapItemReveal.test.ts` and `mainQuestMilestones.test.ts` are
  the pattern: build a small character, call the pure function, assert on the
  returned object, and when the bug was "it threw on a frozen object", freeze
  the input with `produce` in the test).
- **Types:** `npx tsc --noEmit`. The repo carries pre-existing errors in
  `src/app/dicebound/**/__tests__` and in `tap-tap-adventure/__tests__/partyCombat.test.ts`;
  a clean run is "no errors in files you touched", so filter the output.
- **Lint:** `npx eslint <files you touched>`. Most old files fail
  `import/order` and `sort-imports` already; don't fix that wholesale in a
  feature PR, and don't add to it — put a new import where the sorted order
  would want it even when its neighbours are out of order.
- **Look at it.** The dev-only preview renders the real stage from a fixture
  with no sign-in and no model call:
  `/tap-tap-adventure/preview?s=idle|decision|arrival|social|combat|shop|town|foyer|creation|summary&drawer=pack|gear|quests|map|party|town&sub=<sub tab>&town=tavern|stable|mailbox|notice|blacksmith|waypoints|npc&d=<km>`.
  With the dev server on port 3000, headless Chrome screenshots it:
  ```
  "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome" --headless=new --disable-gpu --hide-scrollbars \
    --window-size=1400,1000 --virtual-time-budget=6000 --screenshot=out.png \
    "http://localhost:3000/tap-tap-adventure/preview?s=town&drawer=party"
  ```
  Use 1400 wide for desktop and 420 wide for the phone layout (Chrome's CLI
  clamps narrower windows). Check both: the drawers dock on desktop and rise
  as a sheet on phones, and the footlights move. The fixture is `wren()` in
  `preview/page.tsx`; extend it rather than hand-building state in a test.
- **Live model calls cost money.** A real walk hits gpt-4o on most steps.
  When a fix needs the real road, take a few steps, not a session, and prefer
  the preview or a unit test for anything that doesn't depend on the model's
  prose.

## Known hazards

- **A guardian fight that cannot be won.** The symptom: beat the guardian, get
  the loot (often a mount, since bosses drop them a quarter of the time), and
  the enemy is still standing with HP; win again, same thing. The cause was an
  exception in the victory path (invariant 1 and 2). If it comes back, look for
  anything in `useCombatActionMutation`'s victory branch that writes into
  `character` or throws before `commit()`.

- **The mount-naming dialog lives inside `CombatUI`, which unmounts on
  victory.** `onMountDrop` sets state in a component the same commit removes,
  so a mount dropped in a fight is never named or equipped through that
  dialog. It only ever appeared because the victory path was throwing. Moving
  the dialog up to `GameStage` is the fix; it has not been done.

- **The client predicts the server.** `handleMoveForward` works out whether the
  next step lands on a target or a shop milestone and only calls the server
  then or on a 97% coin flip; the other 3% prints a generic travel line and
  increments distance locally. The two must agree on step size, target
  positions and `hasArrived`'s threshold, or the client walks past something
  the server would have stopped at.

- **Town doors close on a new decision id.** `GameStage` watches
  `decisionPoint.id` and closes every town panel when it changes. Opening a
  door and then resolving something that replaces the decision point will shut
  the door under the player; that is intended for "leave town", surprising for
  anything else.

- **`eventResult` is shown for everything not in `skipResults`.** A new
  server-resolved option that prints a sensible "What came of it" needs
  nothing; one that is really a navigation (go here, open that) must be added
  to the list or the player gets a result card with nothing on it.

- **Hidden landmarks auto-reveal within 20 km, server-side.** The service
  flips `hidden` when the target is close. If a secret place reveals "on its
  own", that is why, not a map item.

- **The preview's `initial*` props on `GameStage` are for the preview only.**
  The game never passes them. Don't make a feature depend on them.

- **`combat/action` is pure, so it can be replayed.** It takes the whole
  combat state in the request and returns the next one; nothing is stored
  server-side. That is what makes fights cheap and deterministic to test, and
  it is also why a client that fails to commit the response can resend the
  same winning action forever.

- **Keyboard shortcuts are a contract.** Space/Enter walk, 1–4 pick a line,
  Escape closes a drawer, `?` opens the help, and the fight keys are listed in
  `KeyboardHelp.tsx`. Change the panel and keep the keys.

## House style

Prettier: no semicolons, single quotes, 2-space, 100 cols, `arrowParens: avoid`.
ESLint wants grouped and alphabetized imports and `@/…` aliases.

Comments explain *why*, and several are the only record of a bug that took a
day to find. Match that register: a tuned number carries the reason for its
value; a guard carries the failure it prevents. Copy in the game follows the
bill's voice (short, printed, a little wry); copy in errors and empty states is
plain. Commit messages: `fix(tap-tap): <lowercase phrase>` with a body that
explains the reasoning, not the diff.
