import { query, queryOne } from '@/lib/db/pool'

export async function adminUserStats() {
  return queryOne(
    `SELECT
       COUNT(*)::int AS total_users,
       COUNT(*) FILTER (WHERE created_at > NOW() - INTERVAL '7 days')::int AS users_last_7_days,
       COUNT(*) FILTER (WHERE created_at > NOW() - INTERVAL '30 days')::int AS users_last_30_days
     FROM users`
  )
}

export async function adminContentStats() {
  return queryOne(
    `SELECT
       (SELECT COUNT(*)::int FROM sites) AS total_sites,
       (SELECT COUNT(*)::int FROM plans) AS total_plans,
       (SELECT COUNT(*)::int FROM beds) AS total_beds,
       (SELECT COUNT(*)::int FROM plantings) AS total_plantings,
       (SELECT COUNT(*)::int FROM tasks) AS total_tasks,
       (SELECT COUNT(*)::int FROM journal_entries) AS total_journal_entries,
       (SELECT COUNT(*)::int FROM harvests) AS total_harvests`
  )
}

export async function adminRecentActivity() {
  return query(
    `SELECT activity_type, user_id, email, timestamp, entity_id
     FROM (
       SELECT 'user_signup' AS activity_type, id AS user_id, email,
              created_at AS timestamp, NULL::uuid AS entity_id
       FROM users
       UNION ALL
       SELECT 'site_created', s.user_id, u.email, s.created_at, s.id
       FROM sites s
       JOIN users u ON u.id = s.user_id
       UNION ALL
       SELECT 'plan_created', s.user_id, u.email, p.created_at, p.id
       FROM plans p
       JOIN sites s ON s.id = p.site_id
       JOIN users u ON u.id = s.user_id
     ) activity
     ORDER BY timestamp DESC
     LIMIT 50`
  )
}

export async function adminUserGrowth() {
  const rows = await query<{ date: Date | string; count: number }>(
    `SELECT created_at::date AS date, COUNT(*)::int AS count
     FROM users
     WHERE created_at >= NOW() - INTERVAL '30 days'
     GROUP BY 1
     ORDER BY 1`
  )
  return rows.map((row) => ({
    date: typeof row.date === 'string' ? row.date.slice(0, 10) : row.date.toISOString().slice(0, 10),
    count: row.count,
  }))
}

export async function adminTopUsers() {
  return query(
    `SELECT u.id, u.email, u.full_name,
            COUNT(DISTINCT s.id)::int AS sites,
            COUNT(DISTINCT p.id)::int AS plans
     FROM users u
     LEFT JOIN sites s ON s.user_id = u.id
     LEFT JOIN plans p ON p.site_id = s.id
     GROUP BY u.id
     ORDER BY plans DESC, sites DESC
     LIMIT 10`
  )
}

export async function adminListUsers(page: number, limit: number) {
  const offset = (page - 1) * limit
  const totalRow = await queryOne<{ total: number }>('SELECT COUNT(*)::int AS total FROM users')
  const users = await query(
    `SELECT u.id, u.email, u.full_name, u.created_at, u.updated_at, u.is_admin,
            (SELECT COUNT(*)::int FROM sites s WHERE s.user_id = u.id) AS sites,
            (SELECT COUNT(*)::int FROM plans p JOIN sites s ON s.id = p.site_id WHERE s.user_id = u.id) AS plans,
            (SELECT COUNT(*)::int FROM beds b
              JOIN plans p ON p.id = b.plan_id
              JOIN sites s ON s.id = p.site_id
              WHERE s.user_id = u.id) AS beds,
            (SELECT COUNT(*)::int FROM plantings pl
              JOIN beds b ON b.id = pl.bed_id
              JOIN plans p ON p.id = b.plan_id
              JOIN sites s ON s.id = p.site_id
              WHERE s.user_id = u.id) AS plantings,
            (SELECT COUNT(*)::int FROM journal_entries j WHERE j.user_id = u.id) AS journal_entries
     FROM users u
     ORDER BY u.created_at DESC
     LIMIT $1 OFFSET $2`,
    [limit, offset]
  )

  return {
    users: users.map((user) => ({
      id: user.id,
      email: user.email,
      full_name: user.full_name,
      created_at: user.created_at,
      updated_at: user.updated_at,
      is_admin: user.is_admin,
      stats: {
        sites: user.sites,
        plans: user.plans,
        beds: user.beds,
        plantings: user.plantings,
        journalEntries: user.journal_entries,
      },
    })),
    pagination: {
      page,
      limit,
      total: totalRow?.total || 0,
      totalPages: Math.ceil((totalRow?.total || 0) / limit),
    },
  }
}
