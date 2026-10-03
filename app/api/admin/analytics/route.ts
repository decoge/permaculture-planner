import { NextResponse } from 'next/server'
import { requireUser } from '@/lib/auth/guard'
import { adminContentStats, adminRecentActivity, adminTopUsers, adminUserGrowth, adminUserStats } from '@/lib/db/admin'
import { routeError } from '@/lib/api/route-error'

export async function GET() {
  try {
    const admin = await requireUser()
    if (!admin) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    if (!admin.isAdmin) return NextResponse.json({ error: 'Forbidden: Admin access required' }, { status: 403 })

    const [userStats, contentStats, recentActivity, topUsers, userGrowth] = await Promise.all([
      adminUserStats(),
      adminContentStats(),
      adminRecentActivity(),
      adminTopUsers(),
      adminUserGrowth(),
    ])

    return NextResponse.json({
      userStats,
      contentStats,
      recentActivity,
      topUsers,
      userGrowth,
    })
  } catch (error) {
    return routeError(error, 'Failed to fetch analytics')
  }
}
