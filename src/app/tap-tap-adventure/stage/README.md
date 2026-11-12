# The Paper Stage

Tap Tap Adventure is a Victorian paper toy theatre (a peacock-blue and gilt proscenium, never red: with a display face that reads as a saloon). It owns the whole window; the Cave door top-left is the exit. Everything the player sees is
one of four materials, and every panel in the game is set in them:

| Material | What it is for | How |
|---|---|---|
| **Playbill cream** (`ps-playbill`, `.ps-paper` / `.ps-paper-flat`) | Anything that carries text: the story, choices, every drawer, every panel, dialogs. | `PlaybillSheet`, `PlaybillTitle`, `PlaybillCaption`, `PlaybillLine`, `PaperButton`, `PlaybillRule` |
| **Brass** (`ps-brass`) | Numbers and engraved figures: HP, gold, level, prices, stats. | `BrassPlate`, `BrassFigure` |
| **Lacquer and the dark house** (`ps-lacquer`, `ps-lacquer-ink`, `ps-house`) | The frame, wings and bands around the stage. Never a panel's fill. | `Theatre`, `TicketStub`, `Placard` |
| **Stamp inks** (`ps-stamp-red/green/blue/violet/gold`) | The printer's one-colour ink: deltas, rarity, tags, warnings. | `Stamp`, `deltaTone()` |

**Comet Mint is the footlights.** It is the WALK bar and nothing else. A primary
action inside a panel is an ink `PaperButton`, not a mint one. (The cave's One Press
Color Rule: if two things on the screen are mint, one is wrong.)

## Setting a panel

1. The panel's logic, props, store calls and copy stay. Only the rendering changes.
2. Outer container: nothing, or `PlaybillSheet flat` when it needs its own edge. The
   drawer sheet it sits in is already paper, so most panels need no wrapper.
3. Type is three faces on one ramp, and nothing else:
   - **Playbill** (`font-playbill`, Abril Fatface): titles, names, figures.
     Only through `PlaybillTitle` (sm / md / lg), `BrassFigure`, `TicketStub`, or
     `font-playbill text-base|text-lg|text-2xl` for a name or a number.
   - **Label** (`font-label`, Lexend caps): `PlaybillCaption`, `Stamp`, `Placard`,
     `PaperButton`. Always uppercase, `text-xs`, `tracking-widest`.
   - **Body** (`font-body`, Be Vietnam Pro): everything read. `text-base` for the
     story, `text-sm` for panel copy, `text-xs` for ledger lines. Never smaller.
   Sizes come from the Tailwind ramp (`text-xs` … `text-3xl`); no `text-[Npx]`,
   no `tracking-[…]` (use `tracking-wide` / `tracking-widest`). Secondary text is
   `text-ps-ink-soft`, never gray.
4. Lists of things you can pick (items, recipes, quests, mounts, party members,
   shop wares): a column of `PlaybillLine`s, or a card-like `div` with
   `border-2 border-ps-ink` on paper. Rarity, cost, status: a `Stamp`.
5. Buttons: `PaperButton` (`ink` default, `outline` secondary, `danger` for
   discard/sell/dismiss, `brass` for pay/buy). Sizes `sm` inside lists.
6. Numbers worth a glance (HP, gold, a price, a stat): `BrassPlate` + `BrassFigure`,
   or inline `font-playbill tabular-nums`.
7. Progress: a thin `bg-ps-ink/20` track with a `bg-ps-stamp-green|red|ink` fill,
   `role="progressbar"`. No gradients, no glows.
8. Dialogs (things that must interrupt): a scrim of `bg-ps-house/70`, a centred
   `PlaybillSheet` with a `PlaybillTitle`, `useDialogFocus`, `role="dialog"`,
   Escape closes. Ceremonies (level up, rare loot, quest complete) may add a
   `Stamp animate` and one brass flourish, nothing more.
9. Icons for controls come from `./icons.tsx` (one stroke, one weight). Glyphs
   that are game data (an NPC's icon, a landmark's icon, an item's icon) stay as
   data and ride on a bill as text, never as the control's icon.
10. No hex, no `bg-[#…]`, no `slate-*`/`indigo-*`/`amber-*` classes, no emoji as
    a control icon, no blurred or glowing shadows. The `ps-*` tokens and the
    shared cave tokens are the whole palette.
11. Focus: `focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ds-primary`
    on every interactive element. Keyboard shortcuts stay exactly as they are.
12. Reduced motion is already honoured globally; don't add motion that needs it.

Look at `PlaybillStrip.tsx`, `StoryLog.tsx` and `StageHud.tsx` for the voice in use.
The dev preview at `/tap-tap-adventure/preview?s=idle|decision|arrival|social|combat|town|foyer&drawer=pack|gear|quests|map|party|town`
renders the real stage with a fixture run; headless Chrome can screenshot it.
