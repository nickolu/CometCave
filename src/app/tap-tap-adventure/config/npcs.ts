export type IntentType = 'flatter' | 'charm' | 'threaten' | 'inquire' | 'offend' | 'lie' | 'bore' | 'neutral'

export interface RelationshipTier {
  tier: string
  label: string
  min: number
  max: number
  color: string
}

export const RELATIONSHIP_TIERS: RelationshipTier[] = [
  { tier: 'hostile',    label: 'Hostile',    min: -100, max: -30, color: 'text-red-500' },
  { tier: 'unfriendly', label: 'Unfriendly', min: -30,  max: -10, color: 'text-orange-400' },
  { tier: 'neutral',    label: 'Neutral',    min: -10,  max: 20,  color: 'text-slate-400' },
  { tier: 'friendly',   label: 'Friendly',   min: 20,   max: 50,  color: 'text-green-400' },
  { tier: 'trusted',    label: 'Trusted',    min: 50,   max: 80,  color: 'text-blue-400' },
  { tier: 'bonded',     label: 'Bonded',     min: 80,   max: 100, color: 'text-amber-400' },
]

export function getRelationshipTier(disposition: number): RelationshipTier {
  const clamped = Math.max(-100, Math.min(100, disposition))
  for (const tier of RELATIONSHIP_TIERS) {
    if (clamped >= tier.min && clamped < tier.max) return tier
  }
  // disposition === 100 falls through — return bonded
  return RELATIONSHIP_TIERS[RELATIONSHIP_TIERS.length - 1]
}

export interface GameNPC {
  id: string
  name: string
  role: string
  description: string
  regionId: string
  personality: string
  icon: string
  greeting: string
  combatRole: 'combatant' | 'non-combatant'
  personalityWeights?: Partial<Record<IntentType, number>>
  topics?: string[]
}

export const NPCS: GameNPC[] = [
  {
    id: 'elder_maren',
    name: 'Elder Maren',
    role: 'Village Elder',
    description: 'The wise elder of Hearthwood, keeper of ancient lore and guide to new adventurers.',
    regionId: 'hearthwood',
    personality: 'Wise, welcoming, and patient. Speaks with warmth and authority. Offers practical advice and tips to adventurers. Uses gentle humor. Values courage and kindness.',
    icon: '\u{1F9D9}',
    combatRole: 'non-combatant',
    greeting: 'Ah, a new face! Welcome, traveler. This village has seen many adventurers pass through — may your journey be long and your tales worth telling.',
    personalityWeights: { charm: 2, inquire: 1, flatter: 1, threaten: -2, offend: -2, bore: -1, lie: -1, neutral: 0 },
    topics: ['village history', 'adventurer guidance', 'ancient lore', 'local legends'],
  },
  {
    id: 'bramble',
    name: 'Bramble',
    role: 'Traveling Merchant',
    description: 'A jovial merchant who roams the Green Meadows, always eager to share gossip and strike deals.',
    regionId: 'green_meadows',
    personality: 'Jovial, chatty, and loves gossip. Always looking for a deal. Speaks enthusiastically and uses merchant slang. Has a laugh for every situation. Drops hints about rare goods or local rumors.',
    icon: '\u{1F9F3}',
    combatRole: 'non-combatant',
    greeting: "Ha! You look like someone who appreciates a good bargain. Bramble's the name — finest goods this side of the Dark Forest, and tales to boot!",
    personalityWeights: { flatter: 2, charm: 1, inquire: 1, threaten: -1, offend: -2, bore: -1, lie: 0, neutral: 0 },
    topics: ['rare goods', 'trade rumors', 'local gossip', 'bargains', 'travel routes'],
  },
  {
    id: 'whisper',
    name: 'Whisper',
    role: 'Forest Spirit',
    description: 'An ancient spirit of the Dark Forest, speaking in riddles and half-truths.',
    regionId: 'dark_forest',
    personality: 'Mysterious, cryptic, and speaks in riddles and metaphors. Ancient and otherworldly. Reveals hidden truths obliquely. Neither fully good nor evil. Knows secrets of the forest.',
    icon: '\u{1F9DA}',
    combatRole: 'combatant',
    greeting: 'The trees... they remember your footsteps. Every path chosen is a path not taken. What brings the warmth of flesh to where shadows breathe?',
    personalityWeights: { inquire: 2, charm: 1, neutral: 1, offend: -2, threaten: -1, bore: -1, flatter: 0, lie: -1 },
    topics: ['forest secrets', 'ancient riddles', 'hidden paths', 'shadow lore', 'nature omens'],
  },
  {
    id: 'grimjaw',
    name: 'Grimjaw',
    role: 'Grizzled Veteran',
    description: 'A battle-scarred warrior who survived the Bone Wastes and now broods among the remains.',
    regionId: 'bone_wastes',
    personality: 'Gruff, direct, and battle-hardened. Respects strength and survival above all. Short sentences. Dismissive of weakness. Warms up slightly to those who prove themselves. Knows tactical battle wisdom.',
    icon: '\u{1F9B4}',
    combatRole: 'combatant',
    greeting: "You want to talk? Fine. Make it quick. Every minute standing still is a minute something out there gains on you.",
    personalityWeights: { threaten: 1, inquire: 1, neutral: 1, flatter: -1, bore: -2, offend: -1, charm: 0, lie: -1 },
    topics: ['battle tactics', 'survival skills', 'Bone Wastes dangers', 'old wars', 'enemy weaknesses'],
  },
  {
    id: 'crystalline',
    name: 'Crystalline',
    role: 'Crystal Golem',
    description: 'An ancient construct of living crystal, guardian of the Crystal Caves and keeper of deep lore.',
    regionId: 'crystal_caves',
    personality: 'Ancient, formal, and precise. Speaks in measured, deliberate tones. Deeply knowledgeable about history and arcane lore. Emotionless but not unkind. Values accuracy and truth above all.',
    icon: '\u{1F48E}',
    combatRole: 'combatant',
    greeting: 'Designation: traveler. Purpose: unknown. This unit has observed 4,712 adventurers traverse these caverns. State your query and I will consult my archives.',
    personalityWeights: { inquire: 2, neutral: 1, charm: 0, flatter: -1, threaten: -2, offend: -2, bore: -1, lie: -2 },
    topics: ['crystal cave history', 'arcane lore', 'ancient records', 'golem origins', 'magical theory'],
  },
  {
    id: 'pyraxis',
    name: 'Pyraxis',
    role: 'Fire Mage',
    description: 'A passionate scholar of flame magic who studies the Scorched Wastes with fervent dedication.',
    regionId: 'scorched_wastes',
    personality: 'Passionate, hot-tempered, and scholarly. Enthusiastic about fire magic and ancient lore. Gets excited easily and speaks in bursts. Brilliant but impatient with ignorance. Generous with knowledge when impressed.',
    icon: '\u{1F525}',
    combatRole: 'combatant',
    greeting: "You dare venture here? EXCELLENT! The Wastes are magnificent — most flee screaming. Tell me, do you feel it? The ambient heat reading is up twelve degrees today!",
    personalityWeights: { inquire: 2, charm: 1, flatter: 1, bore: -2, offend: -1, threaten: -1, neutral: 0, lie: -1 },
    topics: ['fire magic', 'Scorched Wastes phenomena', 'elemental theory', 'ancient ruins', 'magical experiments'],
  },
  {
    id: 'umbra',
    name: 'Umbra',
    role: 'Shadow Broker',
    description: 'A mysterious dealer in secrets who operates from the Shadow Realm, trading information for information.',
    regionId: 'shadow_realm',
    personality: 'Sly, transactional, and deals in secrets. Everything is a negotiation. Smooth and calculating. Amused by mortals but not contemptuous. Will share valuable secrets for the right price or information.',
    icon: '\u{1F578}\u{FE0F}',
    combatRole: 'non-combatant',
    greeting: "Oh my... a living soul in my realm. How refreshing. I deal in secrets, traveler — and you have the look of someone who wants one. Shall we... negotiate?",
    personalityWeights: { lie: 1, charm: 1, inquire: 1, bore: -1, flatter: 0, threaten: -1, offend: -2, neutral: 0 },
    topics: ['secret information', 'shadow realm trade', 'hidden knowledge', 'bargaining chips', 'dangerous rumors'],
  },
  {
    id: 'seraphiel',
    name: 'Seraphiel',
    role: 'Angelic Guardian',
    description: 'A divine guardian of the Celestial Throne who tests the worthiness of all who approach.',
    regionId: 'celestial_throne',
    personality: 'Noble, dignified, and tests worthiness. Speaks with divine authority. Fair but demanding. Rewards genuine virtue and punishes arrogance. Genuinely cares for mortal souls despite stern demeanor.',
    icon: '\u{1F47C}',
    combatRole: 'combatant',
    greeting: 'Halt, mortal. Few souls reach the Celestial Throne. Fewer still are worthy of what lies within. Speak — what virtue do you carry that justifies your presence here?',
    personalityWeights: { charm: 2, inquire: 1, neutral: 1, lie: -2, offend: -2, threaten: -1, flatter: -1, bore: -1 },
    topics: ['divine worthiness', 'celestial lore', 'virtuous deeds', 'mortal trials', 'heavenly knowledge'],
  },
]

export function getNPCsForRegion(regionId: string): GameNPC[] {
  return NPCS.filter(npc => npc.regionId === regionId)
}

export function getNPCById(id: string): GameNPC | undefined {
  return NPCS.find(npc => npc.id === id)
}

export const ENCOUNTER_NPCS: GameNPC[] = [
  {
    id: 'enc-wandering-merchant',
    name: 'Wandering Merchant',
    role: 'Merchant',
    description: 'A weathered traveler with a cart full of curiosities.',
    regionId: 'any',
    personality: 'Shrewd and talkative, always looking for a deal.',
    icon: '🧳',
    combatRole: 'non-combatant',
    greeting: 'Ho there, traveler! Care to hear about my wares?',
    personalityWeights: { flatter: 2, charm: 1, threaten: -2, inquire: 1, offend: -2, lie: -1, bore: -1, neutral: 0 },
    topics: ['trade', 'rumors', 'regions', 'prices'],
  },
  {
    id: 'enc-lost-scholar',
    name: 'Lost Scholar',
    role: 'Scholar',
    description: 'A bookish figure squinting at an upside-down map.',
    regionId: 'any',
    personality: 'Absent-minded but brilliant, fascinated by local history.',
    icon: '📚',
    combatRole: 'non-combatant',
    greeting: 'Excuse me — is this the road to... oh dear, I seem to be quite lost.',
    personalityWeights: { flatter: 0, charm: 1, threaten: -2, inquire: 2, offend: -1, lie: -2, bore: 1, neutral: 1 },
    topics: ['history', 'landmarks', 'magic', 'lore'],
  },
  {
    id: 'enc-retired-soldier',
    name: 'Retired Soldier',
    role: 'Veteran',
    description: 'A scarred warrior sitting by the roadside, polishing a battered shield.',
    regionId: 'any',
    personality: 'Gruff but honorable, respects directness and courage.',
    icon: '⚔️',
    combatRole: 'combatant',
    greeting: 'Sit down, youngster. The road ahead gets rough.',
    personalityWeights: { flatter: -1, charm: 0, threaten: 1, inquire: 1, offend: -1, lie: -2, bore: -1, neutral: 1 },
    topics: ['combat', 'training', 'war stories', 'tactics'],
  },
  {
    id: 'enc-mysterious-herbalist',
    name: 'Mysterious Herbalist',
    role: 'Herbalist',
    description: 'A hooded figure gathering strange plants by the roadside.',
    regionId: 'any',
    personality: 'Cryptic and knowledgeable about natural remedies and poisons.',
    icon: '🌿',
    combatRole: 'non-combatant',
    greeting: 'Interesting... you have the look of someone who could use my help.',
    personalityWeights: { flatter: 1, charm: 2, threaten: -2, inquire: 1, offend: -2, lie: 0, bore: -1, neutral: 0 },
    topics: ['herbs', 'healing', 'poisons', 'nature'],
  },
  {
    id: 'enc-traveling-bard',
    name: 'Traveling Bard',
    role: 'Bard',
    description: 'A colorfully dressed performer strumming a lute on the roadside.',
    regionId: 'any',
    personality: 'Flamboyant, loves gossip and stories, easily offended by rudeness.',
    icon: '🎶',
    combatRole: 'non-combatant',
    greeting: 'Ah, a fellow traveler! Let me sing you a tale — for a small fee, of course.',
    personalityWeights: { flatter: 2, charm: 2, threaten: -2, inquire: 0, offend: -2, lie: 1, bore: -2, neutral: -1 },
    topics: ['songs', 'gossip', 'tales', 'entertainment'],
  },
  {
    id: 'enc-shady-informant',
    name: 'Hooded Stranger',
    role: 'Informant',
    description: 'A cloaked figure lurking in the shadows, watching the road.',
    regionId: 'any',
    personality: 'Suspicious and secretive, but knows things others don\'t.',
    icon: '🕵️',
    combatRole: 'non-combatant',
    greeting: 'Psst... you look like someone who can keep a secret.',
    personalityWeights: { flatter: 0, charm: 1, threaten: 1, inquire: 1, offend: -1, lie: 2, bore: -2, neutral: -1 },
    topics: ['secrets', 'bounties', 'hidden places', 'dangers'],
  },
  {
    id: 'enc-lost-child',
    name: 'Lost Child',
    role: 'Child',
    description: 'A small child sitting by the road, looking frightened.',
    regionId: 'any',
    personality: 'Scared but trusting, responds well to kindness.',
    icon: '👧',
    combatRole: 'non-combatant',
    greeting: 'Are you... are you a hero? I\'m lost and I\'m scared.',
    personalityWeights: { flatter: 0, charm: 2, threaten: -2, inquire: 0, offend: -2, lie: -1, bore: -1, neutral: 1 },
    topics: ['home', 'family', 'help', 'directions'],
  },
  {
    id: 'enc-foreign-diplomat',
    name: 'Foreign Diplomat',
    role: 'Diplomat',
    description: 'An elegantly dressed emissary traveling with a small entourage.',
    regionId: 'any',
    personality: 'Polished and perceptive, values eloquence and protocol.',
    icon: '👑',
    combatRole: 'non-combatant',
    greeting: 'Greetings, citizen. I represent the interests of a distant kingdom.',
    personalityWeights: { flatter: 1, charm: 1, threaten: -2, inquire: 2, offend: -2, lie: -1, bore: -1, neutral: 1 },
    topics: ['politics', 'trade agreements', 'alliances', 'culture'],
  },
]

export function getRandomEncounterNPC(): GameNPC {
  return ENCOUNTER_NPCS[Math.floor(Math.random() * ENCOUNTER_NPCS.length)]
}
