# Picture Telephone: server setup and tunables

Routes live under `src/app/api/v1/picture-telephone/` (`image`, `describe`, `starter`, `moderate`). Their logic is in `src/lib/picture-telephone/server/handlers.ts`; safety code is in `src/lib/picture-telephone/safety/`.

## Environment variables

| Variable | Needed for | If unset |
|---|---|---|
| `ALLOW_IMAGE_GENERATION=true` | Real pictures (existing flag, shared with other games) | `image` returns 403 `IMAGES_DISABLED` and the setup screen says so. No credits are spent. |
| `PICTURE_TELEPHONE_SIGNING_KEY` | HMAC key that signs generated pictures; `describe` only accepts signed pictures | In production and previews the routes return 503 `NOT_CONFIGURED` (fail closed). Development and test use a built-in key. Use a long random string, for example `openssl rand -hex 32`. |
| `OPENAI_API_KEY` (existing) | Image generation and moderation | Image generation fails (502); moderation is "unavailable", so everything fails closed. |
| `ANTHROPIC_API_KEY` (existing) | AI players (`describe`), "AI starts", safer rewrite | AI players fail with 502 (retryable); "AI starts" uses a curated sentence; the rewrite falls back to a fixed gentle scene. |
| `PICTURE_TELEPHONE_IMAGE_MODEL` (optional) | Image model id | Defaults to `gpt-image-1`. It may retire around Dec 2026; set a newer GPT Image model id here, no code change. |
| `PICTURE_TELEPHONE_MOCK_IMAGES=true` (optional, dev/preview) | Placeholder pictures and canned AI lines, no spend, no model calls | Real mode. Ignored when `VERCEL_ENV=production`. The blocklist still runs and sign-in is still required. |
| `NEXT_PUBLIC_PICTURE_TELEPHONE_MOCK=true` (optional, local) | Client uses the in-browser mock provider and skips the sign-in gate | Client uses the API. |

## Safety layers (all fail closed)

1. Local blocklist (`safety/blocklist.ts`), after normalising case, accents, leetspeak, spacing and stretched letters.
2. OpenAI `omni-moderation-latest` against `MODERATION_THRESHOLDS` in `safety/config.ts`. A missing result, error, timeout (8 s) or unreadable response means "unavailable", never "safe".
3. The image model's own filter (`moderation: 'auto'`).
4. Every generated image is moderated before it is returned. A failure triggers one regenerate from a gentler rewrite, then `IMAGE_REJECTED`.
5. AI-written text (AI players, "AI starts", the rewrite) goes through layers 1 and 2. A rejected AI player line becomes a hand-written fallback line.

Rejected input is free: credits are spent only after the sentence passes layers 1 and 2. `moderate` is a friendly early check only; `image` always repeats the checks.

## Credits (`src/lib/ai/limits.ts`)

`picture-telephone-image` 3, `picture-telephone-describe` 1, `picture-telephone-starter` 1. Moderation is free. Credits are not refunded if a call fails after spending. A regenerate does not cost a second credit.

## Tunables

`safety/config.ts`: moderation thresholds, timeouts, image size/quality/compression, `moderate` rate limit (60 per hour per user), request caps. `safety/blocklist.ts`: the term list (slurs are left to the moderation model on purpose; extend if playtests show gaps). `safety/personas.ts`: persona prompts.
