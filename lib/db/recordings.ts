import { query, queryOne } from '@/lib/db/pool'
import { taskCategory } from '@/lib/db/ids'
import { userOwnsPlan } from '@/lib/db/gardens'

/**
 * Recording writes for the data the plan page already reads: harvests and
 * journal entries. Until now both were read-only -- getPlanDetail joined them
 * and the facts panels reported "No harvests are recorded" forever, because no
 * route or UI could create one.
 *
 * Every function verifies plan ownership first; ownership is enforced here, in
 * the query, not by the database.
 */

const MAX_QUANTITY = 1_000_000
const MAX_TEXT_LENGTH = 2000
const MAX_TITLE_LENGTH = 200

/** A planting the caller may attach a harvest to: any planting on their plan. */
async function plantingOnOwnedPlan(
  userId: string,
  plantingId: string
): Promise<boolean> {
  const row = await queryOne<{ id: string }>(
    `SELECT pl.id
     FROM plantings pl
     JOIN beds b ON b.id = pl.bed_id
     JOIN plans p ON p.id = b.plan_id
     JOIN sites s ON s.id = p.site_id
     WHERE pl.id = $1 AND s.user_id = $2`,
    [plantingId, userId]
  )
  return Boolean(row)
}

export interface CreateHarvestInput {
  plantingId: string
  harvestedOn: string
  quantity?: number | null
  unit?: string | null
  notes?: string | null
}

export async function createHarvest(
  userId: string,
  input: CreateHarvestInput
): Promise<{ id: string } | null> {
  // Validate the date before any database work so a malformed payload cannot
  // trigger the ownership probe.
  const harvestedOn = /^\d{4}-\d{2}-\d{2}$/.test(input.harvestedOn || '') ? input.harvestedOn : null
  if (!input.plantingId || !harvestedOn) return null

  if (!(await plantingOnOwnedPlan(userId, input.plantingId))) {
    return null
  }

  const quantity =
    typeof input.quantity === 'number' && Number.isFinite(input.quantity) && input.quantity > 0
      ? Math.min(input.quantity, MAX_QUANTITY)
      : null
  const unit = typeof input.unit === 'string' && input.unit.trim() ? input.unit.trim().slice(0, 50) : null
  const notes = typeof input.notes === 'string' && input.notes.trim() ? input.notes.trim().slice(0, MAX_TEXT_LENGTH) : null

  return queryOne<{ id: string }>(
    `INSERT INTO harvests (planting_id, harvested_on, quantity, unit, notes)
     VALUES ($1, $2, $3, $4, $5)
     RETURNING id`,
    [input.plantingId, harvestedOn, quantity, unit, notes]
  )
}

export async function deleteHarvest(userId: string, harvestId: string): Promise<boolean> {
  const deleted = await query(
    `DELETE FROM harvests h
     USING plantings pl, beds b, plans p, sites s
     WHERE h.id = $1 AND h.planting_id = pl.id AND pl.bed_id = b.id
       AND b.plan_id = p.id AND p.site_id = s.id AND s.user_id = $2
     RETURNING h.id`,
    [harvestId, userId]
  )
  return deleted.length > 0
}

export interface CreateJournalInput {
  title?: string | null
  content: string
  tags?: string[] | null
}

export async function createJournalEntry(
  userId: string,
  planId: string,
  input: CreateJournalInput
): Promise<{ id: string } | null> {
  if (!(await userOwnsPlan(userId, planId))) return null

  const content = typeof input.content === 'string' ? input.content.trim() : ''
  if (!content) return null

  const title = typeof input.title === 'string' && input.title.trim() ? input.title.trim().slice(0, MAX_TITLE_LENGTH) : null
  const tags = Array.isArray(input.tags)
    ? input.tags.filter((tag): tag is string => typeof tag === 'string' && tag.trim() !== '').slice(0, 20)
    : null

  return queryOne<{ id: string }>(
    `INSERT INTO journal_entries (plan_id, user_id, title, content, tags)
     VALUES ($1, $2, $3, $4, $5)
     RETURNING id`,
    [planId, userId, title, content.slice(0, MAX_TEXT_LENGTH), tags]
  )
}

export async function deleteJournalEntry(userId: string, entryId: string): Promise<boolean> {
  // plan_id ownership plus user_id: both columns exist on this table.
  const deleted = await query(
    `DELETE FROM journal_entries j
     USING plans p, sites s
     WHERE j.id = $1 AND j.plan_id = p.id AND p.site_id = s.id
       AND s.user_id = $2 AND j.user_id = $2
     RETURNING j.id`,
    [entryId, userId]
  )
  return deleted.length > 0
}

export async function createTask(
  userId: string,
  planId: string,
  input: { title: string; dueOn: string; category?: string; description?: string | null }
): Promise<{ id: string } | null> {
  if (!(await userOwnsPlan(userId, planId))) return null

  const title = typeof input.title === 'string' ? input.title.trim().slice(0, MAX_TITLE_LENGTH) : ''
  if (!title) return null

  const dueOn = /^\d{4}-\d{2}-\d{2}$/.test(input.dueOn || '') ? input.dueOn : null
  if (!dueOn) return null

  const description =
    typeof input.description === 'string' && input.description.trim() ? input.description.trim().slice(0, MAX_TEXT_LENGTH) : null

  // taskCategory maps unknown categories to 'maint' the same way the sync
  // route does, so the enum cast below can never fail the transaction.
  return queryOne<{ id: string }>(
    `INSERT INTO tasks (plan_id, title, description, category, due_on, completed)
     SELECT p.id, $3, $4, $6::task_category, $5::date, false
     FROM plans p JOIN sites s ON s.id = p.site_id
     WHERE p.id = $1 AND s.user_id = $2
     RETURNING id`,
    [planId, userId, title, description, dueOn, taskCategory(input.category)]
  )
}

export async function deleteTask(userId: string, taskId: string): Promise<boolean> {
  const deleted = await query(
    `DELETE FROM tasks t
     USING plans p, sites s
     WHERE t.id = $1 AND t.plan_id = p.id AND p.site_id = s.id AND s.user_id = $2
     RETURNING t.id`,
    [taskId, userId]
  )
  return deleted.length > 0
}

/**
 * Set (or clear, with null) a task's recurrence pattern.
 *
 * The pattern is stored verbatim for display, but only the known values in
 * tasks.ts's RECURRENCE_DAYS generate a next occurrence on completion.
 */
export async function setTaskPattern(
  userId: string,
  taskId: string,
  pattern: string | null
): Promise<boolean> {
  const value = typeof pattern === 'string' && pattern.trim() ? pattern.trim().slice(0, 50) : null
  const updated = await query(
    `UPDATE tasks t
     SET recurring_pattern = $3
     FROM plans p, sites s
     WHERE t.id = $1 AND t.plan_id = p.id AND p.site_id = s.id AND s.user_id = $2
     RETURNING t.id`,
    [taskId, userId, value]
  )
  return updated.length > 0
}
