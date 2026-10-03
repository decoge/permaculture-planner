import { NextResponse } from 'next/server'
import { requireUser } from '@/lib/auth/guard'
import { adminListUsers } from '@/lib/db/admin'
import { routeError } from '@/lib/api/route-error'

export async function GET(request: Request) {
  try {
    const admin = await requireUser()
    if (!admin) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    if (!admin.isAdmin) return NextResponse.json({ error: 'Forbidden: Admin access required' }, { status: 403 })

    const { searchParams } = new URL(request.url)
    const page = Math.max(1, Number.parseInt(searchParams.get('page') || '1', 10) || 1)
    const limit = Math.min(100, Math.max(1, Number.parseInt(searchParams.get('limit') || '20', 10) || 20))
    const result = await adminListUsers(page, limit)
    return NextResponse.json(result)
  } catch (error) {
    return routeError(error, 'Failed to fetch users')
  }
}
