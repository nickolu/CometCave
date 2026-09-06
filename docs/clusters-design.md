# Clusters — Design

A daily word-grouping game at `/clusters`. Sixteen words, four hidden groups of four,
four mistakes allowed. One puzzle a day, resetting at midnight Pacific.

Status: **built.** This document is the spec and it tracks the code. Where the
build changed a decision, the decision is updated here and marked *(build)*.
The one thing still outstanding is the data itself: the puzzle bank has not
been backfilled yet, so run the ingest before the game is playable (§2.3).

---

## 1. What the player does

Sixteen words sit in a 4×4 grid. The player taps up to four, submits, and the server
says whether those four share a group.

- **Correct** — the group is revealed with its title, the four words lift out of the
  grid into a colored banner, and the board shrinks (4×3, then 4×2, then 4×1).
- **One away** — exactly three of the four belong to one group. Said out loud, no
  mistake charged beyond the wrong guess itself.
- **Wrong** — one mistake. Four mistakes ends the run and reveals the remaining groups.

Each group carries a difficulty tier, easiest to hardest: **yellow, green, blue, purple**.
Solving purple first is the flex, and it is counted.

The board can be shuffled at any time. Shuffling is cosmetic and local — it never
touches the server and never counts as an action.

---

## 2. Where the puzzles come from

### 2.1 Source

The NYT Connections archive publishes each day's puzzle as public JSON:

```
https://www.nytimes.com/svc/connections/v2/2023-06-12.json
```

```json
{
  "status": "OK", "id": 1, "print_date": "2023-06-12", "editor": "Wyna Liu",
  "categories": [
    { "title": "WET WEATHER", "cards": [
      {"content":"HAIL","position":9}, {"content":"RAIN","position":11},
      {"content":"SLEET","position":12}, {"content":"SNOW","position":0} ] },
    { "title": "NBA TEAMS",     "cards": [ ... ] },
    { "title": "KEYBOARD KEYS", "cards": [ ... ] },
    { "title": "PALINDROMES",   "cards": [ ... ] }
  ]
}
```

A 27-date sample suggested the archive was perfectly uniform. **A full sweep of all
1182 days proved otherwise**, and the difference is the whole reason §2.2 changed.
What actually holds:

- categories are always four, and always arrive **in difficulty order**, so
  `categories[0..3]` maps straight onto yellow, green, blue, purple. No inference
  needed.
- when cards carry `content`, `position` is always a complete 0–15.
- `print_date` always equals the date requested.
- `id` is **not** day-aligned (2026-09-05 is `id: 1289` but only the 1182nd day of the
  archive). Never key on `id`; the date is the only safe identifier.

And what does not:

**Seven days out of 1182 are not word boards at all** *(build)*. Cards can be SVGs —
`image_url` plus `image_alt_text`, with `content: null`:

| Date | Board | Kind |
|---|---|---|
| 2024-12-12 | THINGS THAT SOUND LIKE "T" | all images |
| 2025-04-01 | CURRENCY SYMBOLS · EMOTICON MOUTHS | all images |
| 2025-10-31 | GOLDILOCKS · CINDERELLA · POPEYE | all images |
| 2026-02-07 | PIPS ON A DIE · PUNCTUATION MARKS | all images |
| 2026-04-01 | BEER BRANDS | all images |
| 2026-05-06 | FOUND IN A CASINO | all images |
| 2026-03-07 | WHERE YOU MIGHT MAKE A CONNECTION | **mixed** — 15 words + one image tile |

Clusters runs a board only when **every card is a word**. Substituting the alt text
would sometimes work — 2026-03-07's image tile reads "THIS GAME", which slots
neatly into its group — and would sometimes produce a trivial or nonsense board,
as it would for PIPS ON A DIE. Nothing can tell those apart automatically, so the
rule is the one that is always right, and those seven days are skipped.

**The archive is also intermittently flaky.** The same sweep hit a 503, a dropped
connection, and a *spurious 404* on 2023-11-19 — a date that serves a perfectly
ordinary puzzle on the very next request. `fetchNytPuzzle` retries three times with
backoff *(build)*. Without that, a transient blip would silently drop a good puzzle
out of the rotation. With retries in place a full sweep now reports **1175 parsed,
7 skipped, 0 failed**.

### 2.2 Date mapping

Day one is **2026-06-12**, running the puzzle NYT published on **2023-06-12** — a
nominal offset of **1096 days**, expressed in days rather than calendar years
because "minus three years" has no answer on 2028-02-29.

But the offset is the **anchor, not the mapping** *(build)*. Because seven source
days cannot be run (§2.1), a fixed offset would leave seven dead days on our
calendar — and a dead day breaks a streak through no fault of the player, which is
exactly the failure this design is supposed to prevent.

So play dates are assigned **sequentially and append-only** at ingest:

```
each usable source puzzle, in print_date order, takes the next play date
an unusable source day is skipped and consumes no play date
```

| | |
|---|---|
| Day 1 | 2026-06-12 runs 2023-06-12 |
| Gap at launch | 1096 days |
| Gap after n skips | 1096 + n days |
| Authoritative record | `source.date` on each stored document |

The consequence to hold onto: **the mapping is never recomputed from today's
date.** An ingest run resumes from the last stored document — `resumeAnchor()` — so
a source day that fails today can never retroactively shift a puzzle somebody has
already played. `puzzleNumberFor()` is still a pure day-count from launch, because
our puzzle numbers are about our calendar, not the source's.

This also makes the pipeline immune to gaps in the archive generally: a date NYT
never published is skipped by the same mechanism, with no special case.

### 2.3 Ingest

One command, idempotent and resumable *(build)*. It reads the last stored puzzle and
appends everything the archive has published since — so on an empty bank that is the
whole archive, and backfill and the daily top-up are the same command.

```
npm run ingest:clusters                  # append everything not yet consumed
npm run ingest:clusters -- --dry-run     # fetch, parse and validate; write nothing
npm run ingest:clusters -- --limit=200   # in chunks
npm run ingest:clusters -- --force       # rebuild assignment from scratch (pre-launch only)
```

`--dry-run` exercises the whole path without a single write. It is what turned up the
image puzzles and the flaky days; run it before committing a bank.

Documents are keyed by **play date**, not source date. That freezes the mapping at
ingest time, so a later change in what the archive serves can never alter a puzzle
somebody has already played.

The run finishes by reporting what is actually playable and how much runway is left,
and exits non-zero if any playable day has no puzzle — the one condition that means
a player will hit a dead end today.

### 2.4 Stored shape

`dailyClusters/{playDate}` — server-only, the client never reads this collection.

```ts
interface ClustersPuzzle {
  date: string          // play date, == doc id, 'YYYY-MM-DD'
  puzzleNumber: number  // ordinal in OUR sequence; 2026-06-12 is 1
  layout: string[]      // 16 words in board order, reconstructed from `position`
  groups: [Group, Group, Group, Group]   // always yellow, green, blue, purple
  source?: { provider: 'nyt'; date: string; editor: string }
  createdAt: Timestamp
}

interface Group {
  tier: 'yellow' | 'green' | 'blue' | 'purple'
  title: string
  words: [string, string, string, string]
}
```

`layout` preserves NYT's original board arrangement. Every player starts from the same
board, which is what makes share grids and "purple first" comparable between players.

`source` carries the provenance and, crucially, `source.date` is what the next ingest
run resumes from (§2.2). It is the only provider-specific field: a future puzzle
source — hand-authored, or generated — drops into the same collection and nothing
downstream changes. **Design for this deliberately**: see §9.

We burn one puzzle a day and the archive gains one a day, so the runway never
shrinks. As of today the game needs **86 puzzles** (2026-06-12 → 2026-09-05) and
1182 source days are available, of which **1175** are usable.

---

## 3. Where a guess is checked

**On the server. The client never holds the solution.**

`GET /api/v1/clusters/daily` returns sixteen words and nothing else — no groups, no
titles, no tiers. Each submission is a POST that the server evaluates. The full solution
ships exactly once, in the response to the guess that ends the run.

This is a deliberate cost: four to eight round trips per game instead of zero. It buys
three things that matter here.

1. **Stats mean something.** A once-a-day game with streaks and a "perfect" counter is
   only interesting if the numbers are earned. If the answer is in the network tab,
   every stat is decoration.
2. **One play per day is enforceable.** With client-side checking, a refresh is a
   restart and mistakes are free.
3. **Resume is free.** Since the server already owns the run, closing the tab mid-game
   and coming back lands the player exactly where they left off. With client-side
   checking that would need a whole second sync mechanism.

The consequence to design around: **the server owns the session, not the client.** The
client is an optimistic mirror. This is the single most important structural fact in the
build.

### 3.1 The session document

`users/{uid}/clustersSessions/{date}` — server-only, never readable by the client.

```ts
interface ClustersSession {
  date: string
  status: 'in_progress' | 'won' | 'lost'
  solved: { tier: Tier; title: string; words: string[]; guessIndex: number }[]
  mistakes: number                        // 0..4
  guesses: { words: string[]; result: GuessResult; guessId: string }[]
  startedAt: Timestamp
  finishedAt?: Timestamp
  countsForStreak: boolean                // frozen at creation: was this played same-day?
}
```

`guesses` is the full history in order, and it is what generates the share grid — so the
grid is server-derived and cannot be faked.

`countsForStreak` is decided **when the session is created**, not when it finishes. A
player who starts today's puzzle at 11:58pm and finishes at 12:03am keeps the streak
they were playing for. Deciding at finish time would take it away, which is the kind of
small betrayal that costs a daily habit.

*(build)* The session is created by the **first guess**, not by loading the board.
Creating it on load would freeze the flag a few minutes earlier, but it would also
write a session document for every page view, which then makes "started but never
played" indistinguishable from a real run in the archive. First-guess creation still
protects the case that actually matters — playing for twenty minutes and finishing
after midnight.

### 3.2 API

All three routes require auth. Because `AuthProvider` mints an anonymous uid
automatically, this is invisible to the player and costs no friction (Principle 1).

**`GET /api/v1/clusters/daily?date=YYYY-MM-DD`** (defaults to today Pacific)

```jsonc
// fresh — `editor` and `sourceDate` carry the credit line (§9)
{ "date": "2026-09-05", "puzzleNumber": 86, "words": ["…16 words…"],
  "state": null, "playable": true,
  "editor": "Wyna Liu", "sourceDate": "2023-09-05" }

// resumed mid-game — solved groups are already known to this player
{ "date": "2026-09-05", "puzzleNumber": 86, "words": ["…12 remaining…"],
  "state": { "status": "in_progress", "mistakes": 1,
             "solved": [ { "tier": "yellow", "title": "WET WEATHER", "words": [...] } ],
             "guesses": [ … ] },
  "playable": true }

// already finished — full solution, no longer playable
{ "date": "2026-09-05", "puzzleNumber": 86, "words": [...],
  "state": { "status": "won", "mistakes": 1, "solved": [...4 groups...], "guesses": [...] },
  "playable": false }
```

- `date > today` → **400**. Never serve a future puzzle.
- `date < 2026-06-12` → **400**. Before launch, nothing exists.
- no document → **404**, rendered as "No puzzle for this day."

**`POST /api/v1/clusters/guess`** `{ date, words: string[4], guessId: string }`

```jsonc
{ "result": "correct",  "group": { "tier": "purple", "title": "PALINDROMES", "words": [...] },
  "mistakesLeft": 3, "status": "in_progress" }
{ "result": "one-away", "mistakesLeft": 2, "status": "in_progress" }
{ "result": "wrong",    "mistakesLeft": 1, "status": "in_progress" }
{ "result": "duplicate" }                                    // no penalty
{ "result": "wrong", "mistakesLeft": 0, "status": "lost",
  "solution": [ …all four groups… ], "profile": { …updated stats… } }
```

**`GET /api/v1/clusters/archive`** — playable dates and which ones this player has
finished, for the calendar. One collection read plus one subcollection read.

### 3.3 Rules that keep the run honest

These are the edges where a once-a-day game gets it wrong, and each is cheap to get
right if it is decided now.

- **Idempotent guesses.** The client sends a `guessId` (UUID). The server, inside a
  Firestore transaction, ignores a `guessId` it has already recorded and replays the
  original response. Mobile networks retry; a phantom mistake in a game you get one shot
  at per day is unforgivable.
- **Duplicate guesses cost nothing.** A word-set already submitted returns `duplicate`
  and charges no mistake. It is an accident, not a play.
- **One transaction, one terminal.** The guess that ends the run also finalizes: writes
  the game record and updates the profile, all in the same transaction, guarded on
  `status === 'in_progress'`. There is no second write to lose.
- **Validate the guess against the board**, not just the count: exactly four words, all
  distinct, all present, none belonging to an already-solved group.
- **`one-away` is max-overlap.** Compare the guess against all four groups; overlap of 4
  is correct, overlap of 3 is one-away. Computed over every group, not just the first
  match, and only against groups still unsolved.
- **The forced last group resolves itself** *(build)*. Three solved leaves the fourth
  determined, so the server appends it rather than making the player click a foregone
  conclusion. It still counts as found, so a clean run is still perfect.

---

## 4. Identity and the name gate

Use case 2: a player must have a name before they can play, and getting one must not
cost an account.

- `AuthProvider` already mints an anonymous Firebase uid on first load. The player is
  authenticated before they touch anything.
- The threshold shows a name prompt when the profile has no nickname. Type a name,
  play — arcade style, no password, no email.
- `POST /api/v1/users/me/nickname` already enforces uniqueness and returns **409** on a
  collision. Reuse it as-is.
- Upgrading to Google or email later calls `useAuth().signInWithGoogle()`, which **links**
  the credential to the existing anonymous uid, so every stat carries over. The existing
  `AnonymousProgressOrphanedError` must be caught and surfaced — it is thrown when the
  credential already belongs to a different account and the anonymous progress is
  stranded.

**Refactor required.** `NicknameDialog`, `sanitizeNickname`, `NICKNAME_MAX_LENGTH` and
`NicknameInUseError` currently live inside `src/app/trivia/`. Clusters needs the same
gate. Lift them to `src/components/nickname-dialog.tsx` and `src/lib/users/nickname.ts`
and re-point trivia's imports. Do not copy them.

---

## 5. Stats

Anonymous-first means these are the reward for signing up (Principle 1), so they need to
be worth reading. They live at `users/{uid}/clustersProfile/current`, owner-readable via
a client subscription — the same pattern as `useTriviaUser`.

```ts
interface ClustersProfile {
  played: number                    // completed runs, win or loss
  mistakeDistribution: number[]     // length 5; index = mistakes made
  purpleFirst: number               // runs where purple was the first group solved
  currentStreak: number
  maxStreak: number
  lastPlayedDate: string | null
  lastStreakDate: string | null     // last same-day completion; the streak anchor
}
```

### 5.1 Derive, don't store

`mistakeDistribution` is the whole picture, and the headline numbers fall out of it:

```
perfect  = mistakeDistribution[0]                        // solved clean
losses   = mistakeDistribution[4]                        // four mistakes ends the run
won      = played − mistakeDistribution[4]
winRate  = won / played
```

Storing `won` and `perfect` as their own counters invites drift between them and the
histogram, and drifted stats are worse than absent ones. Derive them. Only `purpleFirst`
and the streaks are genuinely independent state.

The distribution is also the most interesting thing on the page — a five-bar histogram
showing that you mostly win with two mistakes says more about a player than a win rate
does.

### 5.2 Streaks

**Decision: the streak counts consecutive days *played*, not days won.**

A win streak is the familiar choice and it is the wrong one here. Connections puzzles
have genuinely brutal days; a win streak means the hardest puzzle of the month is also
the one that punishes you for showing up. That is backwards for a game whose whole
proposition is the daily return (Principle 3, and the return-rate metric in Principle 9).
Win rate is displayed right next to the streak and carries the difficulty signal
honestly.

If this proves wrong it is a one-line change in `applyResult`, and the histogram makes
the alternative reconstructable.

Mechanics:

- Only same-day completions move the streak. Archive plays never touch it (§6).
- On a same-day completion for date `D`: if `lastStreakDate === D − 1` then
  `currentStreak++`, else `currentStreak = 1`. Then `maxStreak = max(maxStreak, currentStreak)`.
- **The stored streak is stale by design.** Missing a day does not write anything, so
  `currentStreak` still reads 7 the morning after it broke. The *displayed* streak is
  computed: show `currentStreak` only when `lastStreakDate` is today or yesterday,
  otherwise show 0. Put this in one shared helper and use it everywhere the streak
  appears, or the number will disagree with itself across pages.

### 5.3 The stats page

`/clusters/stats`: completed · win % · current streak · max streak · perfect puzzles ·
purple firsts, then the mistake histogram, then recent games. Plain-language labels
(Principle 4) — "Puzzles completed", not "Runs logged".

---

## 6. The archive

Every day from 2026-06-12 to today is playable, so a missed day is a thing you can go
back and do rather than a permanent gap.

| | Today's puzzle | A missed past day | A future day |
|---|---|---|---|
| Playable | yes | yes | no — 400 |
| Playable more than once | no | no | — |
| Counts toward played / win % / perfect / purple-first / histogram | yes | yes | — |
| Counts toward streak | yes | **no** | — |

This mirrors trivia's `isRetroactive` rule. The session's `countsForStreak` flag (§3.1)
is what carries it, set at creation from `date === todayPacific`.

`/clusters/calendar` renders the month with each day marked unplayed, won, or lost. The
result of a day you have not played is never shown — that is a spoiler for a puzzle you
can still play.

---

## 7. Interface

### 7.1 Entry — threshold (interaction model #1)

Clusters is a ritual game, so it takes the threshold shape: title, today's puzzle number
and date, the streak tile, one primary CTA. The cave shell stays visible. Suppressed for
share arrivals (model #7) and for already-played recall (model #5).

### 7.2 The board

- 4×4 grid of word tiles, square-ish, gutters matching the design system.
- Tap to select, tap to deselect, hard cap of four selected.
- **Word length is the real sizing constraint.** The archive contains everything from
  `MOM` to long hyphenated entries. Tiles are fixed-size; the *text* shrinks to fit in
  steps (base → sm → xs) with a hyphenation fallback. Never let one long word resize the
  grid — a grid that reflows between puzzles feels broken.
- Solved groups leave the grid and stack above it as full-width tier-colored banners
  showing the tier label, the group title, and its four words.
- Mistakes render as four dots that are spent one at a time, **with a text equivalent
  beside them** ("3 mistakes left") — never dots alone.

### 7.3 Controls

`Shuffle` · `Deselect all` · `Submit`. Submit is the primary action and uses
`ChunkyButton variant="primary"`, which is the app-wide primary-action color required by
the shared pact (Principle 6). It is disabled until exactly four are selected.

Shuffle reorders only unsolved tiles, is always available, and is purely local.

### 7.4 Tier colors

Four new tokens in `globals.css`. The cave surface is `#0e0f1a`, so these are fills
carrying near-black text — the inverse of the rest of the app, which is what makes a
solved banner read as a trophy.

| Tier | Token | Value | Text on fill |
|---|---|---|---|
| Yellow | `--cl-tier-yellow` | `#f6d84f` | `#12131f` — 14:1 |
| Green | `--cl-tier-green` | `#7ed48f` | `#12131f` — 11:1 |
| Blue | `--cl-tier-blue` | `#63b3ff` | `#12131f` — 8.7:1 |
| Purple | `--cl-tier-purple` | `#c084fc` | `#12131f` — 7.9:1 |

Blue and purple reuse values already in `globals.css` (`--sm-c6`, `--sm-c4`), so this
adds two genuinely new colors, not four.

> `globals.css` is hand-formatted. Add the tokens by hand and keep prettier off the file.

### 7.5 Purple first (use case 7)

When purple resolves as the **first** group solved, the banner gets a distinct treatment
— a starburst and a brighter edge — and the end screen carries a `Purple First` badge.
This is inside the game, so it gets game voice and the ceremony (Principle 2). It is
counted in the profile and shown on the stats page as its own number.

### 7.6 End of session

Win or loss, the same screen: the four groups in tier order, the guess-by-guess recap
grid, mistakes used, updated streak, and — the pact's fixed slots — a **Share** button
and, for anonymous players only, the **sign-up CTA** (model #3 and #4).

Share copies the result title, an emoji grid — one row per guess, four tier-coloured
squares in the order the player selected them — and a link to play:

```
Clusters #86 · perfect
🟪🟪🟪🟪
🟨🟨🟩🟨
🟨🟨🟨🟨
🟩🟩🟩🟩
🟦🟦🟦🟦

https://cometcave.com/clusters
```

The title reports the outcome — `perfect`, `2 mistakes`, or `unsolved` — because the
grid alone does not make the cost legible at a glance.

**The link points at today's puzzle, not the dated archive URL** *(build)*. A share
has to drop the reader straight into play (Principle 1), and a day can only ever be
played once — so linking a specific archive date would silently burn that day for
them, and an archive play builds no streak. In the case that actually happens,
sharing minutes after playing, today's puzzle *is* the one being shared about.

**The forced last group still gets a row** *(build)*. Solving three groups
auto-resolves the fourth (§3.3), which records no guess — so a grid built from the
guess history alone drops it, and a clean win goes out as three rows instead of four.
The builder appends a row for any solved group with no guess of its own, and does so
only on a win, because on a loss `solved` also carries the groups the reveal added.

The grid carries no words and no titles: a share must never spoil the puzzle for
whoever receives it.

### 7.7 The rest of the pact (Principle 6)

- **Exit to cave:** the shell's nav. Clusters does not take over the viewport, so per
  interaction model #2 it must **not** add its own exit button.
- **Pause / mute:** there is no audio and no timer, so there is nothing to pause. Leave
  the slot empty rather than inventing a control for it.
- **Streak display:** the threshold and the end screen, same place both times.
- **Font and primary color:** app defaults, unmodified.

### 7.8 Accessibility (Principle 8)

This is where word-grid clones usually fail, and the failures are structural rather than
cosmetic — cheap now, expensive later.

- Tiles are `<button aria-pressed>`, not divs. Roving arrow-key focus across the 4×4;
  Enter/Space toggles.
- **Tier is never conveyed by color alone.** Every solved banner names its tier in text.
- A polite live region announces: selection count, guess result, one-away, mistakes
  remaining, group solved with its title, and that the shuffle completed. Shuffle
  silently reordering the board is disorienting for a screen reader user otherwise.
- `prefers-reduced-motion`: no shake on a wrong guess (flash the border and say it in
  text instead), no stagger on the reveal, no flip on shuffle.
- Mobile and desktop carry equal weight — the 4×4 must be comfortably tappable at
  360px wide without horizontal scroll.

---

## 8. Files

```
src/app/clusters/
  layout.tsx  page.tsx  [date]/page.tsx  calendar/page.tsx  stats/page.tsx
  clusters.css                  # tile typography + motion, all reduced-motion aware
  components/  ClustersGameView  ClustersBoard  ClustersControls  ClustersResults
               SolvedGroupBanner  MistakeDots  ClustersStats  ClustersCalendar
  hooks/       useClustersUser.ts      # profile + history subscription
               useClustersGame.ts      # session state machine, guess mutation
  lib/         shareGrid.ts  tiers.ts
               __tests__/shareGrid.test.ts
  models/      clusters.ts

src/lib/clusters/
  dateMap.ts     # play date <-> source date, launch constants, request-date rules
  nytSource.ts   # the ONLY provider-specific module (see 9)
  puzzleDb.ts    # dailyClusters read/write (admin SDK)
  scoring.ts     # evaluateGuess, validateGuess - pure, no I/O
  session.ts     # session doc + the guess transaction
  profile.ts     # applyResult, displayedStreak - pure
  __tests__/     dateMap  scoring  profile  nytSource

src/app/api/v1/clusters/
  daily/route.ts  guess/route.ts  archive/route.ts

scripts/ingest-clusters.ts
```

Lifted out of trivia so both games share one gate *(build)*:

```
src/lib/users/nickname.ts        # NICKNAME_MAX_LENGTH, sanitize, error, saveNickname
src/components/nickname-dialog.tsx
```

`src/lib/users/profile.ts` re-exports the helpers for server callers, so there is
exactly one definition. `localSession.ts` was dropped: server-side resume made a
local mirror redundant.

Four pure functions carry the actual game and all four are testable with no
Firestore involved. Keep them that way:

```ts
evaluateGuess(groups, guessWords, solvedTiers, history)  → GuessOutcome
validateGuess(layout, guessWords, solvedWords)           → GuessRejection | null
applyResult(profile, outcome)                            → ClustersProfile
displayedStreak(profile, today)                          → number
```

**Firestore rules** — in `firestore.rules`:

```
match /dailyClusters/{date} { allow read, write: if false; }   // server only

match /users/{uid} {
  match /clustersProfile/{docId}  { allow read: if request.auth != null && request.auth.uid == uid; }
  match /clustersGames/{docId}    { allow read: if request.auth != null && request.auth.uid == uid; }
  match /clustersSessions/{docId} { allow read, write: if false; }   // never client-visible
}
```

The `dailyClusters` rule is load-bearing: if the client can read that collection, the
whole server-authoritative design (§3) is decorative.

**Indexes:** none. Every query is a document get or a single-field range within one
subcollection. `firestore.indexes.json` is untouched.

**Also:** add `CLUSTERS: '/clusters'` to `src/app/route-constants.ts` and a card to the
home grid in `src/app/page.tsx`.

---

## 9. On the source

The words and category titles are editorially authored by the NYT and are their
copyrighted work, even though the JSON is served publicly and unauthenticated. Serving
them under our own name on a public site is a real exposure, not a technicality, and no
amount of date-shifting changes that.

Two things make it manageable, and both are design decisions rather than afterthoughts:

1. **Credit travels with the puzzle.** `source.editor` is ingested and displayed on the
   end screen — "Puzzle by Wyna Liu, originally published by The New York Times." Not a
   defense, but the difference between homage and laundering.
2. **The source is one field.** `ClustersPuzzle.source` is the only provider-specific
   thing in the entire design. Everything downstream — API, session, scoring, stats,
   share — reads `layout` and `groups` and knows nothing about where they came from.
   Swapping to hand-authored or generated puzzles is a change to `ingest-clusters.ts` and
   nothing else.

That second point is worth protecting during the build. It is the cheap insurance.

---

## 10. Build order

Each phase is verifiable on its own. Phases 0-4 are **built**; the outstanding
work is at the bottom.

**Phase 0 — the pipeline.** `dateMap`, `puzzleDb`, `ingest-clusters.ts`, Firestore rules.
Verify: day 1 in Firestore is NYT puzzle #1, and today's doc holds the 2023-09-05
puzzle. No UI yet.

> **Outstanding.** The code is done and `--dry-run` confirms all 1182 source days
> parse cleanly, but the backfill itself has not been run — it writes 1182 documents
> to production Firestore, so it is a deliberate step, not a side effect of the build.
> Until it runs, every date returns 404 and the game shows "No puzzle for this day."
>
> ```
> npm run ingest:clusters -- --backfill
> ```

**Phase 1 — the server game.** `scoring.ts`, `session.ts`, and the `daily` + `guess`
routes, with unit tests on the pure core: one-away detection, duplicate rejection,
idempotent `guessId`, the terminal transaction, future-date and pre-launch rejection.
Playable via curl before a single component is written.

**Phase 2 — the board.** Threshold, grid, selection, controls, solved banners, mistake
dots, reveal, end screen. Add the tier tokens. Accessibility built in from the first
commit — retrofitting roving focus and live regions costs several times what building
them in does.

**Phase 3 — identity and stats.** Lift `NicknameDialog` out of trivia, add the name gate,
`profile.ts` and its transaction, the stats page, purple-first recognition.

**Phase 4 — archive, share, CTA.** Calendar page, share grid, sign-up CTA, "already
played today" recall, the empty and error states in plain chrome language (Principle 4).

**Phase 5 — the cron.** *(outstanding)* Daily `ingest:clusters` so the buffer keeps
refilling. Not urgent — the backfill covers three years — but an unrefilled buffer is a
bug with a three-year fuse, so wire it while the context is fresh. Nothing in the code
depends on it; it is one scheduled command.

---

## 11. Open, deliberately

- **Leaderboard.** Not requested and not designed. Clusters has no score, only mistakes,
  so a leaderboard would need an invented metric. Worth resisting until there is a reason.
- **Streak definition.** Played-days, not won-days (§5.2). Revisit once there is real
  data on whether hard puzzles are costing returns.
- **Cave↔game transition.** Under-designed app-wide by choice; Clusters inherits whatever
  the shell does and should not invent its own.
