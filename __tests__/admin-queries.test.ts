/**
 * @jest-environment node
 *
 * lib/db/admin is imported dynamically after jest.mock registers the pool mock.
 */
import { beforeEach, describe, expect, jest, test } from '@jest/globals'

const query = jest.fn<(sql: string, params?: unknown[]) => Promise<unknown[]>>()
const queryOne = jest.fn<(sql: string, params?: unknown[]) => Promise<unknown>>()

jest.mock('@/lib/db/pool', () => ({
  query: (sql: string, params?: unknown[]) => query(sql, params),
  queryOne: (sql: string, params?: unknown[]) => queryOne(sql, params),
  withTransaction: jest.fn(),
}))

let admin: typeof import('@/lib/db/admin')

beforeEach(async () => {
  query.mockReset()
  queryOne.mockReset()
  query.mockResolvedValue([])
  queryOne.mockResolvedValue(null)
  admin = await import('@/lib/db/admin')
})

describe('adminRecentActivity bounds each branch before the union', () => {
  test('limits inside every branch, not just on the combined result', async () => {
    await admin.adminRecentActivity()

    const sql = query.mock.calls[0][0] as string

    // Three branches (users, sites, plans). Each must carry its own LIMIT;
    // a single trailing LIMIT still materialises the union of all three tables.
    const limits = sql.match(/LIMIT/gi) || []
    expect(limits).toHaveLength(4)

    // Each branch is wrapped in its own subquery, which is what makes a
    // per-branch ORDER BY ... LIMIT legal inside a UNION ALL.
    expect(sql.match(/SELECT \* FROM \(/gi)).toHaveLength(3)
    expect(sql).toContain('UNION ALL')
  })

  test('still returns the newest rows overall', async () => {
    query.mockResolvedValue([
      {
        activity_type: 'plan_created',
        user_id: 'u1',
        email: 'a@b.com',
        timestamp: '2026-03-01',
        entity_id: 'p1',
      },
    ])

    const result = await admin.adminRecentActivity()

    expect(result).toHaveLength(1)
    // The outer ORDER BY/LIMIT is retained, so ordering across branches is
    // still done by the database.
    const sql = (query.mock.calls[0][0] as string).trimEnd()
    expect(sql.endsWith('LIMIT 50')).toBe(true)
    // ...and it is the outer one, i.e. the last LIMIT in the statement.
    expect(sql.lastIndexOf('LIMIT')).toBeGreaterThan(sql.indexOf(') activity'))
  })
})

describe('adminTopUsers does not fan out users x sites x plans', () => {
  test('counts sites and plans in independent subqueries', async () => {
    await admin.adminTopUsers()

    const sql = query.mock.calls[0][0] as string

    // The old query joined users to sites and plans and undid the product with
    // COUNT(DISTINCT ...). No join and no DISTINCT means nothing to collapse.
    expect(sql).not.toMatch(/\bLEFT JOIN\b/i)
    expect(sql).not.toMatch(/\bGROUP BY\b/i)
    expect(sql).not.toMatch(/COUNT\(DISTINCT/i)

    expect(sql).toContain('SELECT COUNT(*)::int FROM sites s WHERE s.user_id = u.id')
    expect(sql).toContain('SELECT COUNT(*)::int FROM plans p')
    expect(sql).toContain('LIMIT 10')
  })

  test('orders by the computed counts', async () => {
    await admin.adminTopUsers()
    const sql = query.mock.calls[0][0] as string
    expect(sql).toContain('ORDER BY plans DESC, sites DESC')
  })
})

describe('adminListUsers pagination', () => {
  test('reports total pages from the real row count', async () => {
    queryOne.mockResolvedValue({ total: 95 })
    query.mockResolvedValue([])

    const result = await admin.adminListUsers(2, 20)

    expect(result.pagination).toEqual({ page: 2, limit: 20, total: 95, totalPages: 5 })
  })

  test('handles no users without dividing by zero', async () => {
    queryOne.mockResolvedValue({ total: 0 })

    const result = await admin.adminListUsers(1, 20)

    expect(result.pagination.totalPages).toBe(0)
    expect(result.users).toEqual([])
  })
})
