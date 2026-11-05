# Feature audit — November 2026

**Why now.** CometCave was built assuming no traffic: every model-backed route was open to the public and unmetered. The first pass (PR "AI behind sign-in with a daily allowance") closes that. This document is the second pass: which games earn their place in a product people will find on their own, and which should go.

The yardstick is CLAUDE.md principle 9 — does it plausibly move **daily return**, **session length** or **share rate** — plus two things the audit surfaced: does it lead with the mechanism instead of the effect (principle 5), and what does one session cost to serve.

Activity figures are commits in the last 180 days / lifetime, and the last commit date, as of 2026-11-04.

## Keep — the core

| Game | Activity | Serve cost | Why it stays |
|---|---|---|---|
| Daily Trivia | 58 / 178, Sep 2026 | pre-generated nightly; free-text judge is now sign-in only, anonymous get plain matching | The daily ritual. Streaks, leaderboards, weekly winners. The HOT tile. |
| Clusters | 2 / 2, Sep 2026 | none | Daily puzzle with a share grid. Cheap, complete, shareable. |
| Comet Cards | 153 / 169, Sep 2026 | none | Two dailies, deep system, the most invested game in the cave. |
| Meteor Coins | 9 / 9, Oct 2026 | none | 12-stage campaign, per-stage boards, physics toy that feels made. |
| Hum | 1 / 1, Oct 2026 | none | Shipped a month ago; a synth-teaching toy with a clear voice. |
| Starmatch | 3 / 3, Aug 2026 | none | Small, finished, quick re-entry. |
| Micro Land | 413 / 413, Aug 2026 | summon only (now gated, weight 15 — the most expensive call in the cave) | A world, not a widget. Owned by its designer. Summoning is the one paid feature and now sits behind sign-in inside the panel. |
| Badge Run | 49 / 49, Aug 2026 | none | Auto-battler with a leaderboard; no model calls at all. |
| Dicebound | 43 / 43, Aug 2026 | every turn (gated, weight 4) | The one place the "fresh content" promise is the whole game. Keep, metered. |
| Speck Wars | 418 / 418, Aug 2026 | none | RTS micro-battles with a skill doc behind it. Deep, no serve cost. |

## Keep, but it needs a decision

| Game | Activity | Serve cost | The question |
|---|---|---|---|
| Tap Tap Adventure | 36 / 355, Aug 2026 | nearly every step: classes, skill trees, combat, shops, quests, NPC and party dialogue (gpt-4o) — 8 gated routes | 50k lines and 355 commits, but every step of a run is a model call. It is the second most expensive game per session after Dicebound and the fallbacks are static text. Now gated and metered, it is affordable; the question is whether it is fun enough per dollar. Recommend: keep for now, watch its share of `aiUsage`, and revisit in a month with data. |
| Secret Word | 11 / 30, Aug 2026 | three small calls per turn (gpt-4o-mini) | A 20-questions game against a hidden word. Cheap and genuinely a game, but the home copy ("Guess the secret word!") undersells it and it has no daily beat, no share, no streak. Recommend: keep, give it a daily word so it joins the ritual. |

## Remove — recommended

These lead with the mechanism rather than the effect (principle 5), have no return loop (principle 9), and were the most expensive routes to leave open. Each is a one-shot tool, not a game: you make a thing, you leave.

| Feature | Activity | Serve cost | Why it goes |
|---|---|---|---|
| Whowouldwininator | 9 / 50, Aug 2026 | 13 routes, 3 of them image generation (gpt-image-1) | Two characters, one fight, a wall of generated text and up to several images. No reason to return. Most expensive single session in the cave before the gate. |
| Storybook Factory | 18 / 18, Aug 2026 | 4 routes incl. image generation from uploaded photos | Takes children's photos and makes illustrated stories: the privacy surface is wide for an all-ages site, the images are the cost, and it is a tool, not a game. |
| Avatar Maker | 4 / 18, Aug 2026 | image edit from an uploaded photo | Same shape as Storybook, smaller. "AI-powered avatars" was the pitch. |
| Voters | 9 / 29, Aug 2026 | 5 routes, one per simulated voter per question | A simulation of a crowd of model voters. Interesting once; the description on the home grid was literally "Create AI voters". |
| Chat Room of Infinity | 23 / 66, Aug 2026 | 4 routes, gpt-4o per character per message | Chat with fictional characters. Open-ended chat is the hardest thing to keep kid-safe, it is pure serve cost, and it is the only surface built on MUI rather than the cave's components. |
| I-Ching Oracle | 5 / 15, Aug 2026 | one gpt-4o call per reading | The interpretation step the whole thing leads to is a stub component — the reading renders a heading and nothing else. The library text works without a model. Either finish it or drop it; recommend drop. |
| Disneyland Hunt | 3 / 3, Jul 2026 | none | A personal scavenger-hunt checklist for one trip. Not a game for the public; a candidate for the unlisted treatment Voice Journey already has, if it is still wanted at all. |

## Removed in this pass

| Feature | Why |
|---|---|
| Ring Toss | Declared sunset in CLAUDE.md, not on the home grid or in any nav. Two files, no tests. Deleted; CLAUDE.md note updated. |
| fantasy-tycoon | Directory contained only `.DS_Store` files. Deleted. |

## Also noticed

- **Home grid order.** The grid lists the recommended-remove tools between Secret Word and Speck Wars. Once removals land, the remaining order should follow the daily beat: Trivia, Clusters, Comet Cards, then the run-loop games, then the worlds.
- **Nav duplication.** `top-nav-bar` and `side-nav-bar` each carry their own hand-picked game list (Oracle, Voters, Storybook, Chat Room, Tap Tap). Both should derive from one list, and that list should not include anything on the remove list.
- **Daily trivia fallback generation.** `GET /api/v1/trivia/daily` still generates live questions if the nightly cron missed a day. It persists the result, so it is bounded to roughly one generation a day, but it is the one unauthenticated model call left. Worth replacing with a plain "today's questions aren't ready" response once the cron is trusted.
- **Bring-your-own-key header.** Ten routes accept an `x-openai-api-key` header. No UI sends it. It costs nothing to leave, but it is dead surface area and should go with the next cleanup.
- **Voice Journey** stays unlisted and unauthenticated by design (one child's course progress, no model calls).

## What to do with this

The server gate and the allowance table are live regardless of which games stay. Removing a game from the recommended list is: delete `src/app/<game>` and `src/app/api/v1/<game>`, drop its `ROUTE_CONSTANTS` entry and home/nav tiles, remove its feature keys from `src/lib/ai/limits.ts`, and remove any Firestore collections it owned from `firestore.rules`.
