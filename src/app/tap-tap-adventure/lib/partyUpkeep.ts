import { PartyMember } from '@/app/tap-tap-adventure/models/partyMember'

export function processPartyUpkeep(
  party: PartyMember[],
  gold: number,
  discountPct: number
): { remainingParty: PartyMember[]; newGold: number; dismissed: string[] } {
  const sorted = [...party].sort((a, b) => (b.dailyCost ?? 0) - (a.dailyCost ?? 0))
  let currentGold = gold
  const remainingParty: PartyMember[] = []
  const dismissed: string[] = []

  for (const member of sorted) {
    if ((member.dailyCost ?? 0) <= 0) {
      remainingParty.push(member)
      continue
    }
    const cost = Math.max(0, Math.floor((member.dailyCost ?? 0) * (1 - discountPct / 100)))
    if (currentGold >= cost) {
      currentGold -= cost
      remainingParty.push(member)
    } else {
      dismissed.push(member.name)
    }
  }

  return { remainingParty, newGold: currentGold, dismissed }
}
