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