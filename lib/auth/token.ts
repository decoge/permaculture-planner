export const SESSION_COOKIE = 'pp_session'
export const sessionMaxAgeSeconds = 60 * 60 * 24 * 14

export interface SessionPayload {
  sub: string
  email: string
  name: string | null
  isAdmin: boolean
  tokenVersion: number
  exp: number
}

const encoder = new TextEncoder()

export function getSessionSecret(): string | null {
  if (process.env.SESSION_SECRET) return process.env.SESSION_SECRET
  if (process.env.NODE_ENV === 'production') return null
  return 'dev-only-session-secret'
}

function bytesToBase64Url(bytes: Uint8Array): string {
  let binary = ''
  for (let index = 0; index < bytes.length; index += 1) {
    binary += String.fromCharCode(bytes[index])
  }
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/g, '')
}

function base64UrlToString(value: string): string {
  const padded = value.replace(/-/g, '+').replace(/_/g, '/') + '='.repeat((4 - (value.length % 4)) % 4)
  const binary = atob(padded)
  const bytes = new Uint8Array(binary.length)
  for (let index = 0; index < binary.length; index += 1) {
    bytes[index] = binary.charCodeAt(index)
  }
  return new TextDecoder().decode(bytes)
}

async function sign(secret: string, data: string): Promise<string> {
  const key = await crypto.subtle.importKey(
    'raw',
    encoder.encode(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign']
  )
  const signature = await crypto.subtle.sign('HMAC', key, encoder.encode(data))
  return bytesToBase64Url(new Uint8Array(signature))
}

function signaturesMatch(left: string, right: string): boolean {
  if (left.length !== right.length) return false
  let mismatch = 0
  for (let index = 0; index < left.length; index += 1) {
    mismatch |= left.charCodeAt(index) ^ right.charCodeAt(index)
  }
  return mismatch === 0
}

export async function createSessionToken(
  input: Omit<SessionPayload, 'exp'>
): Promise<string> {
  const secret = getSessionSecret()
  if (!secret) throw new Error('SESSION_SECRET is required in production')

  const payload: SessionPayload = {
    ...input,
    exp: Math.floor(Date.now() / 1000) + sessionMaxAgeSeconds,
  }
  const body = bytesToBase64Url(encoder.encode(JSON.stringify(payload)))
  const signature = await sign(secret, body)
  return `${body}.${signature}`
}

export async function verifySessionToken(token: string): Promise<SessionPayload | null> {
  const secret = getSessionSecret()
  if (!secret) return null

  const [body, signature] = token.split('.')
  if (!body || !signature) return null

  const expected = await sign(secret, body)
  if (!signaturesMatch(signature, expected)) return null

  try {
    const payload = JSON.parse(base64UrlToString(body)) as SessionPayload
    if (!payload.sub || !payload.email || !payload.exp) return null
    if (payload.exp < Math.floor(Date.now() / 1000)) return null
    return payload
  } catch {
    return null
  }
}
