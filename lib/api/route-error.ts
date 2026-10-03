import { NextResponse } from 'next/server'

export function routeError(error: unknown, fallback: string) {
  const status =
    error && typeof error === 'object' && 'status' in error && typeof (error as { status: unknown }).status === 'number'
      ? (error as { status: number }).status
      : 500
  if (status >= 500) console.error(error)
  const message = status >= 500 ? fallback : error instanceof Error ? error.message : fallback
  return NextResponse.json({ error: message }, { status })
}
