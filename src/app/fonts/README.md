# Fonts

Self-hosted copies of the Google Fonts the site uses, loaded through
`next/font/local` in `src/app/layout.tsx` and `src/app/voice-journey/layout.tsx`.

They live in the repo so the build never fetches from Google. Google Fonts
intermittently serves extensionless `/l/font?kit=` URLs that Turbopack cannot
resolve (`next/font/google queries have exactly one entry`), and when it does,
the deploy fails for a reason that has nothing to do with the change being
deployed. See vercel/next.js#99114; the upstream fix was never merged.

Each file is the `latin` subset as served by `fonts.googleapis.com/css2` on
2026-11-05. Variable fonts carry their full weight axis; Be Vietnam Pro has no
variable cut, so it is three static weights.

| File | Family | Weights |
|---|---|---|
| `plus-jakarta-sans-200-800-latin.woff2` | Plus Jakarta Sans | 200–800 (variable) |
| `be-vietnam-pro-{400,500,700}-latin.woff2` | Be Vietnam Pro | 400, 500, 700 |
| `lexend-100-900-latin.woff2` | Lexend | 100–900 (variable) |
| `fredoka-300-700-latin.woff2` | Fredoka | 300–700 (variable) |
| `nunito-200-1000-latin.woff2` | Nunito | 200–1000 (variable) |

All five families are published under the SIL Open Font License 1.1
(https://openfontlicense.org), which permits bundling and redistribution.
To add a weight or subset, fetch the css2 stylesheet with a browser user agent
and copy the `url(...)` from the matching `@font-face` block.
