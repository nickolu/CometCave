interface TravelContext {
  regionElement?: string // 'nature' | 'shadow' | 'fire' | 'ice' | 'arcane' | 'none'
  timeOfDay?: string // 'Morning' | 'Midday' | 'Afternoon' | 'Nightfall'
  weather?: string // weather id like 'clear' | 'rain' | 'storm' | 'fog' | etc.
}

const genericMessages = [
  'The road is quiet. You travel onward.',
  'A gentle breeze rustles the trees. Nothing of note happens.',
  'You take a moment to rest and reflect.',
  'You hear distant laughter, but nothing comes of it.',
  'The journey continues uneventfully.',
  'Nothing interesting happens while you proceed on your journey.',
  'The sights are breathtaking as you continue on your journey.',
  'You stroll through a beautiful meadow.',
  'The warm sun and a light breeze are exceptionally pleasant today.',
  'It starts to rain but not heavy enough to impede your journey.',
]

const elementMessages: Record<string, string[]> = {
  nature: [
    'Birdsong fills the canopy as you walk beneath ancient oaks.',
    'A deer watches you from the treeline before bounding away.',
    'Wildflowers paint the meadow in every color imaginable.',
    'A crystal-clear stream crosses your path — you pause to drink.',
    'The grass whispers in the breeze, bending like a green sea.',
    'Butterflies dance around you, drawn by something unseen.',
  ],
  shadow: [
    'The shadows seem to shift and whisper as you pass.',
    'A chill runs down your spine — something watches from the dark.',
    'The air grows thick with an unnatural silence.',
    'Faint, ghostly lights flicker at the edge of your vision.',
    'The ground crunches with old bones beneath dead leaves.',
    'A distant howl echoes through the gloom.',
  ],
  fire: [
    'Heat shimmers rise from the cracked earth ahead.',
    'Embers drift on the scorching wind like fiery snowflakes.',
    'The air tastes of ash and sulfur.',
    'A geyser of steam erupts nearby, then subsides.',
    'Pools of molten rock glow faintly in the distance.',
    'Sweat beads on your brow as the temperature climbs.',
  ],
  ice: [
    'Your breath forms clouds in the frigid air.',
    'Ice crystals glitter on every surface like scattered diamonds.',
    'The frozen ground creaks beneath your boots.',
    'A bitter wind cuts through your clothes.',
    'Snow drifts silently from a pale grey sky.',
    'An icicle snaps from a ledge and shatters at your feet.',
  ],
  arcane: [
    'Strange runes glow faintly on nearby stones, then fade.',
    'The air hums with residual magical energy.',
    'Reality seems to shimmer, like a heat haze made of starlight.',
    'A floating sigil drifts past, dissolving as you reach for it.',
    'The very stones beneath you pulse with ancient power.',
    'Echoes of forgotten incantations whisper on the wind.',
  ],
}

const timeMessages: Record<string, string[]> = {
  Morning: [
    'Dawn light filters through the landscape, painting everything gold.',
    'The morning air is fresh and full of promise.',
    'Dew glistens on every surface as the day begins.',
  ],
  Midday: [
    'The sun sits high overhead, casting short shadows.',
    'The midday heat slows your pace slightly.',
  ],
  Afternoon: [
    'Long shadows stretch across your path as the day wanes.',
    'The afternoon light turns everything amber.',
  ],
  Nightfall: [
    'Stars begin to emerge as darkness settles over the land.',
    'Your torch casts dancing shadows on the path ahead.',
    'The moon rises, bathing the landscape in silver light.',
    'Night creatures begin their chorus in the gathering dark.',
  ],
}

const weatherMessages: Record<string, string[]> = {
  rain: [
    'Rain patters steadily on your hood as you press onward.',
    'Puddles form on the path, reflecting the grey sky.',
  ],
  storm: [
    'Thunder rumbles in the distance, but the path remains clear.',
    'Lightning illuminates the landscape in brief, stark flashes.',
  ],
  fog: [
    'Thick fog obscures the path ahead — you navigate by feel.',
    'Shapes loom in the mist, only to reveal themselves as rocks.',
  ],
  blizzard: [
    'Snowflakes settle on your shoulders as you trudge onward.',
    'Fresh snow muffles your footsteps to near-silence.',
    'The howling blizzard makes every step a battle.',
  ],
  sandstorm: [
    'Grit stings your face as the sandstorm swirls around you.',
    'You pull your hood tight against the biting, wind-driven sand.',
  ],
  heat_wave: [
    'The scorching air shimmers before you in relentless waves.',
    'Every step in the oppressive heat feels twice as hard.',
  ],
}

export function getGenericTravelMessage(context?: TravelContext): string {
  const pool: string[] = [...genericMessages]

  if (context?.regionElement && elementMessages[context.regionElement]) {
    pool.push(...elementMessages[context.regionElement])
    pool.push(...elementMessages[context.regionElement]) // double weight
  }

  if (context?.timeOfDay && timeMessages[context.timeOfDay]) {
    pool.push(...timeMessages[context.timeOfDay])
  }

  if (context?.weather && weatherMessages[context.weather]) {
    pool.push(...weatherMessages[context.weather])
  }

  return pool[Math.floor(Math.random() * pool.length)]
}
