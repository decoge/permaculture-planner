/**
 * Canvas export for the editor.
 *
 * The editor's Export button used to fire a toast and do nothing. There is a
 * 500-line `SitePlanExporter` in lib/export, but it is not imported anywhere
 * and it expects a `GardenPlan` -- a flat {x, y, width, height} shape from
 * types/index.ts -- whereas the editor actually holds `GardenBed[]`, whose beds
 * carry a polygon of `points` in inches plus optional plants and element
 * categories. This module exports what the editor really has.
 *
 * Kept free of React and DOM assumptions beyond the standard browser APIs, and
 * the geometry is a pure function so it can be unit tested in jsdom.
 */
import type { GardenBed } from '@/lib/garden/garden-types'

export type ExportFormat = 'svg' | 'png'

export interface CanvasExportOptions {
  /** Output scale for PNG. SVG ignores this. */
  scale?: number
  /** Margin around the drawing, in canvas units. */
  padding?: number
  /** Include a legend listing the element categories present. */
  showLegend?: boolean
  title?: string
}

interface Bounds {
  minX: number
  minY: number
  maxX: number
  maxY: number
  width: number
  height: number
}

/**
 * Bounding box of every bed, including its plants.
 *
 * Falls back to a small fixed box for an empty canvas so the caller always gets
 * usable dimensions instead of NaN from 0/0 arithmetic.
 */
export function canvasBounds(beds: GardenBed[]): Bounds {
  const xs: number[] = []
  const ys: number[] = []

  for (const bed of beds) {
    for (const point of bed.points ?? []) {
      xs.push(point.x)
      ys.push(point.y)
    }
    for (const plant of bed.plants ?? []) {
      xs.push(plant.x)
      ys.push(plant.y)
    }
  }

  if (xs.length === 0 || ys.length === 0) {
    return { minX: 0, minY: 0, maxX: 100, maxY: 100, width: 100, height: 100 }
  }

  const minX = Math.min(...xs)
  const maxX = Math.max(...xs)
  const minY = Math.min(...ys)
  const maxY = Math.max(...ys)
  return { minX, minY, maxX, maxY, width: maxX - minX, height: maxY - minY }
}

/** Escape text for inclusion in XML content. */
function escapeXml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;')
}

const ELEMENT_COLORS: Record<string, string> = {
  bed: '#8B4513',
  water_management: '#4FC3F7',
  structure: '#795548',
  access: '#9E9E9E',
  energy: '#FFB300',
  animal: '#8D6E63',
  waste: '#689F38',
}

const DEFAULT_COLOR = '#558B2F'

function bedColor(bed: GardenBed): string {
  return ELEMENT_COLORS[bed.elementCategory ?? 'bed'] ?? DEFAULT_COLOR
}

/**
 * Render the canvas as a standalone SVG document.
 *
 * Beds are drawn as polygons from their `points`, so the output matches what is
 * on the tldraw canvas rather than an idealised rectangle.
 */
export function canvasToSvg(beds: GardenBed[], options: CanvasExportOptions = {}): string {
  const { padding = 40, showLegend = true, title } = options
  const bounds = canvasBounds(beds)

  // Shift everything so the drawing starts at the padding rather than at a
  // negative offset when the canvas sits away from the origin.
  const offsetX = padding - bounds.minX
  const offsetY = padding - bounds.minY
  const width = Math.max(1, bounds.width + padding * 2)
  const height = Math.max(1, bounds.height + padding * 2)

  const parts: string[] = []
  parts.push(
    `<svg xmlns="http://www.w3.org/2000/svg" width="${Math.round(width)}" height="${Math.round(
      height
    )}" viewBox="0 0 ${Math.round(width)} ${Math.round(height)}">`
  )
  parts.push(`<rect width="100%" height="100%" fill="#ffffff"/>`)

  if (title) {
    parts.push(
      `<text x="${padding / 2}" y="${padding / 2 + 4}" font-family="sans-serif" font-size="14" fill="#212121">${escapeXml(
        title
      )}</text>`
    )
  }

  for (const bed of beds) {
    const points = bed.points ?? []
    if (points.length < 2) continue

    const polygon = points
      .map((point) => `${(point.x + offsetX).toFixed(2)},${(point.y + offsetY).toFixed(2)}`)
      .join(' ')

    parts.push(
      `<polygon points="${polygon}" fill="${bed.fill || bedColor(bed)}" fill-opacity="0.35" stroke="${
        bed.stroke || bedColor(bed)
      }" stroke-width="2"/>`
    )

    if (bed.name) {
      const cx = points.reduce((sum, point) => sum + point.x, 0) / points.length + offsetX
      const cy = points.reduce((sum, point) => sum + point.y, 0) / points.length + offsetY
      parts.push(
        `<text x="${cx.toFixed(2)}" y="${cy.toFixed(2)}" font-family="sans-serif" font-size="11" text-anchor="middle" fill="#424242">${escapeXml(
          bed.name
        )}</text>`
      )
    }

    for (const plant of bed.plants ?? []) {
      const px = (plant.x + offsetX).toFixed(2)
      const py = (plant.y + offsetY).toFixed(2)
      parts.push(`<circle cx="${px}" cy="${py}" r="3" fill="${DEFAULT_COLOR}"/>`)
      if (plant.plantId) {
        parts.push(
          `<title>${escapeXml(plant.plantId)}</title>`
        )
      }
    }
  }

  if (showLegend) {
    const present = Array.from(
      new Set(beds.map((bed) => bed.elementCategory ?? 'bed'))
    ).sort()
    if (present.length > 0) {
      const legendY = height - padding / 2
      present.forEach((category, index) => {
        const x = padding + index * 110
        parts.push(
          `<rect x="${x}" y="${legendY - 8}" width="10" height="10" fill="${
            ELEMENT_COLORS[category] ?? DEFAULT_COLOR
          }"/>`
        )
        parts.push(
          `<text x="${x + 15}" y="${legendY + 1}" font-family="sans-serif" font-size="10" fill="#616161">${escapeXml(
            category
          )}</text>`
        )
      })
    }
  }

  parts.push('</svg>')
  return parts.join('\n')
}

/** Trigger a browser download for the given blob. */
function downloadBlob(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob)
  const anchor = document.createElement('a')
  anchor.href = url
  anchor.download = filename
  document.body.appendChild(anchor)
  anchor.click()
  document.body.removeChild(anchor)
  // Revoke on the next tick so the click has been dispatched.
  setTimeout(() => URL.revokeObjectURL(url), 0)
}

/**
 * The exact JSON an export writes.
 *
 * Exposed separately from canvasToJson so callers -- and tests -- do not have to
 * read a Blob back to inspect it. jsdom's Blob has no .text() and FileReader is
 * asynchronous, so asserting on the blob directly is awkward.
 */
export function canvasToJsonText(beds: GardenBed[], title?: string): string {
  return JSON.stringify({ title, exportedAt: new Date().toISOString(), beds }, null, 2)
}

/** Serialise the canvas as JSON, which is the format the button actually offers. */
export function canvasToJson(beds: GardenBed[], title?: string): Blob {
  return new Blob([canvasToJsonText(beds, title)], { type: 'application/json' })
}

/**
 * Export the canvas, triggering a download.
 *
 * PNG rendering needs to rasterise the SVG through an Image, which is async and
 * can fail in environments without a real canvas; that rejection is propagated
 * so the caller can report it rather than pretending the export worked.
 */
export async function exportCanvas(
  beds: GardenBed[],
  format: ExportFormat | 'json',
  options: CanvasExportOptions = {}
): Promise<void> {
  downloadBlob(
    format === 'json' ? canvasToJson(beds, options.title) : await render(beds, format, options),
    `${safeFilename(options.title || 'garden-plan')}.${format}`
  )
}

/**
 * Reduce a title to something safe to hand to a download attribute.
 *
 * Collapsing runs of non-word characters turns "../../etc/passwd" into
 * "..-..-etc-passwd": the slashes are gone so it cannot address a directory,
 * but the dots survive, which still reads as a traversal attempt in the
 * downloads list. Strip the dot runs as well and fall back to a fixed name if
 * nothing usable is left.
 */
function safeFilename(title: string): string {
  // Replace dot runs with a dash rather than deleting them, so "plan.v2" reads
  // as "plan-v2" instead of the run-together "planv2".
  const cleaned = title
    .replace(/\.+/g, '-')
    .replace(/[^\w-]+/g, '-')
    .replace(/-{2,}/g, '-')
    .replace(/^-+|-+$/g, '')
  return cleaned || 'garden-plan'
}

async function render(
  beds: GardenBed[],
  format: ExportFormat,
  options: CanvasExportOptions
): Promise<Blob> {
  const svg = canvasToSvg(beds, options)
  if (format === 'svg') {
    return new Blob([svg], { type: 'image/svg+xml' })
  }
  return rasterise(svg, options.scale ?? 2)
}

function rasterise(svg: string, scale: number): Promise<Blob> {
  return new Promise((resolve, reject) => {
    const image = new Image()
    image.onload = () => {
      const canvas = document.createElement('canvas')
      canvas.width = image.width * scale
      canvas.height = image.height * scale
      const ctx = canvas.getContext('2d')
      if (!ctx) {
        reject(new Error('Canvas is not available in this environment'))
        return
      }
      ctx.fillStyle = '#ffffff'
      ctx.fillRect(0, 0, canvas.width, canvas.height)
      ctx.drawImage(image, 0, 0, canvas.width, canvas.height)
      canvas.toBlob((result) => {
        if (result) resolve(result)
        else reject(new Error('Failed to encode the PNG'))
      }, 'image/png')
    }
    image.onerror = () => reject(new Error('Failed to rasterise the drawing'))
    // A data URL rather than a blob URL: no object-URL lifecycle to manage and
    // no chance of revoking it before the load fires.
    image.src = `data:image/svg+xml;base64,${btoa(unescape(encodeURIComponent(svg)))}`
  })
}
