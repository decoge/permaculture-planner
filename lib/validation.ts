import { z } from 'zod'

// Common validation schemas
export const emailSchema = z.string().email('Invalid email address')
export const passwordSchema = z
  .string()
  .min(8, 'Password must be at least 8 characters')
  .max(200, 'Password must be at most 200 characters')
  .regex(/[A-Z]/, 'Password must contain at least one uppercase letter')
  .regex(/[a-z]/, 'Password must contain at least one lowercase letter')
  .regex(/[0-9]/, 'Password must contain at least one number')

/**
 * Shared password policy for the signup and reset routes.
 *
 * Both routes used to hand-roll a bare `length < 6` check, which meant the
 * complexity rules above were never enforced on real signups -- passwordSchema
 * was only ever exercised by its own unit test. Callers get the first issue
 * message so the route can surface a consistent 400.
 */
export function validatePassword(password: string): { success: true } | { success: false; error: string } {
  const result = passwordSchema.safeParse(password)
  if (result.success) return { success: true }
  return { success: false, error: result.error.issues[0]?.message || 'Invalid password' }
}

/**
 * Shared email check for the auth routes.
 *
 * These routes used to hand-roll `email.includes('@') && email.includes('.')`,
 * which accepts "@example.com", "a b@c.com" and "a@b..com". Any of those could
 * be hashed and stored, and a stored address that merely *looks* like someone
 * else's is the part that actually matters -- it lets one account register a
 * near-copy of another and receive its password reset link.
 *
 * Callers get the same message the schema already uses, so the 400 is
 * consistent across signup, login and forgot-password.
 */
export function validateEmail(email: string): { success: true } | { success: false; error: string } {
  const result = emailSchema.safeParse(email)
  if (result.success) return { success: true }
  return { success: false, error: result.error.issues[0]?.message || 'Invalid email address' }
}

// Location validation
export const locationSchema = z.object({
  lat: z.number().min(-90).max(90).optional(),
  lng: z.number().min(-180).max(180).optional(),
  city: z.string().min(1).max(100).optional(),
  usda_zone: z.string().regex(/^\d{1,2}[ab]?$/).optional(),
  last_frost: z.string().optional(),
  first_frost: z.string().optional()
})

// Area validation
export const areaSchema = z.object({
  total_sqft: z.number().min(1).max(100000),
  usable_fraction: z.number().min(0.1).max(1),
  shape: z.enum(['rectangular', 'L-shaped', 'scattered'])
})

// Surface validation
export const surfaceSchema = z.object({
  type: z.enum(['soil', 'hard']),
  sun_hours: z.number().min(0).max(24),
  slope: z.number().min(0).max(45),
  accessibility_needs: z.boolean()
})

// Water validation
export const waterSchema = z.object({
  source: z.enum(['spigot', 'none', 'rain']),
  drip_allowed: z.boolean(),
  sip_interest: z.boolean()
})

// Crops validation
//
// `avoid_families` is validated against the real CropFamily names, not free
// strings. The rotation engine compares these entries to `crop.family`, so a
// display label like "Solanaceae (nightshades)" never matched any family and
// the user's "avoid" choice was silently dropped.
const cropFamilySchema = z.enum([
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

export const cropsSchema = z.object({
  focus: z.array(z.string()).min(1),
  avoid_families: z.array(cropFamilySchema).optional(),
  time_weekly_minutes: z.number().min(15).max(1440)
})

// Complete wizard data validation
export const wizardDataSchema = z.object({
  location: locationSchema,
  area: areaSchema,
  surface: surfaceSchema,
  water: waterSchema,
  crops: cropsSchema,
  materials: z.object({
    lumber_type: z.enum(['cedar', 'pine', 'treated']).optional(),
    budget_tier: z.enum(['budget', 'standard', 'premium']).optional()
  }),
  template: z.any().optional()
})

// Validation helpers
export function validateData<T>(
  schema: z.ZodSchema<T>,
  data: unknown
): { success: true; data: T } | { success: false; errors: z.ZodError } {
  try {
    const validated = schema.parse(data)
    return { success: true, data: validated }
  } catch (error) {
    if (error instanceof z.ZodError) {
      return { success: false, errors: error }
    }
    throw error
  }
}