/** Server mock mode: placeholder pictures and canned AI lines, no model calls, no spend.
    Hard-ignored when VERCEL_ENV is production (previews have NODE_ENV=production too, so NODE_ENV cannot be used). */
export function isMockMode(env: Record<string, string | undefined> = process.env): boolean {
  return env.PICTURE_TELEPHONE_MOCK_IMAGES === 'true' && env.VERCEL_ENV !== 'production'
}
