/**
 * Manual mock for the ESM-only `uuid` package.
 *
 * Jest's CommonJS runtime cannot require uuid's dist-node build ("Must use
 * import to load ES Module"), which is why every DB test used to mock
 * `@/lib/db/ids` wholesale and lib/db/ids.ts had no direct coverage. A manual
 * mock beside node_modules is picked up automatically, so ids.ts can be tested
 * for real.
 *
 * v5 mirrors the real function's contract: deterministic per (name, namespace),
 * and the result is a valid uuid with version 5.
 */
const { createHash } = require('crypto')

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

function v5(name, namespace) {
  const hash = createHash('sha1').update(String(namespace) + String(name)).digest('hex')
  const versioned = hash.slice(0, 12) + '5' + hash.slice(13)
  return [
    versioned.slice(0, 8),
    versioned.slice(8, 12),
    versioned.slice(12, 16),
    versioned.slice(16, 20),
    versioned.slice(20, 32),
  ].join('-')
}

function validate(value) {
  return typeof value === 'string' && UUID_RE.test(value)
}

module.exports = { v5, validate }
