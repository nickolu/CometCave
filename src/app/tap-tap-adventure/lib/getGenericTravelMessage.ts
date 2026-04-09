export function getGenericTravelMessage() {
  const genericMessages = [
    'The road is quiet. You travel onward.',
    'A gentle breeze rustles the trees. Nothing of note happens.',
    'You take a moment to rest and reflect.',
    'You hear distant laughter, but nothing comes of it.',
    'The journey continues uneventfully.',
    'Nothing interesting happens while you proceed on your journey.',
    'The sights are breathtaking as you continue on your journey.',
    'You stroll through a beautiful meadow.',
    'The warm sun a light breeze are exceptionally pleasant today.',
    'It starts to rain but not heavy enough to impede your journey.',
  ]
  return genericMessages[Math.floor(Math.random() * genericMessages.length)]
}
