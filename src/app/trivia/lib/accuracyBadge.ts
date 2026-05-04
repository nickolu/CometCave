// Post-answer community-accuracy line for infinite-mode trivia.
// Uses pre-increment counts so the badge reflects "the players who came
// before you," not the current player's own answer feeding back in.
// Returns null when there's no prior history (the trailblazer headline
// covers that case in the UI).
export function getAccuracyBadge(priorTimesShown: number, priorTimesCorrect: number): string | null {
  if (priorTimesShown <= 0) return null
  if (priorTimesShown < 5) {
    return `${priorTimesCorrect} of ${priorTimesShown} got this right`
  }
  const pct = Math.round((priorTimesCorrect / priorTimesShown) * 100)
  return `${pct}% got this right · ${priorTimesShown} plays`
}
