// Rate limiting implementation for API routes
import { NextRequest, NextResponse } from 'next/server'

interface RateLimitConfig {
  windowMs: number // Time window in milliseconds
  maxRequests: number // Maximum requests per window
  skipSuccessfulRequests?: boolean // Don't count successful requests
  skipFailedRequests?: boolean // Don't count failed requests
  keyGenerator?: (req: NextRequest) => string // Custom key generator
  handler?: (req: NextRequest) => NextResponse // Custom rate limit handler
  message?: string // Custom error message
}

interface RateLimitStore {
  hits: number
  resetTime: number
}

class RateLimiter {
  private store: Map<string, RateLimitStore> = new Map()
  private cleanupInterval: NodeJS.Timeout | null = null

  constructor(private config: RateLimitConfig) {
    // Start cleanup interval to remove expired entries
    this.startCleanup()
  }

  private startCleanup() {
    if (this.cleanupInterval) return

    this.cleanupInterval = setInterval(() => {
      const now = Date.now()
      const entries = Array.from(this.store.entries())
      for (const [key, value] of entries) {
        if (value.resetTime <= now) {
          this.store.delete(key)
        }
      }
    }, this.config.windowMs)

    // unref() so this timer never holds the process open. Without it every Jest
    // suite that imports this module hangs until the worker is force-exited --
    // the same problem the response-cache sweeper had.
    if (typeof this.cleanupInterval.unref === 'function') this.cleanupInterval.unref()
  }

  private getKey(req: NextRequest): string {
    if (this.config.keyGenerator) {
      return this.config.keyGenerator(req)
    }

    // Default key generator uses IP address + pathname. Same rule as clientIp:
    // the rightmost x-forwarded-for entry, not the client-controlled first one.
    return `${clientIp(req)}:${new URL(req.url).pathname}`
  }

  async check(req: NextRequest): Promise<NextResponse | null> {
    const key = this.getKey(req)
    const now = Date.now()

    let record = this.store.get(key)

    if (!record || record.resetTime <= now) {
      // Create new record or reset expired one
      record = {
        hits: 1,
        resetTime: now + this.config.windowMs
      }
      this.store.set(key, record)
      return null // Allow request
    }

    // Increment hit count
    record.hits++

    if (record.hits > this.config.maxRequests) {
      // Rate limit exceeded
      if (this.config.handler) {
        return this.config.handler(req)
      }

      return NextResponse.json(
        {
          error: this.config.message || 'Too many requests, please try again later',
          retryAfter: Math.ceil((record.resetTime - now) / 1000)
        },
        {
          status: 429,
          headers: {
            'Retry-After': String(Math.ceil((record.resetTime - now) / 1000)),
            'X-RateLimit-Limit': String(this.config.maxRequests),
            'X-RateLimit-Remaining': '0',
            'X-RateLimit-Reset': new Date(record.resetTime).toISOString()
          }
        }
      )
    }

    // Update store
    this.store.set(key, record)
    return null // Allow request
  }

  reset(key?: string) {
    if (key) {
      this.store.delete(key)
    } else {
      this.store.clear()
    }
  }

  destroy() {
    if (this.cleanupInterval) {
      clearInterval(this.cleanupInterval)
      this.cleanupInterval = null
    }
    this.store.clear()
  }
}

// Rate limiter instances for different endpoints
const limiters = new Map<string, RateLimiter>()

// Factory function to create or get rate limiter
export function createRateLimiter(
  name: string,
  config: RateLimitConfig
): RateLimiter {
  let limiter = limiters.get(name)

  if (!limiter) {
    limiter = new RateLimiter(config)
    limiters.set(name, limiter)
  }

  return limiter
}

// Middleware factory for common rate limiting scenarios
export const rateLimitPresets = {
  // Strict rate limiting for authentication endpoints
  auth: {
    windowMs: 15 * 60 * 1000, // 15 minutes
    maxRequests: 5, // 5 attempts per 15 minutes
    message: 'Too many authentication attempts, please try again later'
  },

  // Standard rate limiting for API endpoints
  api: {
    windowMs: 60 * 1000, // 1 minute
    maxRequests: 30, // 30 requests per minute
    message: 'API rate limit exceeded, please slow down'
  },

  // Lenient rate limiting for read operations
  read: {
    windowMs: 60 * 1000, // 1 minute
    maxRequests: 100, // 100 requests per minute
    message: 'Too many requests, please try again shortly'
  },

  // Strict rate limiting for write operations
  write: {
    windowMs: 60 * 1000, // 1 minute
    maxRequests: 10, // 10 requests per minute
    message: 'Too many write operations, please wait before trying again'
  },

  // AI generation endpoints (expensive operations)
  ai: {
    windowMs: 5 * 60 * 1000, // 5 minutes
    maxRequests: 5, // 5 requests per 5 minutes
    message: 'AI generation limit reached, please wait a few minutes'
  }
}

/**
 * Client IP for rate-limit keys.
 *
 * `x-forwarded-for` is a comma-separated list that proxies append to, so the
 * *last* entry is the one the outermost trusted proxy observed. The previous
 * code read index 0, which is whatever the client put there -- meaning a caller
 * could send a fresh value on every request and get an unlimited supply of
 * rate-limit buckets, defeating the limiter entirely.
 *
 * Read from the right, and cap the value's length so it cannot be used as an
 * unbounded map key.
 */
export function clientIp(req: NextRequest): string {
  const forwarded = req.headers.get('x-forwarded-for')
  const fromRight = forwarded?.split(',').pop()?.trim()
  if (fromRight) return fromRight.slice(0, 64)
  const real = req.headers.get('x-real-ip')?.trim()
  if (real) return real.slice(0, 64)
  return 'unknown'
}

// IP-based rate limiter for DDoS protection
export function createIPRateLimiter() {
  return createRateLimiter('ip-limiter', {
    windowMs: 60 * 1000, // 1 minute
    maxRequests: 100, // 100 requests per minute per IP
    keyGenerator: clientIp,
    message: 'Too many requests from this IP address'
  })
}
