# CometCave — Interaction Models

These are the shared **verbs** every game must honor. Each model defines the trigger, placement, voice, motion budget, and a11y obligations for a moment that recurs across the app. Quote them by name in PR reviews.

Principles in `CLAUDE.md` set direction; interaction models set behavior. Where they conflict, principles win.

## How to read this file

- **Trigger** — the user action or state change that fires the verb
- **Placement** — where the verb's UI lives, on mobile and desktop
- **Voice** — copy register and example phrasing
- **Motion** — the budget for animation and transitions
- **A11y** — non-negotiable accessibility obligations
- **Generalized from** — the existing shipped pattern this codifies, or `new` if no precedent
- **Variations** — when (and only when) a game may diverge
- **Resolves** — explicit calls about current inconsistencies in the codebase

Status legend: ✅ defined · 🟡 drafted, awaiting review · ⏳ pending

---

## Status

| # | Verb | Status |
|---|---|---|
| 1 | Enter game | 🟡 |
| 2 | Exit to cave | 🟡 |
| 3 | End-of-session | 🟡 |
| 4 | Sign-up prompt | 🟡 |
| 5 | Already-played-today | 🟡 |
| 6 | Share | ⏳ |
| 7 | First-time-from-share | ⏳ |
| 8 | Error | ⏳ |
| 9 | Loading / empty state | ⏳ |
| 10 | Pause / mute | ⏳ |
| 11 | Streak / score display | ⏳ |
| 12 | Login flow | ⏳ |
| 13 | Notification / toast | ⏳ |

---

## 1. Enter game 🟡

The moment between a player tapping a game card (or arriving via a link) and being able to play.

**Trigger:** route navigation to `/<game>`.

**Placement:**
Each game picks one of two entry shapes:
- **Threshold** — a brief landing inside the game route showing title, identity tile (streak, today's status if relevant), and a single primary CTA. The persistent cave shell remains visible above/around it.
- **Immediate-play** — no landing; the player lands in the playable state.

The choice is per-game and follows the game's nature:
- Ritual games (Trivia, Daily Card Game, Secret Word) → **threshold**.
- Tool/sandbox games (Avatar Maker, Oracle, Whowouldwininator) → **immediate-play**.

The persistent cave shell (top nav on mobile, side nav on desktop) is visible on entry for both shapes. No game takes over the viewport on entry.

**Voice:** mystical, brief. The threshold is a doorway, not a marketing page. Two lines max above the CTA.

> "Today's questions are mined and waiting."
> "The crystals are listening."
> "Step into the workshop."

**Motion:** route change is instant or a single ≤200ms cross-fade. No splash. No skeleton longer than one second — if it would be, show a loading model (verb 9, TBD) with a mystical line, not a spinner alone.

**Mobile/desktop:** identical structure. Threshold stacks vertically on mobile; horizontal/grid on desktop is allowed but not required.

**A11y:**
- Focus moves to the threshold's primary heading on entry; on immediate-play, focus lands on the first interactive control.
- Page `<title>` set per game in mystical voice (e.g., "Daily Trivia — CometCave").
- Threshold CTA has a descriptive accessible name, not just "Play."

**Generalized from:** Trivia's landing (title + stats + Play CTA) is the canonical threshold. Chat Room and Daily Card Game already follow it. Avatar Maker is the canonical immediate-play.

**Variations:**
- A game **must** suppress its threshold for share-link arrivals — see model 7 (First-time-from-share).
- A game **must** suppress its threshold for today-state recall — see model 5 (Already-played-today).

---

## 2. Exit to cave 🟡

How a player leaves a game and returns to the cave.

**Trigger:** explicit user intent to leave a game while in any state.

**Placement:**
- The persistent shell's logo + Home nav is the **canonical exit**. It is always visible, always functional, in every game.
- A game that takes over the viewport, enters fullscreen, or otherwise hides the shell **must** provide an in-game exit affordance: top-left, cave/portal icon, accessible label "Return to the cave."
- A game that does **not** hide the shell **must not** add a duplicate in-game exit. The shell is the exit; redundancy clutters the chrome.

**Voice:** the affordance, when present, says "Cave" or uses a cave/portal icon — never "Back" or "Home" alone. The cave is the destination; we name it.

> "Return to the cave"

**Motion:** instant route transition. No "are you sure?" modal on exit unless unsaved meaningful progress would be lost (see below).

**In-progress state on exit:**
- Games with persistent state (Tap Tap Adventure, Fantasy Tycoon) **autosave silently** on exit. No "your progress was saved" toast — Principle 2 (the cave is light).
- Games with ephemeral session state (Trivia, Secret Word) discard on exit. If exit would discard meaningful in-flight progress (mid-question, mid-round), show a brief confirm in mystical voice.

> "Leave the cavern? Your unfinished round will fade."

**A11y:**
- The shell's Home link is reachable via keyboard from any game state — no focus traps.
- The in-game exit affordance, when present, is the first focusable element on the page.
- Confirm dialogs use a true `<dialog>` or accessible modal, not a custom div.

**Generalized from:** the existing global header HOME link, used as the de facto exit by all games today.

**Resolves:**
- **Chat Room's inline "← Back to games" link is removed** — the shell is sufficient; the inline link was a shipped one-off.
- **Avatar Maker** inherits the shell exit; no in-game affordance needed unless it ever hides the chrome.
- **Tap Tap Adventure's** local sidebar (Characters / Game) is allowed as **secondary** in-game nav. It does not replace the cave exit; the shell still owns that.

**Variations:**
- Future fullscreen/canvas-takeover games (e.g., a hypothetical reborn arcade game) **must** add the explicit "Cave" affordance.

---

## Session shapes

Models 3 and 5 below behave differently depending on a game's session shape. Every game declares one:

- **Daily ritual** — exactly one canonical session per day, then "done for today." Examples: Trivia, Secret Word, Daily Card Game. Streaks live here.
- **Run-loop** — many sessions per visit; "session" means "run," and the loop continues. Examples: Tap Tap Adventure, Fantasy Tycoon. Streaks (if any) live on visit days, not runs.
- **Open-ended tool** — no session boundaries; the player produces outputs instead of finishing. Examples: Avatar Maker, Oracle, Whowouldwininator, Voters, Chat Room of Infinity. End-of-session model does not apply; "end-of-output" is treated as a soft cousin (see model 3, sub-section).

A game's shape is declared in its top-level component and is part of its public contract with the cave.

---

## 3. End-of-session 🟡

The moment a session ends. Where ceremony lives. Where sign-up bait lives.

**Trigger:** a session completes per the game's shape:
- **Daily ritual:** the day's run is finished (last question answered, word guessed/missed, run ended).
- **Run-loop:** a single run ends.
- **Open-ended tool:** does not apply — see "End-of-output" below.

**Placement:** an end-of-session screen replaces the playable area. The persistent shell remains. The screen owns the viewport's content area; the screen is **not a modal**.

The screen contains, in this stacking order on mobile (left-to-right blocks on desktop):
1. **Result** — the score/outcome, large, centered. The most distinctive moment.
2. **Identity beat** — streak status (extended / started / broken / preserved), today's leaderboard rank if relevant. Anonymous players see "Your streak — sign in to keep it" here (see model 4).
3. **Share affordance** — see model 6.
4. **Next action** — game-shape-dependent (see below).
5. **Sign-up bait** — for anonymous players only; see model 4. Inline, not a modal.

**Next action by shape:**
- **Daily ritual:** primary CTA is "Try another game" (links to cave). Secondary line: "See you tomorrow." Replaying today is **not** offered as a primary action; if a practice mode exists, it lives behind a tertiary "Play again (won't count)" link.
- **Run-loop:** primary CTA is "Run again." Secondary is "Return to the cave."

**Voice:** mystical-cosmic, with celebration baked in for wins. Avoid generic "Good job!" — the narrator names what happened.

> "Seven days deep. The streak holds."
> "The cave keeps your score: 8 of 10."
> "A new run begins when you're ready."
> "Today's questions are answered. The cave settles until tomorrow."

**Motion:** this is the **one place in the shell-adjacent UI** where juice is allowed (Principle 2 carve-out). A streak-extension or first-win moment may animate — a single ceremonial flourish (≤800ms), respecting `prefers-reduced-motion`. No looping animation. No sound.

**Mobile/desktop:** vertical stack on mobile; horizontal layout (result | identity | next) is allowed on desktop but not required.

**A11y:**
- Focus moves to the result heading on session end.
- Result is announced via `aria-live="polite"` for screen readers.
- The ceremonial flourish is purely decorative (`aria-hidden`) and is suppressed entirely under `prefers-reduced-motion: reduce`.

**Generalized from:** Trivia's results screen is the canonical end-of-session for a daily ritual. No clean canonical exists yet for run-loop — this model defines it forward.

**End-of-output (open-ended tools):** open-ended tools instead get a quieter "output ready" moment — the produced thing (avatar, reading, scenario) sits alongside a minimal action row: copy/save, share (model 6), and a "make another" affordance. No ceremony. No sign-up bait at this beat — open-ended tools surface sign-up only when the user attempts to save/persist something (see model 4).

**Resolves:**
- Whowouldwininator's result step gains the standard share + "make another" affordances.
- Avatar Maker's "Generate More" loop is correct; it gains share consistency only.

**Variations:**
- A daily ritual game **may** suppress the ceremonial flourish on the second-and-later view of the same day's result (the recap path — see model 5).

---

## 4. Sign-up prompt 🟡

How and when CometCave asks an anonymous player to sign up. Sells **depth**, never gates **access** (Principle 1).

**Trigger:** earned value, never first-touch. The canonical triggers, in order of likelihood:
1. **End-of-session** for an anonymous player on a game where sign-up unlocks something concrete (streak persistence, leaderboard placement, stat history).
2. **Streak threshold** — anonymous player extends a streak to 3+ days; prompt appears at next end-of-session in elevated form.
3. **Feature attempt** — anonymous player taps something gated on identity (view full leaderboard, see lifetime stats, save an output). Prompt is the response to the tap.
4. **Never** at home, never on entry, never as an interstitial.

**Placement:**
- **In-line on end-of-session** (trigger 1, 2): a card within the result screen, placed below the identity beat, above the next-action CTA. Looks like part of the ceremony, not an interruption.
- **In-place on feature attempt** (trigger 3): the gated surface is replaced with the prompt + a way back. No modal overlays.
- Never as a banner, toast, full-screen takeover, or sticky bar.

**Voice:** the cave invites; it does not pitch. Lead with the depth that's gained, not the act of signing up.

> "Sign in to carry this streak across devices."
> "Save this avatar to your cave."
> "The leaderboard remembers names."
> "Three days deep — sign in and the cave will remember."

Do not write: "Sign up for free!" / "Don't lose your progress!" / "You're missing out."

**Motion:** none in the prompt itself. The card may fade in with the rest of the result screen but does not animate independently.

**Dismissal & cadence:**
- Trigger 1 (end-of-session): persists on the screen but is dismissable with a small "Not now." Once dismissed for a given day, suppressed for that day on that game.
- Trigger 2 (streak threshold): the elevated form re-appears every 3 streak days unless dismissed twice in a row, then suppressed for 14 days.
- Trigger 3 (feature attempt): always shown — the user explicitly asked for the gated thing.
- All cadence is per-device, persisted in `localStorage`. Sign-in clears it.

**A11y:**
- The dismiss control has an accessible name ("Dismiss sign-in prompt").
- The CTA is a real button or link, not a card-wide click target with a hidden button.
- Focus order: result → identity → share → sign-up CTA → next action. The prompt does not steal focus.

**Generalized from:** new — the trivia auth phase 4 work (commit c9ca0c1 "login CTAs and polished auth UX") is the closest precedent and should be reconciled to this model in a follow-up PR.

**Variations:**
- A game may add a fourth trigger of its own (e.g., "save this as a deck") provided it follows trigger-3 placement rules. Document the trigger in the game's source.

---

## 5. Already-played-today 🟡

The regular returns to a daily-ritual game after completing it. Applies **only to daily-ritual** games.

**Trigger:** an authenticated or anonymous player navigates to a daily-ritual game's route, and a completed session for the current day exists for them.

**Placement:**
The game's threshold (model 1) is **suppressed**. The player lands directly on a recap view that mirrors the end-of-session screen (model 3) with these differences:
- The result is rendered in **recap mode** — same content, no ceremonial flourish, slightly de-emphasized.
- The next-action CTA is "Try another game" with secondary "See you tomorrow at midnight" (or the relevant local-time anchor).
- Sign-up bait remains visible for anonymous players (model 4 trigger 1 still applies, dismissal cadence still holds).

**Voice:** the narrator acknowledges the regular without making them feel locked out.

> "You've already walked these caverns today. The crystals reset at midnight."
> "Today's puzzle is answered. Wander to another cave?"

**Motion:** none. This is the quietest moment in the daily ritual — the regular has already had their ceremony.

**Mobile/desktop:** identical to end-of-session layout, recap-styled.

**Today-state source of truth:**
- Authenticated players: server-side per-game today-record (Firestore, per the trivia auth phase 2 architecture).
- Anonymous players: `localStorage` per-game today-key (per the trivia localStorage today-state work, commit e4f9b50). Key includes the local-day anchor.
- On conflict (e.g., a player signs in mid-day having played anonymously earlier): server wins, local state is reconciled silently.

**A11y:**
- Page `<title>` reflects recap state ("Daily Trivia — Today's results").
- The recap heading announces "Today's result" so a screen-reader user understands they didn't land in a fresh game.

**Generalized from:** Trivia's auto-redirect-to-results-if-played-today (the canonical implementation). Codifies it for every daily-ritual game.

**Resolves:**
- Daily Card Game and Secret Word, when classified as daily-ritual, must adopt this model.
- Practice/replay-without-counting — if a daily-ritual game offers it, the affordance lives behind a tertiary link on the recap screen ("Play again — won't count toward today"). This is the **only** way to access a fresh playable state on a completed day.

**Variations:**
- Run-loop and open-ended-tool games **never** show this verb. They have no "today."

---

_Models 6–13 pending — next cluster: acquisition (6 Share, 7 First-time-from-share), then texture (8 Error, 9 Loading, 10 Pause/mute), then supporting (11 Streak/score, 12 Login, 13 Toast)._
