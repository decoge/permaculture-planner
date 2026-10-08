import { NextRequest, NextResponse } from 'next/server'
import { requireUser } from '@/lib/auth/guard'
import { createJournalEntry } from '@/lib/db/recordings'
import { routeError } from '@/lib/api/route-error'

export async function POST(request: NextRequest) {
  try {
    const user = await requireUser()
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const body = await request.json()
    const planId = typeof body.planId === 'string' ? body.planId : ''
    if (!planId) {
      return NextResponse.json({ error: 'planId is required' }, { status: 400 })
    }

    const created = await createJournalEntry(user.id, planId, {
      title: typeof body.title === 'string' ? body.title : null,
      content: typeof body.content === 'string' ? body.content : '',
      tags: Array.isArray(body.tags) ? body.tags : null,
    })

    // Null covers both "not your plan" and "empty content"; one response, no
    // plan-existence oracle.
    if (!created) {
      return NextResponse.json({ error: 'Plan not found or entry is empty' }, { status: 404 })
    }

    return NextResponse.json({ success: true, id: created.id })
  } catch (error) {
    return routeError(error, 'Failed to save journal entry')
  }
}
