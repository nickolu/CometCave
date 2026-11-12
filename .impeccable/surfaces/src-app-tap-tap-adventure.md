---
version: 1
slug: "src-app-tap-tap-adventure"
primary_target: "src/app/tap-tap-adventure"
related_targets: ["src/app/tap-tap-adventure/page.tsx","src/app/tap-tap-adventure/game/page.tsx","src/app/tap-tap-adventure/characters/page.tsx"]
---

# Tap Tap Adventure — surface brief

Scope: the whole game at /tap-tap-adventure (roster, creation, run, run summary) — a replacement visual world scoped to the game, inside the cave's shell. Mode: Experience (the player is inside the work); drawers and shops are Operate sub-surfaces that inherit the world.

Audience and job: Nick's household on phones and desktops, returning to the same character for a few minutes at a time. The job is to tap WALK, read what happened, choose, and keep going; everything else (pack, gear, quests, map, party, town) is a drawer one tap away.

Constraints (confirmed 11 Nov 2026): keep every feature; the journey leads; keep tap-to-step / hold-to-auto-walk; keep all keyboard shortcuts and the sound engine; no pixel art or retro-game look; game logic, store, hooks and API routes are fixed, everything the player sees is open. Shared pact: shell owns exit; Be Vietnam Pro body; Comet Mint is the only press colour; shared chunky primitives for share, sign-in and score.

Information architecture: fixed frame (identity, region/day/weather, HP/gold/rep/km, sound, help) + stage (story, event, combat, town, shop in place) + WALK bar + six drawers: Pack (inventory, crafting, enchanting), Gear (equipment, skills, exploration spells, spell combos, stats), Quests (main, side, daily, achievements, bestiary, run history, leaderboard), Map (area, world, waypoints, camp), Party (party, mercenaries, contacts, factions, mount), Town (shop, blacksmith, tavern, stable, mailbox, notice board, NPCs; lit only at a town). Drawers are a sheet over the stage on phones (the stage never reflows there; WALK stays under the sheet so the map can stay open while walking) and, on desktop, a panel docked in the right wing: the proscenium yields width to it, and because the flats are slice-fitted nothing on the stage jumps (amended 11 Nov 2026).

Unresolved: whether the local Characters/Game sub-routes survive (plan: keep the routes, drop the duplicate Home link). Share: deliberately deferred — the top band has no share control until interaction model 6 defines the shared verb; the contract's "sound and share" line reads "sound" until then (recorded 11 Nov 2026 at the finish review).

## Direction contract

THESIS: The road is a paper toy theatre that owns the whole window (the cave's chrome is not shown; a 'Cave' door top-left is the exit). Each tap slides a new painted flat in from the wings and the story walks on as a cut-out on a stick; every drawer is a playbill hanging in the wings. It refuses both the dark-fantasy parchment-and-gold panel dashboard and the incumbent slate card grid.

OWN-WORLD: A peacock-blue proscenium with gilt trim framing a cobalt night (changed from lacquer red on 11 Nov 2026: with a wood-type face the red read as a saloon, not a toy theatre); inside it, layered card flats in saturated poster paint (meadow green, teal, ochre, slate, ember by region) with visible card edges and a thin paper rim; playbill cream is the only paper that carries body text, printed in Be Vietnam Pro, with titles, names and figures in Abril Fatface (the Victorian playbill fat-face; Rye was dropped for the same saloon reason) and every label in Lexend caps; three faces on the Tailwind ramp and nothing else; brass plates carry numbers. Controls are paper and brass: playbills, ticket stubs, plates. Depth is stacked card: each flat is drawn twice, a darkened copy offset below as its thickness and a pale paper rim on the cut edge. Day and night: by day each region paints its own saturated backcloth; at nightfall the backcloth is the cobalt night itself. The footlights are the one Comet Mint element, the WALK bar.

STORY: The player sees scenery change under their thumb and a new line print on the playbill, understands the run is a performance they walk through, chooses from three playbill lines, and comes back because the stage remembers where the curtain fell.

FIRST VIEWPORT: Top band: the Cave door, run identity, placards, sound and help. Nothing scrolls at the page level: the house fills the window, the wings and the apron scroll inside themselves. The house: left wing of small playbills (the story log, newest at top), the proscenium centre (region flats, the hero cut-out and anyone met, a playbill strip under the footlights with the newest scene, its Day · km · place caption and three choices), right wing of six drawer playbills. Below the house: the WALK footlight bar, full width, mint, with the brass HUD plate (HP, gold, reputation, level) beside it. Phones: proscenium full width, log folds under the strip, drawers become six ticket stubs along the bottom, sheets rise over the stage.

Signature interaction and motion grammar: on each step the flats slide in from the wing (200 ms ease-out, the far flat slower than the near one); cut-outs rock 6° on their stick when they speak or strike; the new playbill line slides up 150 ms; hold-to-walk pulses the footlights. Combat is the same stage with two cut-outs facing off. Reduced motion: flats cross-fade, cut-outs hold still, the Day · km caption carries the change.

FORM: The Paper Stage, candidate 1 of 7 on my ordered list (the roll assigned candidate 3; the user chose the IMPECCABLE'S PICK card). seed:ef50d62f448fcf2f

FINISH: unreviewed and undocumented is unfinished; this build ends with the finish review, the verdict, DESIGN.md, and every shipping raster carrying its provenance
