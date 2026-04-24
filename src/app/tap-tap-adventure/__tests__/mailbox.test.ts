import { describe, it, expect } from 'vitest'
import { FantasyCharacterSchema } from '@/app/tap-tap-adventure/models/character'
import { calculateDay } from '@/app/tap-tap-adventure/lib/leveling'

type MailMessage = {
  id: string
  fromNpcId: string
  fromName: string
  fromIcon: string
  subject: string
  body: string
  attachedGold?: number
  read: boolean
  day: number
}

function makeCharacter(overrides: Record<string, unknown> = {}) {
  return FantasyCharacterSchema.parse({
    id: 'test-char',
    playerId: 'player-1',
    name: 'Test Hero',
    race: 'Human',
    class: 'Warrior',
    level: 1,
    abilities: [],
    locationId: 'town',
    gold: 100,
    reputation: 0,
    distance: 0,
    status: 'active',
    strength: 5,
    intelligence: 5,
    luck: 5,
    charisma: 5,
    inventory: [],
    ...overrides,
  })
}

describe('Mailbox schema', () => {
  it('defaults to empty array when not specified', () => {
    const char = makeCharacter()
    expect(char.mailbox).toEqual([])
  })

  it('accepts mail messages with correct fields', () => {
    const mail: MailMessage[] = [
      {
        id: 'mail-npc1-1-123',
        fromNpcId: 'npc1',
        fromName: 'Old Tom',
        fromIcon: '🧙',
        subject: 'Greetings, friend',
        body: 'Hope your travels go well.',
        read: false,
        day: 1,
      },
    ]
    const char = makeCharacter({ mailbox: mail })
    expect(char.mailbox).toHaveLength(1)
    expect(char.mailbox[0].fromName).toBe('Old Tom')
    expect(char.mailbox[0].subject).toBe('Greetings, friend')
    expect(char.mailbox[0].read).toBe(false)
    expect(char.mailbox[0].day).toBe(1)
  })

  it('accepts mail with gold attachment', () => {
    const mail: MailMessage[] = [
      {
        id: 'mail-npc1-2-456',
        fromNpcId: 'npc1',
        fromName: 'Old Tom',
        fromIcon: '🧙',
        subject: 'A small gift',
        body: 'Some gold for you.',
        attachedGold: 15,
        read: false,
        day: 2,
      },
    ]
    const char = makeCharacter({ mailbox: mail })
    expect(char.mailbox[0].attachedGold).toBe(15)
  })

  it('gold attachment can be absent', () => {
    const mail: MailMessage[] = [
      {
        id: 'mail-npc1-3-789',
        fromNpcId: 'npc1',
        fromName: 'Old Tom',
        fromIcon: '🧙',
        subject: 'No gift',
        body: 'Just a note.',
        read: false,
        day: 3,
      },
    ]
    const char = makeCharacter({ mailbox: mail })
    expect(char.mailbox[0].attachedGold).toBeUndefined()
  })
})

describe('Mail gold claim logic', () => {
  it('claims gold and zeroes the attachment', () => {
    const mail: MailMessage = {
      id: 'mail-1',
      fromNpcId: 'npc1',
      fromName: 'Tom',
      fromIcon: '🧙',
      subject: 'Gift',
      body: 'Gold for you.',
      attachedGold: 20,
      read: false,
      day: 1,
    }
    // Simulate claim logic
    const initialGold = 100
    let gold = initialGold
    if (mail.attachedGold && mail.attachedGold > 0) {
      gold += mail.attachedGold
      mail.attachedGold = 0
      mail.read = true
    }
    expect(gold).toBe(120)
    expect(mail.attachedGold).toBe(0)
    expect(mail.read).toBe(true)
  })
})

describe('NPC mail disposition filtering', () => {
  it('only sends mail to NPCs with disposition >= 20', () => {
    const encounters = {
      npc1: { timesSpoken: 5, disposition: 25 },
      npc2: { timesSpoken: 3, disposition: 10 },
      npc3: { timesSpoken: 1, disposition: -5 },
      npc4: { timesSpoken: 8, disposition: 50 },
    }
    const eligibleNpcs = Object.entries(encounters).filter(
      ([, enc]) => (enc.disposition ?? 0) >= 20
    )
    expect(eligibleNpcs.map(([id]) => id)).toEqual(['npc1', 'npc4'])
    expect(eligibleNpcs).toHaveLength(2)
  })
})

describe('Mail day visibility filter', () => {
  it('hides mail from future days', () => {
    const currentDay = calculateDay(50) // some distance
    const allMail: MailMessage[] = [
      { id: '1', fromNpcId: 'npc1', fromName: 'Tom', fromIcon: '🧙', subject: 'Old', body: '...', read: true, day: 1 },
      { id: '2', fromNpcId: 'npc1', fromName: 'Tom', fromIcon: '🧙', subject: 'Current', body: '...', read: false, day: currentDay },
      { id: '3', fromNpcId: 'npc1', fromName: 'Tom', fromIcon: '🧙', subject: 'Future', body: '...', read: false, day: currentDay + 100 },
    ]
    const visibleMail = allMail.filter(m => m.day <= currentDay)
    expect(visibleMail).toHaveLength(2)
    expect(visibleMail.some(m => m.subject === 'Future')).toBe(false)
  })
})
