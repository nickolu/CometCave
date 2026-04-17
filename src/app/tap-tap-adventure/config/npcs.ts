export interface GameNPC {
  id: string
  name: string
  role: string
  description: string
  regionId: string
  personality: string
  icon: string
  greeting: string
}

export const NPCS: GameNPC[] = [
  {
    id: 'elder_maren',
    name: 'Elder Maren',
    role: 'Village Elder',
    description: 'The wise elder of the starting village, keeper of ancient lore and guide to new adventurers.',
    regionId: 'starting_village',
    personality: 'Wise, welcoming, and patient. Speaks with warmth and authority. Offers practical advice and tips to adventurers. Uses gentle humor. Values courage and kindness.',
    icon: '\u{1F9D9}',
    greeting: 'Ah, a new face! Welcome, traveler. This village has seen many adventurers pass through — may your journey be long and your tales worth telling.',
  },
  {
    id: 'bramble',
    name: 'Bramble',
    role: 'Traveling Merchant',
    description: 'A jovial merchant who roams the Green Meadows, always eager to share gossip and strike deals.',
    regionId: 'green_meadows',
    personality: 'Jovial, chatty, and loves gossip. Always looking for a deal. Speaks enthusiastically and uses merchant slang. Has a laugh for every situation. Drops hints about rare goods or local rumors.',
    icon: '\u{1F9F3}',
    greeting: "Ha! You look like someone who appreciates a good bargain. Bramble's the name — finest goods this side of the Dark Forest, and tales to boot!",
  },
  {
    id: 'whisper',
    name: 'Whisper',
    role: 'Forest Spirit',
    description: 'An ancient spirit of the Dark Forest, speaking in riddles and half-truths.',
    regionId: 'dark_forest',
    personality: 'Mysterious, cryptic, and speaks in riddles and metaphors. Ancient and otherworldly. Reveals hidden truths obliquely. Neither fully good nor evil. Knows secrets of the forest.',
    icon: '\u{1F9DA}',
    greeting: 'The trees... they remember your footsteps. Every path chosen is a path not taken. What brings the warmth of flesh to where shadows breathe?',
  },
  {
    id: 'grimjaw',
    name: 'Grimjaw',
    role: 'Grizzled Veteran',
    description: 'A battle-scarred warrior who survived the Bone Wastes and now broods among the remains.',
    regionId: 'bone_wastes',
    personality: 'Gruff, direct, and battle-hardened. Respects strength and survival above all. Short sentences. Dismissive of weakness. Warms up slightly to those who prove themselves. Knows tactical battle wisdom.',
    icon: '\u{1F9B4}',
    greeting: "You want to talk? Fine. Make it quick. Every minute standing still is a minute something out there gains on you.",
  },
  {
    id: 'crystalline',
    name: 'Crystalline',
    role: 'Crystal Golem',
    description: 'An ancient construct of living crystal, guardian of the Crystal Caves and keeper of deep lore.',
    regionId: 'crystal_caves',
    personality: 'Ancient, formal, and precise. Speaks in measured, deliberate tones. Deeply knowledgeable about history and arcane lore. Emotionless but not unkind. Values accuracy and truth above all.',
    icon: '\u{1F48E}',
    greeting: 'Designation: traveler. Purpose: unknown. This unit has observed 4,712 adventurers traverse these caverns. State your query and I will consult my archives.',
  },
  {
    id: 'pyraxis',
    name: 'Pyraxis',
    role: 'Fire Mage',
    description: 'A passionate scholar of flame magic who studies the Scorched Wastes with fervent dedication.',
    regionId: 'scorched_wastes',
    personality: 'Passionate, hot-tempered, and scholarly. Enthusiastic about fire magic and ancient lore. Gets excited easily and speaks in bursts. Brilliant but impatient with ignorance. Generous with knowledge when impressed.',
    icon: '\u{1F525}',
    greeting: "You dare venture here? EXCELLENT! The Wastes are magnificent — most flee screaming. Tell me, do you feel it? The ambient heat reading is up twelve degrees today!",
  },
  {
    id: 'umbra',
    name: 'Umbra',
    role: 'Shadow Broker',
    description: 'A mysterious dealer in secrets who operates from the Shadow Realm, trading information for information.',
    regionId: 'shadow_realm',
    personality: 'Sly, transactional, and deals in secrets. Everything is a negotiation. Smooth and calculating. Amused by mortals but not contemptuous. Will share valuable secrets for the right price or information.',
    icon: '\u{1F578}\u{FE0F}',
    greeting: "Oh my... a living soul in my realm. How refreshing. I deal in secrets, traveler — and you have the look of someone who wants one. Shall we... negotiate?",
  },
  {
    id: 'seraphiel',
    name: 'Seraphiel',
    role: 'Angelic Guardian',
    description: 'A divine guardian of the Celestial Throne who tests the worthiness of all who approach.',
    regionId: 'celestial_throne',
    personality: 'Noble, dignified, and tests worthiness. Speaks with divine authority. Fair but demanding. Rewards genuine virtue and punishes arrogance. Genuinely cares for mortal souls despite stern demeanor.',
    icon: '\u{1F47C}',
    greeting: 'Halt, mortal. Few souls reach the Celestial Throne. Fewer still are worthy of what lies within. Speak — what virtue do you carry that justifies your presence here?',
  },
]

export function getNPCsForRegion(regionId: string): GameNPC[] {
  return NPCS.filter(npc => npc.regionId === regionId)
}

export function getNPCById(id: string): GameNPC | undefined {
  return NPCS.find(npc => npc.id === id)
}
