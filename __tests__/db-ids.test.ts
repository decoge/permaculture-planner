/**
 * @jest-environment node
 *
 * Guards lib/db/ids.ts against drift from db/migrations/001_initial.sql.
 *
 * Every helper here feeds a `$n::enum` cast, so a value the Postgres enum lacks
 * fails the whole statement (a 500 on save), and a value the enum has but the
 * helper drops silently rewrites good input. The sets are hand-maintained, so
 * the migration is the source of truth and this test diffs against it.
 *
 * `uuid` is ESM-only and cannot be required under Jest's CommonJS runtime, so
 * `__mocks__/uuid.js` supplies it — that is also why ids.ts itself had no test
 * before this one.
 */
import fs from 'fs'
import path from 'path'
import { describe, expect, test } from '@jest/globals'

import { validate as uuidValidate } from 'uuid'

import {
  asUuid,
  clampHeight,
  currentSeason,
  dateOrNull,
  familyOrOther,
  positiveFeet,
  surfaceOrSoil,
  taskCategory,
  waterOrSpigot,
} from '@/lib/db/ids'

const MIGRATION = fs.readFileSync(
  path.join(process.cwd(), 'db', 'migrations', '001_initial.sql'),
  'utf8'
)

/** Parse `CREATE TYPE name AS ENUM ('a', 'b', ...)` out of the migration. */
function enumValues(type: string): Set<string> {
  const match = new RegExp(`CREATE TYPE ${type} AS ENUM \\(([^)]*)\\)`).exec(MIGRATION)
  if (!match) throw new Error(`enum ${type} not found in the migration`)
  return new Set(Array.from(match[1].matchAll(/'([^']+)'/g), (m) => m[1]))
}

describe('lib/db/ids against the migration enums', () => {
  test('surfaceOrSoil only ever returns a surface_type', () => {
    const allowed = enumValues('surface_type')
    for (const input of [...allowed, 'gravel', '', null, undefined, 42, {}]) {
      const value = surfaceOrSoil(input)
      expect(allowed.has(value)).toBe(true)
    }
    expect(surfaceOrSoil('gravel')).toBe('soil')
    for (const value of allowed) expect(surfaceOrSoil(value)).toBe(value)
  })

  test('waterOrSpigot only ever returns a water_source', () => {
    const allowed = enumValues('water_source')
    for (const input of [...allowed, 'hose', '', null, undefined, 7]) {
      expect(allowed.has(waterOrSpigot(input))).toBe(true)
    }
    expect(waterOrSpigot('hose')).toBe('spigot')
  })

  test('taskCategory only ever returns a task_category, and maintain maps to maint', () => {
    const allowed = enumValues('task_category')
    for (const input of [...allowed, 'maintain', 'mystery', '', null, undefined, 1]) {
      expect(allowed.has(taskCategory(input))).toBe(true)
    }
    expect(taskCategory('maintain')).toBe('maint')
    expect(taskCategory('mystery')).toBe('maint')
  })

  test('familyOrOther only ever returns a plant_family', () => {
    const allowed = enumValues('plant_family')
    for (const input of [...allowed, 'Rosaceae', '', null, undefined, 3]) {
      expect(allowed.has(familyOrOther(input))).toBe(true)
    }
    expect(familyOrOther('Rosaceae')).toBe('Other')
  })

  test('currentSeason is always a season', () => {
    expect(enumValues('season').has(currentSeason())).toBe(true)
  })
})

describe('lib/db/ids numeric helpers', () => {
  test('clampHeight keeps heights inside the bed column range', () => {
    expect(clampHeight(12)).toBe(12)
    expect(clampHeight(0)).toBe(6)
    expect(clampHeight(-5)).toBe(6)
    expect(clampHeight(999)).toBe(48)
    expect(clampHeight(Number.NaN)).toBe(12)
    expect(clampHeight(Number.POSITIVE_INFINITY)).toBe(12)
  })

  test('positiveFeet never returns zero, a negative, or an unbounded figure', () => {
    expect(positiveFeet(0)).toBe(1)
    expect(positiveFeet(-4)).toBe(1)
    expect(positiveFeet(Number.NaN)).toBe(1)
    expect(positiveFeet(2.345)).toBe(2.35)
    expect(positiveFeet(500)).toBe(100)
  })
})

describe('lib/db/ids ids and dates', () => {
  test('a real uuid is kept as-is', () => {
    const uuid = '3f2504e0-4f89-41d3-9a0c-0305e82c3301'
    expect(asUuid(uuid)).toBe(uuid)
  })

  test('the same non-uuid id maps to the same uuid every time', () => {
    // Beds are re-written wholesale on every autosave, so a client id that
    // changed its uuid each save would orphan that bed's plantings.
    expect(asUuid('bed-1')).toBe(asUuid('bed-1'))
    expect(asUuid('bed-1')).not.toBe(asUuid('bed-2'))
    expect(uuidValidate(asUuid('bed-1'))).toBe(true)
  })

  test('an absent id gets a fresh random uuid', () => {
    expect(asUuid()).not.toBe(asUuid())
    expect(asUuid('')).not.toBe(asUuid(''))
  })

  test('dateOrNull accepts a real date and rejects the rest', () => {
    expect(dateOrNull('2026-03-01')).toBe('2026-03-01')
    expect(dateOrNull('2026-03-01T22:30:00Z')).toBe('2026-03-01')
    expect(dateOrNull('not a date')).toBeNull()
    expect(dateOrNull('')).toBeNull()
    expect(dateOrNull(null)).toBeNull()
    expect(dateOrNull(20260301)).toBeNull()
  })
})
