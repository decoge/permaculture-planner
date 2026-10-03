/**
 * Environment variable validation and type-safe access.
 * Database and session secrets are required at runtime, not during `next build`.
 */

const requiredEnvVars = ['DATABASE_URL'] as const
const optionalEnvVars = ['SESSION_SECRET', 'NEXT_PUBLIC_APP_URL', 'ADMIN_EMAIL'] as const

type RequiredEnvVar = (typeof requiredEnvVars)[number]
type OptionalEnvVar = (typeof optionalEnvVars)[number]

export function validateEnv() {
  if (process.env.NEXT_PHASE === 'phase-production-build') return

  const missing: string[] = []
  const warnings: string[] = []

  for (const envVar of requiredEnvVars) {
    if (!process.env[envVar]) missing.push(envVar)
  }

  if (process.env.NODE_ENV === 'production' && !process.env.SESSION_SECRET) {
    missing.push('SESSION_SECRET')
  }

  for (const envVar of optionalEnvVars) {
    if (!process.env[envVar]) warnings.push(envVar)
  }

  if (missing.length > 0 && process.env.NODE_ENV === 'production') {
    throw new Error(
      `Missing required environment variables:\n${missing.map((name) => `  - ${name}`).join('\n')}\n\n` +
        'Set DATABASE_URL to a Postgres connection string and SESSION_SECRET to a long random value.'
    )
  }

  if (missing.length > 0 && process.env.NODE_ENV !== 'production') {
    console.warn(
      `Database environment is incomplete:\n${missing.map((name) => `  - ${name}`).join('\n')}\n` +
        'Garden saves and sign-in need DATABASE_URL.'
    )
  }

  if (warnings.length > 0 && process.env.NODE_ENV === 'development') {
    console.warn(
      `Optional environment variables not set:\n${warnings.map((name) => `  - ${name}`).join('\n')}`
    )
  }
}

export function getEnv(key: RequiredEnvVar): string
export function getEnv(key: OptionalEnvVar): string | undefined
export function getEnv(key: RequiredEnvVar | OptionalEnvVar): string | undefined {
  return process.env[key]
}

export function getEnvOrDefault<T extends string>(key: OptionalEnvVar, defaultValue: T): string {
  return process.env[key] || defaultValue
}

export function isProduction() {
  return process.env.NODE_ENV === 'production'
}

export function isDevelopment() {
  return process.env.NODE_ENV === 'development'
}

export function getAppUrl() {
  if (process.env.NEXT_PUBLIC_APP_URL) {
    return process.env.NEXT_PUBLIC_APP_URL
  }

  if (!isProduction()) {
    return 'http://localhost:3000'
  }

  throw new Error('NEXT_PUBLIC_APP_URL must be set in production')
}
