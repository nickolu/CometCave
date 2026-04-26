import { FantasyCharacter } from '@/app/tap-tap-adventure/models/character'
import { FantasyDecisionPoint } from '@/app/tap-tap-adventure/models/story'

interface TownEvent {
  title: string
  description: string
  options: {
    id: string
    text: string
    successProbability: number
    successDescription: string
    successEffects: Record<string, number>
    failureDescription: string
    failureEffects: Record<string, number>
  }[]
}

const TOWN_EVENTS: TownEvent[] = [
  {
    title: 'Barroom Brawl',
    description: 'As you enter town, a fight spills out of the tavern! Two burly men are throwing punches while onlookers cheer. One of them stumbles into you.',
    options: [
      {
        id: 'join-brawl',
        text: '💪 Jump into the brawl',
        successProbability: 0.6,
        successDescription: 'You land a solid punch and the crowd cheers! The brawlers buy you a drink and slip you some coin for your trouble.',
        successEffects: { gold: 15, reputation: 2 },
        failureDescription: 'You take a hit to the jaw. The crowd laughs as you stumble. At least you can still walk.',
        failureEffects: { gold: -5 },
      },
      {
        id: 'break-up-fight',
        text: '🤝 Try to break it up',
        successProbability: 0.7,
        successDescription: 'You step between them with authority. Both men calm down, and the barkeep thanks you with a small reward.',
        successEffects: { gold: 10, reputation: 3 },
        failureDescription: 'They both turn on you briefly before going back to fighting each other. You escape with a bruise.',
        failureEffects: { reputation: -1 },
      },
      {
        id: 'ignore-brawl',
        text: '🚶 Walk around it',
        successProbability: 1.0,
        successDescription: 'You step around the chaos and continue into town. Not your problem.',
        successEffects: {},
        failureDescription: '',
        failureEffects: {},
      },
    ],
  },
  {
    title: 'Traveling Merchant',
    description: 'A richly dressed merchant pulls you aside at the town gate. "Psst! I have something special today — a genuine enchanted trinket, freshly acquired. Interested? Only 20 gold."',
    options: [
      {
        id: 'buy-trinket',
        text: '🪙 Buy the trinket (20 gold)',
        successProbability: 0.5,
        successDescription: 'The trinket glows faintly — it\'s real! You got a great deal. The merchant tips their hat and vanishes into the crowd.',
        successEffects: { gold: -20, reputation: 1 },
        failureDescription: 'The "enchanted" trinket turns out to be a painted rock. The merchant has already disappeared. You\'ve been swindled!',
        failureEffects: { gold: -20 },
      },
      {
        id: 'haggle',
        text: '🗣️ Haggle for a better price',
        successProbability: 0.6,
        successDescription: 'Your smooth talking works! The merchant agrees to 10 gold. The trinket has a faint magical aura — a fair deal.',
        successEffects: { gold: -10, reputation: 1 },
        failureDescription: 'The merchant scoffs at your offer and walks away. "Your loss, adventurer!"',
        failureEffects: {},
      },
      {
        id: 'decline-merchant',
        text: '🚫 Decline politely',
        successProbability: 1.0,
        successDescription: 'You wave them off. "Suit yourself!" they call after you.',
        successEffects: {},
        failureDescription: '',
        failureEffects: {},
      },
    ],
  },
  {
    title: 'Pickpocket!',
    description: 'You feel a tug at your belt pouch as you walk through the crowded town square. A small figure darts away — a pickpocket!',
    options: [
      {
        id: 'chase-thief',
        text: '🏃 Chase the pickpocket',
        successProbability: 0.55,
        successDescription: 'You catch the little rascal and recover your coin — plus a bonus from their stash!',
        successEffects: { gold: 12, reputation: 2 },
        failureDescription: 'They\'re too quick! You lose them in the alley and realize they got away with some of your gold.',
        failureEffects: { gold: -15 },
      },
      {
        id: 'shout-for-guards',
        text: '📢 Shout for the guards',
        successProbability: 0.8,
        successDescription: 'A guard nabs the pickpocket. They return your coin and the guard captain thanks you for the alert.',
        successEffects: { gold: 5, reputation: 3 },
        failureDescription: 'The guards look around but the thief is gone. At least they didn\'t get much.',
        failureEffects: { gold: -5 },
      },
      {
        id: 'check-pouch',
        text: '👛 Check your pouch',
        successProbability: 1.0,
        successDescription: 'You check and breathe a sigh of relief — they only got a few coins. Could\'ve been worse.',
        successEffects: { gold: -3 },
        failureDescription: '',
        failureEffects: {},
      },
    ],
  },
  {
    title: 'Town Festival',
    description: 'The town is celebrating a local festival! Music fills the streets, colorful banners wave overhead, and the smell of sweet pastries drifts from every stall.',
    options: [
      {
        id: 'join-festival',
        text: '🎉 Join the festivities',
        successProbability: 0.85,
        successDescription: 'You dance, eat, and make merry with the townsfolk! The celebration lifts your spirits and you feel refreshed.',
        successEffects: { gold: -5, reputation: 4 },
        failureDescription: 'You enjoy yourself but accidentally break a stall display. The merchant is not pleased.',
        failureEffects: { gold: -10, reputation: -2 },
      },
      {
        id: 'enter-contest',
        text: '🏆 Enter the festival contest',
        successProbability: 0.4,
        successDescription: 'You win the contest! The crowd erupts in cheers and the mayor presents you with a prize purse.',
        successEffects: { gold: 30, reputation: 5 },
        failureDescription: 'You put in a good effort but don\'t place. The crowd gives polite applause as the winner is crowned.',
        failureEffects: { reputation: 1 },
      },
      {
        id: 'skip-festival',
        text: '🚶 Head straight to business',
        successProbability: 1.0,
        successDescription: 'You nod politely at the festivities and head to the town center. Business before pleasure.',
        successEffects: {},
        failureDescription: '',
        failureEffects: {},
      },
    ],
  },
  {
    title: 'Mysterious Stranger',
    description: 'A cloaked figure beckons to you from a shadowy alcove as you enter town. Their eyes gleam with urgency. "Adventurer, I have information that may save your life... for a price."',
    options: [
      {
        id: 'pay-stranger',
        text: '🪙 Pay for information (15 gold)',
        successProbability: 0.65,
        successDescription: 'The stranger reveals the location of a hidden cache nearby and warns of dangerous creatures on the road ahead. Valuable intel!',
        successEffects: { gold: -15, reputation: 2 },
        failureDescription: 'The "information" turns out to be vague nonsense anyone could guess. The stranger vanishes before you can complain.',
        failureEffects: { gold: -15 },
      },
      {
        id: 'intimidate-stranger',
        text: '😠 Demand they tell you for free',
        successProbability: 0.35,
        successDescription: 'Impressed by your boldness, the stranger reveals their information freely and even adds a small token of respect.',
        successEffects: { gold: 5, reputation: 1 },
        failureDescription: 'The stranger laughs. "Brave but foolish. You\'ll learn the hard way." They disappear into the shadows.',
        failureEffects: { reputation: -2 },
      },
      {
        id: 'ignore-stranger',
        text: '🚶 Keep walking',
        successProbability: 1.0,
        successDescription: 'You ignore the stranger and continue into town. Probably nothing important... probably.',
        successEffects: {},
        failureDescription: '',
        failureEffects: {},
      },
    ],
  },
]

/**
 * Possibly generates a random town event. Returns null if no event triggers.
 * ~15% chance of an event on town entry.
 */
export function maybeGenerateTownEvent(
  character: FantasyCharacter,
  townName: string
): FantasyDecisionPoint | null {
  // 15% chance of a random event
  if (Math.random() > 0.15) return null

  // Pick a random event
  const event = TOWN_EVENTS[Math.floor(Math.random() * TOWN_EVENTS.length)]

  // Skip gold-costing events if player is broke
  if ((character.gold ?? 0) < 20 && (event.title === 'Traveling Merchant' || event.title === 'Mysterious Stranger')) {
    // Re-roll once
    const fallback = TOWN_EVENTS.filter(e => e.title !== 'Traveling Merchant' && e.title !== 'Mysterious Stranger')
    if (fallback.length === 0) return null
    const alt = fallback[Math.floor(Math.random() * fallback.length)]
    return buildEventDecisionPoint(alt, townName)
  }

  return buildEventDecisionPoint(event, townName)
}

function buildEventDecisionPoint(event: TownEvent, townName: string): FantasyDecisionPoint {
  return {
    id: `decision-town-event-${Date.now()}`,
    eventId: `town-event-${Date.now()}`,
    prompt: `**${event.title}**\n\n${event.description}`,
    options: event.options.map(opt => ({
      id: `town-event-${opt.id}`,
      text: opt.text,
      successProbability: opt.successProbability,
      successDescription: opt.successDescription,
      successEffects: opt.successEffects,
      failureDescription: opt.failureDescription,
      failureEffects: opt.failureEffects,
      resultDescription: opt.successDescription,
    })),
    resolved: false,
  }
}

