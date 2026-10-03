import { NextResponse } from 'next/server'

export async function GET(request: Request) {
  const login = new URL('/auth/login', request.url)
  login.searchParams.set('error', 'Sign in with email and password.')
  return NextResponse.redirect(login)
}
