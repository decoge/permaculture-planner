'use client'

import { useState } from 'react'
import { z } from 'zod'
import { validateData } from '@/lib/validation'

/**
 * Form validation hook.
 *
 * Lives apart from lib/validation.ts because that module is imported by API
 * routes, which are server components -- a `useState` import anywhere in its
 * module graph makes `next build` fail. Keep the schemas and pure helpers
 * framework-agnostic; put hooks that touch React here.
 */
export function useFormValidation<T>(schema: z.ZodSchema<T>) {
  const [errors, setErrors] = useState<Record<string, string>>({})

  const validate = (data: unknown): data is T => {
    const result = validateData(schema, data)
    if (result.success) {
      setErrors({})
      return true
    } else {
      const newErrors: Record<string, string> = {}
      result.errors.issues.forEach(error => {
        const path = error.path.join('.')
        newErrors[path] = error.message
      })
      setErrors(newErrors)
      return false
    }
  }

  const validateField = (field: string, value: unknown) => {
    try {
      // For object schemas, try to parse just the field
      if (schema instanceof z.ZodObject) {
        const fieldSchema = (schema as any).shape[field]
        if (fieldSchema) {
          fieldSchema.parse(value)
          setErrors(prev => {
            const newErrors = { ...prev }
            delete newErrors[field]
            return newErrors
          })
        }
      }
    } catch (error) {
      if (error instanceof z.ZodError) {
        setErrors(prev => ({
          ...prev,
          [field]: error.issues[0].message
        }))
      }
    }
  }

  const clearErrors = () => setErrors({})

  return { errors, validate, validateField, clearErrors }
}