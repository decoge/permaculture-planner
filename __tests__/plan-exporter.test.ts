/**
 * PNG export used to encode the tldraw SVG with `btoa`, which accepts only
 * Latin-1. Every plan contains emoji (the plant icons), so the export threw
 * `InvalidCharacterError` and produced no file — the browser check on /demo
 * captured exactly that, with no download and no error toast.
 *
 * The canvas rasterisation itself needs a real image decoder, so these tests pin
 * the part that broke: the SVG crosses steps as a UTF-8 blob, and an empty
 * canvas rejects with a message the UI can show.
 */
import { describe, expect, test } from '@jest/globals'
import { downloadPdf, downloadPng, downloadSvg, svgToBlob } from '@/lib/export/plan-exporter'

const SVG_WITH_EMOJI = '<svg xmlns="http://www.w3.org/2000/svg"><text>🍅 Tomato — 20 cm</text></svg>'

describe('svgToBlob', () => {
  test('round-trips an SVG containing emoji and non-Latin1 characters', async () => {
    const blob = svgToBlob(SVG_WITH_EMOJI)
    expect(blob.type).toBe('image/svg+xml;charset=utf-8')
    // jsdom's Blob has no text(); FileReader is the reader it does support.
    const text = await new Promise<string>((resolve, reject) => {
      const reader = new FileReader()
      reader.onload = () => resolve(String(reader.result))
      reader.onerror = () => reject(reader.error)
      reader.readAsText(blob)
    })
    expect(text).toBe(SVG_WITH_EMOJI)
  })

  test('btoa is the thing that cannot do this', () => {
    // Documents why the blob path exists: the old code was this call.
    expect(() => btoa(SVG_WITH_EMOJI)).toThrow()
  })
})

describe('export guards', () => {
  const emptyEditor = {
    getCurrentPageShapeIds: () => new Set<string>(),
    getSvgString: () => Promise.resolve(undefined),
  }

  test.each([
    ['png', downloadPng],
    ['svg', downloadSvg],
    ['pdf', downloadPdf],
  ])('%s export rejects instead of resolving on an empty canvas', async (_label, fn) => {
    await expect(fn(emptyEditor)).rejects.toThrow('Nothing on the canvas to export')
  })
})
