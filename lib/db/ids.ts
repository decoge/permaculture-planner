import { randomUUID } from 'crypto'
import { v5 as uuidv5, validate as uuidValidate } from 'uuid'

const NAMESPACE = '8c2e1a4e-6b3d-4f1a-9c7e-2d5a6b8c0e11'

const FAMILIES = new Set([
  'Solanaceae',
  'Brassicaceae',
  'Cucurbitaceae',
  'Fabaceae',
  'Allium',
  'Apiaceae',
  'Asteraceae',
  'Amaranthaceae',
  'Poaceae',
  'Other',
])

const SURFACES = new Set(['soil', 'hard', 'rooftop', 'concrete'])
const WATER = new Set(['spigot', 'rain', 'none', 'drip'])
const TASK_CATEGORIES = new Set([
  'build',
  'plant',
  'maintain',
  'harvest',
  'water',
  'fertilize',
  'cover',
  'maint',
])

export function asUuid(id?: string | null): string {
  if (id && uuidValidate(id)) return id
  if (id && id.length > 0) return uuidv5(id, NAMESPACE)
  return randomUUID()
}

export function positiveFeet(value: number): number {
  if (!Number.isFinite(value) || value <= 0) return 1
  return Math.min(100, Math.round(value * 100) / 100)
}

export function clampHeight(value: number): number {
  if (!Number.isFinite(value)) return 12
  return Math.min(48, Math.max(6, value))
}

export function familyOrOther(value: unknown): string {
  return typeof value === 'string' && FAMILIES.has(value) ? value : 'Other'
}

export function surfaceOrSoil(value: unknown): string {
  return typeof value === 'string' && SURFACES.has(value) ? value : 'soil'
}

export function waterOrSpigot(value: unknown): string {
  return typeof value === 'string' && WATER.has(value) ? value : 'spigot'
}

export function taskCategory(value: unknown): string {
  if (value === 'maintain') return 'maint'
  return typeof value === 'string' && TASK_CATEGORIES.has(value) ? value : 'maint'
}

export function currentSeason(): 'spring' | 'summer' | 'fall' | 'winter' {
  const month = new Date().getMonth()
  if (month >= 2 && month <= 4) return 'spring'
  if (month >= 5 && month <= 7) return 'summer'
  if (month >= 8 && month <= 10) return 'fall'
  return 'winter'
}

export function dateOrNull(value: unknown): string | null {
  if (typeof value !== 'string' || value.length === 0) return null
  const parsed = new Date(value)
  if (Number.isNaN(parsed.getTime())) return null
  return parsed.toISOString().slice(0, 10)
}
