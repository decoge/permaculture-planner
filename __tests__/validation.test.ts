import { describe, expect, test } from '@jest/globals'
import {
  emailSchema,
  passwordSchema,
  locationSchema,
  areaSchema,
  cropsSchema,
  wizardDataSchema,
  validateData
} from '@/lib/validation'

describe('Validation Schemas', () => {
  describe('emailSchema', () => {
    test('validates correct email format', () => {
      expect(emailSchema.parse('user@example.com')).toBe('user@example.com')
      expect(emailSchema.parse('test.user+tag@domain.co.uk')).toBe('test.user+tag@domain.co.uk')
    })

    test('rejects invalid email format', () => {
      expect(() => emailSchema.parse('invalid')).toThrow()
      expect(() => emailSchema.parse('@example.com')).toThrow()
      expect(() => emailSchema.parse('user@')).toThrow()
    })
  })

  describe('passwordSchema', () => {
    test('validates strong passwords', () => {
      expect(passwordSchema.parse('StrongP@ss123')).toBe('StrongP@ss123')
      expect(passwordSchema.parse('MySecure2024')).toBe('MySecure2024')
    })

    test('rejects weak passwords', () => {
      expect(() => passwordSchema.parse('short')).toThrow() // Too short
      expect(() => passwordSchema.parse('lowercase123')).toThrow() // No uppercase
      expect(() => passwordSchema.parse('UPPERCASE123')).toThrow() // No lowercase
      expect(() => passwordSchema.parse('NoNumbers')).toThrow() // No numbers
    })
  })

  describe('locationSchema', () => {
    test('validates location data', () => {
      const valid = {
        lat: 47.6062,
        lng: -122.3321,
        city: 'Seattle',
        usda_zone: '8b',
        last_frost: '2024-03-15',
        first_frost: '2024-11-15'
      }
      expect(locationSchema.parse(valid)).toEqual(valid)
    })

    test('validates USDA zones', () => {
      expect(locationSchema.parse({ usda_zone: '5a' })).toHaveProperty('usda_zone', '5a')
      expect(locationSchema.parse({ usda_zone: '10b' })).toHaveProperty('usda_zone', '10b')
      expect(locationSchema.parse({ usda_zone: '7' })).toHaveProperty('usda_zone', '7')
    })

    test('rejects invalid coordinates', () => {
      expect(() => locationSchema.parse({ lat: 91 })).toThrow()
      expect(() => locationSchema.parse({ lng: -181 })).toThrow()
    })
  })

  describe('cropsSchema', () => {
    test('rejects an unknown plant family in avoid_families', () => {
      // The wizard used to store display labels ("Solanaceae (nightshades)"),
      // which the rotation engine could never match against a crop family.
      expect(() =>
        cropsSchema.parse({
          focus: ['tomato'],
          avoid_families: ['Solanaceae (nightshades)'],
          time_weekly_minutes: 120
        })
      ).toThrow()
    })

    test('accepts bare family names in avoid_families', () => {
      const parsed = cropsSchema.parse({
        focus: ['tomato'],
        avoid_families: ['Solanaceae', 'Allium'],
        time_weekly_minutes: 120
      })
      expect(parsed.avoid_families).toEqual(['Solanaceae', 'Allium'])
    })
  })

  describe('wizardDataSchema', () => {
    test('rejects a wizard payload with no area', () => {
      expect(() =>
        wizardDataSchema.parse({
          location: {},
          surface: { type: 'soil', sun_hours: 8, slope: 2, accessibility_needs: false },
          water: { source: 'spigot', drip_allowed: true, sip_interest: false },
          crops: { focus: ['tomato'], time_weekly_minutes: 120 },
          materials: {}
        })
      ).toThrow()
    })
  })

  describe('areaSchema', () => {
    test('validates area configuration', () => {
      const valid = {
        total_sqft: 500,
        usable_fraction: 0.8,
        shape: 'rectangular' as const
      }
      expect(areaSchema.parse(valid)).toEqual(valid)
    })

    test('validates shape options', () => {
      expect(areaSchema.parse({
        total_sqft: 100,
        usable_fraction: 0.5,
        shape: 'L-shaped' as const
      })).toHaveProperty('shape', 'L-shaped')
    })

    test('rejects invalid values', () => {
      expect(() => areaSchema.parse({
        total_sqft: 0,
        usable_fraction: 0.5,
        shape: 'rectangular'
      })).toThrow()

      expect(() => areaSchema.parse({
        total_sqft: 100,
        usable_fraction: 1.1,
        shape: 'rectangular'
      })).toThrow()
    })
  })
})

describe('Validation Helpers', () => {
  describe('validateData', () => {
    test('returns success for valid data', () => {
      const result = validateData(emailSchema, 'test@example.com')
      expect(result.success).toBe(true)
      if (result.success) {
        expect(result.data).toBe('test@example.com')
      }
    })

    test('returns error for invalid data', () => {
      const result = validateData(emailSchema, 'invalid-email')
      expect(result.success).toBe(false)
      if (!result.success) {
        expect(result.errors.issues).toBeDefined()
        expect(result.errors.issues.length).toBeGreaterThan(0)
      }
    })
  })
})