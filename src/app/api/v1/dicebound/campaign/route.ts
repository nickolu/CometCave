/**
 * A player's campaign.
 *
 * GET reads it, PUT replaces it, DELETE abandons it — all three act on the
 * caller's own uid taken from the verified token. There is no uid in the path
 * or the body, so one player cannot address another's story at all.
 *
 * Anonymous callers are first-class here (CLAUDE.md principle 1). `useAuth`
 * mints an anonymous uid on arrival, so someone who has never signed up still
 * has a character that survives closing the tab, and signing up later links the
 * credential to that same uid and carries the campaign with it.
 */
import { type NextRequest, NextResponse } from 'next/server'

import {
  MAX_CAMPAIGN_BYTES,
  campaignBytes,
  validateCampaign,
} from '@/app/dicebound/domain/campaign'
import { verifyRequestAuth } from '@/lib/api/auth'
import { deleteCampaign, loadCampaign, saveCampaign } from '@/lib/dicebound/campaign-store'

export async function GET(request: NextRequest) {
  const auth = await verifyRequestAuth(request)
  if ('error' in auth) return auth.error

  try {
    const campaign = await loadCampaign(auth.claims.uid)
    // No stored campaign is the ordinary first-visit case, not a 404 — the
    // client wants "nothing yet", which is what null already means.
    return NextResponse.json({ campaign })
  } catch (error) {
    console.error('dicebound campaign load failed:', error)
    return NextResponse.json({ error: 'Could not find your story.' }, { status: 500 })
  }
}

export async function PUT(request: NextRequest) {
  const auth = await verifyRequestAuth(request)
  if ('error' in auth) return auth.error

  let body: { campaign?: unknown }
  try {
    body = (await request.json()) as { campaign?: unknown }
  } catch {
    return NextResponse.json({ error: 'Expected a JSON body.' }, { status: 400 })
  }

  const campaign = validateCampaign(body.campaign)
  if (!campaign) {
    return NextResponse.json({ error: 'That is not a campaign.' }, { status: 400 })
  }

  // The client trims to fit before sending. Anything still over the line is
  // not this game's client, so it is refused rather than trimmed for them.
  const bytes = campaignBytes(campaign)
  if (bytes > MAX_CAMPAIGN_BYTES) {
    return NextResponse.json({ error: 'That story is too long to keep.' }, { status: 413 })
  }

  try {
    await saveCampaign(auth.claims.uid, campaign)
    return NextResponse.json({ ok: true, bytes })
  } catch (error) {
    console.error('dicebound campaign save failed:', error)
    return NextResponse.json({ error: 'Could not keep your story.' }, { status: 500 })
  }
}

export async function DELETE(request: NextRequest) {
  const auth = await verifyRequestAuth(request)
  if ('error' in auth) return auth.error

  try {
    await deleteCampaign(auth.claims.uid)
    return NextResponse.json({ ok: true })
  } catch (error) {
    console.error('dicebound campaign delete failed:', error)
    return NextResponse.json({ error: 'Could not close that story.' }, { status: 500 })
  }
}
