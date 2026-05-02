import { execSync } from 'node:child_process'

// Resolved once at module load. The commit hash is what we record alongside
// generated trivia questions so we can later attribute a question to the
// prompt + pipeline version that produced it.
//
// Resolution order:
//   1. GIT_COMMIT_SHA — explicit override (CI/build pipelines)
//   2. VERCEL_GIT_COMMIT_SHA — Vercel injects this into the runtime env
//   3. `git rev-parse HEAD` — local dev fallback
//   4. 'unknown' — never throw on missing version info
function resolveCommitHash(): string {
  const fromEnv = process.env.GIT_COMMIT_SHA ?? process.env.VERCEL_GIT_COMMIT_SHA
  if (fromEnv && fromEnv.length > 0) return fromEnv

  try {
    return execSync('git rev-parse HEAD', { stdio: ['ignore', 'pipe', 'ignore'] })
      .toString()
      .trim()
  } catch {
    return 'unknown'
  }
}

export const APP_VERSION = resolveCommitHash()
