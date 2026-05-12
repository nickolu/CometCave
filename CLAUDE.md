# CometCave — Agent Instructions

CometCave is a portfolio of interactive browser games. The brand identity is *Meow Wolf in cosmic miniature*: hand-crafted, surreal, intelligent, playful. Each game is its own world; the cave is the connective tissue.

This file captures the durable UX principles that govern the whole app. They apply unless a game makes a deliberate, documented exception. Quote them by title in PR reviews.

---

## UX Principles

### 1. Anonymous-first, sign-up as reward
Every game must be fully playable without an account. Sign-up is sold on **depth** — stats, leaderboards, streaks, persistent identity — never gated as access. Share links must drop visitors directly into play.
- **Do** surface sign-up at moments of earned value: after a win, when a streak forms, when stats become interesting.
- **Don't** prompt for sign-up before the first interaction.

### 2. The cave is light, the worlds are loud
The shell — home, navigation, profile, transitions — stays minimal: low motion, no ambient sound, restrained color, fast to re-enter. Each game is free to be its own visual dimension. Juice and ceremony live **inside** games.
- **Do** keep the shell quiet so daily ritual feels frictionless.
- **Don't** bring game-level juice (bouncy hovers, sound on click, heavy transitions) into the chrome.

### 3. Design for the regular
The primary user is a returning daily visitor, not a first-time browser. Optimize for fast re-entry, "today's beat," and known-state recall.
- **Do** make today's game findable in one tap from the home.
- **Don't** re-onboard returning users or repeat first-visit framing.

### 4. Mystical voice in the chrome, game voice inside
Copy in headers, empty states, errors, tooltips, and notifications stays in the **cosmic-narrator** register. Inside a game, voice is the game's own. Stay in character even in error states ("the cave is sleeping…").
- **Do** convey character through text and visuals.
- **Don't** rely on audio for character — voice never depends on sound.

### 5. AI is invisible
Players experience uncannily fresh content; they should not see "powered by AI" framing as the hook. The magic *is* the effect, not the mechanism.
- **Do** let AI's output feel like authored content.
- **Don't** lead with AI as a feature in player-facing UI or marketing surfaces.

### 6. The shared pact
Every game must honor a fixed contract with the cave:
- Persistent exit back to the cave
- Pause/mute control in a consistent location
- Share button on every game
- Sign-up CTA at a consistent trigger (e.g., end of session)
- Streak/score display in a consistent location
- Same body font across all games
- Same primary-action color across all games

Interaction models for these shared verbs are defined in [`interaction-models.md`](./interaction-models.md). **Borrow the shared components; do not reinvent the shell inside a game.**

### 7. Hand-crafted, not templated
Reference DNA is Meow Wolf, Balatro, Stardew Valley, Kurzgesagt: surfaces feel **made**, not generated. Even small surfaces — loaders, empty states, 404s, "you already played today" — deserve personality.
- **Do** bring intention to the boring screens.
- **Don't** ship default Material/Tailwind starter aesthetics into player-facing surfaces.

### 8. Accessible on every device
All-ages, kid-safe, normal a11y commitments: contrast, focus states, keyboard navigation, `prefers-reduced-motion`, screen-reader-friendly labels. Mobile and desktop carry **equal weight** — neither is canonical, both must feel native.
- **Do** assume reduced-motion and silent device as the baseline experience; convey state through more than color or sound alone.
- **Don't** ship desktop-only or mobile-only screens for shared flows.

### 9. The litmus test: return, session, share
Any UX proposal should plausibly move at least one of:
- **Daily return rate**
- **Average session length**
- **Share rate**

If it doesn't, cut it. When proposing a UX change, name the metric you expect it to move.

---

## Architecture notes

- **Portal model.** Each game is its own world with its own visual language; the cave is the bridge between them.
- **Home page (current era):** grid/library of games. **Home page (future era):** daily activity feed centered on the user — flips when the user page earns enough value to be home. Principles hold across both eras.
- **Identity is light:** nickname + streak. No avatars, customization, or narrative progression yet.
- **Cave↔game transitions** are deliberately under-designed today; this is a known opportunity, not a current investment.
- **Ring Toss is sunset** — do not extend it, do not mirror its patterns.

## Audience

Audience is undefined and all-ages by default; per-game audiences will emerge. UX must remain **adaptive** rather than prescriptive. Kid-safety is a baseline constraint everywhere.
