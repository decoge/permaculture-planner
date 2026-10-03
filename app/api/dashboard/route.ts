import { NextResponse } from 'next/server'
import { requireUser } from '@/lib/auth/guard'
import { listDashboardPlans } from '@/lib/db/gardens'
import { routeError } from '@/lib/api/route-error'

export async function GET() {
  try {
    const user = await requireUser()
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    const plans = await listDashboardPlans(user.id)
    return NextResponse.json({
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
        is_admin: user.isAdmin,
      },
      plans,
    })
  } catch (error) {
    return routeError(error, 'Failed to load dashboard')
  }
}
