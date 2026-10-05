// Jest setup file
import '@testing-library/jest-dom'
import 'fake-indexeddb/auto'

// Route tests run under @jest-environment node (Next's server runtime needs
// undici's Request/Response, which jsdom does not provide). Everything below
// is a browser polyfill, so guard it rather than forcing every suite to jsdom.
const hasDOM = typeof window !== 'undefined'

// Polyfill structuredClone for Jest environment
global.structuredClone = global.structuredClone || ((obj) => JSON.parse(JSON.stringify(obj)))

if (hasDOM) {
  // Mock window.matchMedia
  Object.defineProperty(window, 'matchMedia', {
    writable: true,
    value: jest.fn().mockImplementation(query => ({
      matches: false,
      media: query,
      onchange: null,
      addListener: jest.fn(), // Deprecated
      removeListener: jest.fn(), // Deprecated
      addEventListener: jest.fn(),
      removeEventListener: jest.fn(),
      dispatchEvent: jest.fn(),
    })),
  })

  // tldraw reads these at module scope (node_modules/@tldraw/editor/src/lib/
  // globals/environment.ts touches matchMedia) and also uses them for canvas
  // sizing. jsdom has matchMedia via the mock above but provides neither
  // ResizeObserver on window nor pointer-event capture, and importing any
  // tldraw module without them throws before a single test runs.
  if (!window.ResizeObserver) {
    window.ResizeObserver = class ResizeObserver {
      observe() {}
      unobserve() {}
      disconnect() {}
    }
  }
  if (!window.DOMMatrixReadOnly) {
    window.DOMMatrixReadOnly = class DOMMatrixReadOnly {
      constructor() {
        return { a: 1, b: 0, c: 0, d: 1, e: 0, f: 0 }
      }
    }
  }
  // Pointer capture is used by the interaction handlers; jsdom lacks it.
  if (!Element.prototype.setPointerCapture) {
    Element.prototype.setPointerCapture = function () {}
  }
  if (!Element.prototype.releasePointerCapture) {
    Element.prototype.releasePointerCapture = function () {}
  }
  if (!Element.prototype.hasPointerCapture) {
    Element.prototype.hasPointerCapture = function () {
      return false
    }
  }
  if (!Element.prototype.scrollIntoView) {
    Element.prototype.scrollIntoView = function () {}
  }
  // tldraw feature-detects P3 colour support at module scope with
  // `CSS.supports('color', 'color(display-p3 1 1 1)')`; jsdom ships no CSS
  // object at all, so the expression throws on import.
  if (typeof globalThis.CSS === 'undefined') {
    globalThis.CSS = {}
  }
  if (typeof globalThis.CSS.supports !== 'function') {
    globalThis.CSS.supports = () => false
  }
  // jsdom does not expose the TextEncoder/TextDecoder that Node has, and
  // tldraw's SVG path builder constructs a TextDecoder at module scope.
  if (typeof globalThis.TextEncoder === 'undefined') {
    globalThis.TextEncoder = class TextEncoder {
      encode(input = '') {
        return Buffer.from(input, 'utf8')
      }
    }
  }
  if (typeof globalThis.TextDecoder === 'undefined') {
    globalThis.TextDecoder = class TextDecoder {
      decode(input) {
        return Buffer.from(input).toString('utf8')
      }
    }
  }
}

// Mock IntersectionObserver
global.IntersectionObserver = class IntersectionObserver {
  constructor() {}
  disconnect() {}
  observe() {}
  unobserve() {}
  takeRecords() {
    return []
  }
}

// Mock ResizeObserver
global.ResizeObserver = class ResizeObserver {
  constructor() {}
  disconnect() {}
  observe() {}
  unobserve() {}
}

// Mock navigator
if (hasDOM) {
  Object.defineProperty(window, 'navigator', {
    value: {
      // tldraw reads userAgent at module scope to detect the browser, so this
      // stub has to keep it. Replacing navigator wholesale without it made
      // importing any tldraw module throw on `navigator.userAgent.match`.
      userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) jsdom',
      maxTouchPoints: 0,
      clipboard: {
        writeText: jest.fn(),
        readText: jest.fn(),
      },
      serviceWorker: {
        ready: Promise.resolve({
          active: null,
          installing: null,
          waiting: null,
        }),
        register: jest.fn(),
        addEventListener: jest.fn(),
      },
    },
    writable: true,
  })
}