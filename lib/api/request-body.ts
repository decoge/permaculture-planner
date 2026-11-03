import { NextResponse } from 'next/server'

/**
 * Read a route's JSON body with a size bound and a 400 for malformed input.
 *
 * Next's App Router streams request bodies with no default limit — the
 * `serverActions.bodySizeLimit` in next.config.js does not apply to route
 * handlers — so every `await request.json()` read whatever the caller sent into
 * memory before any field-level cap could run. A malformed body also threw a
 * SyntaxError that routeError() turned into a 500.
 *
 * The caps elsewhere in the app (beds per plan, plants per bed, messages per
 * chat) bound what the database does with a payload; this bounds reading it.
 */

/** Generous for a canvas autosave; far below anything worth buffering. */
export const MAX_JSON_BODY_BYTES = 2 * 1024 * 1024

export type JsonBody = { ok: true; body: unknown } | { ok: false; response: NextResponse }

/**
 * Narrow a parsed body field to a plain object.
 *
 * Routes used to receive `any` from `request.json()`; now that the body is
 * `unknown`, a caller that sends `"siteData": "nope"` must be folded into
 * `undefined` rather than reaching the DB helpers as a string.
 */
export function asRecord(value: unknown): Record<string, unknown> | undefined {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return undefined
  return value as Record<string, unknown>
}

function tooLarge(maxBytes: number): NextResponse {
  return NextResponse.json(
    { error: `Request body is larger than ${Math.round(maxBytes / 1024)} KB` },
    { status: 413 }
  )
}

function malformed(): NextResponse {
  return NextResponse.json({ error: 'Request body is not valid JSON' }, { status: 400 })
}

export async function readJsonBody(
  request: Request,
  maxBytes: number = MAX_JSON_BODY_BYTES
): Promise<JsonBody> {
  // Reject a declared oversize body before reading it at all. `content-length`
  // is advisory (a chunked request has none), so the read is checked too.
  const declared = Number(request.headers.get('content-length') ?? '')
  if (Number.isFinite(declared) && declared > maxBytes) {
    return { ok: false, response: tooLarge(maxBytes) }
  }

  let raw: string
  try {
    raw = await request.text()
  } catch {
    return { ok: false, response: malformed() }
  }

  // A UTF-8 byte is at least one UTF-16 code unit, so a string longer than the
  // byte budget is definitely over it — the check is conservative, not exact,
  // which is what matters for refusing work.
  if (raw.length > maxBytes) {
    return { ok: false, response: tooLarge(maxBytes) }
  }
  if (raw.length === 0) {
    return { ok: true, body: {} }
  }

  try {
    return { ok: true, body: JSON.parse(raw) }
  } catch {
    return { ok: false, response: malformed() }
  }
}
