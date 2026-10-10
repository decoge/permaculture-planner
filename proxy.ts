import { NextResponse, type NextRequest } from 'next/server'
import { createRateLimiter, rateLimitPresets, createIPRateLimiter } from '@/lib/api/rate-limiter'
import { createCache, cachePresets } from '@/lib/api/cache'
import { SESSION_COOKIE, verifySessionToken } from '@/lib/auth/token'

const ipRateLimiter = createIPRateLimiter()
const authRateLimiter = createRateLimiter('auth', rateLimitPresets.auth)
const apiRateLimiter = createRateLimiter('api', rateLimitPresets.api)
const aiRateLimiter = createRateLimiter('ai', rateLimitPresets.ai)

const apiCache = createCache(cachePresets.medium)
const userCache = createCache(cachePresets.user)

const protectedPages = ['/dashboard', '/plans', '/editor', '/settings', '/admin']

// Local dev and the E2E suite hammer the API far past any sane cap (112+ page
// loads in two minutes from one browser), and the limiter's per-IP buckets can't
// tell a test run from an attacker. Production never sees a localhost Host
// header, so the exemption is gated on both.
function rateLimitingExempt(request: NextRequest): boolean {
  if (process.env.NODE_ENV === 'production') return false
  const host = request.headers.get('host') ?? ''
  return host.startsWith('localhost') || host.startsWith('127.0.0.1')
}

export async function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl

  let response = NextResponse.next({
    request: {
      headers: request.headers,
    },
  })

  const exempt = rateLimitingExempt(request)
  const ipLimitResponse = exempt ? null : await ipRateLimiter.check(request)
  if (ipLimitResponse) return ipLimitResponse

  if (
    pathname.startsWith('/api/auth') &&
    pathname !== '/api/auth/me' &&
    pathname !== '/api/auth/logout'
  ) {
    const authLimitResponse = exempt ? null : await authRateLimiter.check(request)
    if (authLimitResponse) return authLimitResponse
  }

  if (pathname.startsWith('/api/generate') || pathname.startsWith('/api/ai')) {
    const aiLimitResponse = exempt ? null : await aiRateLimiter.check(request)
    if (aiLimitResponse) return aiLimitResponse
  }

  if (pathname.startsWith('/api')) {
    const apiLimitResponse = exempt ? null : await apiRateLimiter.check(request)
    if (apiLimitResponse) return apiLimitResponse

    if (request.method === 'GET') {
      const isUserEndpoint = pathname.includes('/user/') || pathname.includes('/profile/')
      const cache = isUserEndpoint ? userCache : apiCache
      const cachedResponse = await cache.get(request)
      if (cachedResponse) return cachedResponse
    }
  }

  const token = request.cookies.get(SESSION_COOKIE)?.value
  const session = token ? await verifySessionToken(token) : null

  const needsAuth = protectedPages.some((path) => pathname.startsWith(path))
  if (!session && needsAuth) {
    if (pathname.startsWith('/api/')) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }
    const redirectUrl = new URL('/auth/login', request.url)
    redirectUrl.searchParams.set('redirectTo', pathname)
    return NextResponse.redirect(redirectUrl)
  }

  if (pathname.startsWith('/admin') || pathname.startsWith('/api/admin')) {
    if (!session) {
      const redirectUrl = new URL('/auth/login', request.url)
      redirectUrl.searchParams.set('redirectTo', pathname)
      return NextResponse.redirect(redirectUrl)
    }
    if (!session.isAdmin) {
      if (pathname.startsWith('/api/')) {
        return NextResponse.json({ error: 'Forbidden: Admin access required' }, { status: 403 })
      }
      return NextResponse.redirect(new URL('/dashboard', request.url))
    }
  }

  if (session && (pathname === '/auth/login' || pathname === '/auth/signup')) {
    return NextResponse.redirect(new URL('/dashboard', request.url))
  }

  response.headers.set('X-Content-Type-Options', 'nosniff')
  response.headers.set('X-Frame-Options', 'DENY')
  response.headers.set('X-XSS-Protection', '1; mode=block')
  response.headers.set('Referrer-Policy', 'strict-origin-when-cross-origin')

  if (pathname.startsWith('/api')) {
    const limits = pathname.startsWith('/api/auth')
      ? rateLimitPresets.auth
      : pathname.startsWith('/api/ai')
        ? rateLimitPresets.ai
        : rateLimitPresets.api

    response.headers.set('X-RateLimit-Limit', String(limits.maxRequests))
    response.headers.set('X-RateLimit-Window', String(limits.windowMs / 1000) + 's')
  }

  if (pathname.startsWith('/api')) {
    const origin = request.headers.get('origin')
    const allowedOrigins = [
      'http://localhost:3000',
      'http://localhost:3001',
      'https://permaculture-planner.vercel.app',
    ]

    if (origin && allowedOrigins.includes(origin)) {
      response.headers.set('Access-Control-Allow-Origin', origin)
      response.headers.set('Access-Control-Allow-Credentials', 'true')
      response.headers.set('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS')
      response.headers.set('Access-Control-Allow-Headers', 'Content-Type, Authorization')
    }
  }

  return response
}

export const config = {
  matcher: [
    '/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)',
  ],
}
