import { NextResponse } from 'next/server'
import { requireUser } from '@/lib/auth/guard'
import { listGardens, saveGarden } from '@/lib/db/gardens'
import { routeError } from '@/lib/api/route-error'
import { asRecord, readJsonBody } from '@/lib/api/request-body'

export async function GET() {
  try {
    const user = await requireUser()
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    const gardens = await listGardens(user.id)
    return NextResponse.json({ gardens })
  } catch (error) {
    return routeError(error, 'Failed to list gardens')
  }
}

export async function POST(request: Request) {
  try {
    const user = await requireUser()
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    const parsedBody = await readJsonBody(request)
    if (!parsedBody.ok) return parsedBody.response
    const body = parsedBody.body as Record<string, unknown>
    const saved = await saveGarden(user.id, {
      beds: Array.isArray(body.beds) ? body.beds : [],
      metadata: asRecord(body.metadata),
      siteData: asRecord(body.siteData),
      planData: asRecord(body.planData),
    })
    return NextResponse.json({ success: true, ...saved, gardenId: saved.planId })
  } catch (error) {
    return routeError(error, 'Failed to save garden')
  }
}
