'use client'

import { jsPDF } from 'jspdf'

/**
 * Export a tldraw canvas to PNG, SVG and PDF.
 *
 * All three start from the same SVG string tldraw renders from the document
 * (Editor.getSvgString). The PDF embeds that SVG rasterized through a canvas at
 * the SVG's native pixel size, so the PDF page matches the plan's own
 * proportions rather than stretching to a fixed sheet.
 *
 * The SVG travels between steps as a Blob, never as base64. `btoa` accepts only
 * Latin-1, and every plan contains emoji (the plant icons), so the editor's old
 * `btoa(svg)` PNG path threw `InvalidCharacterError` and exported nothing for
 * any garden with a plant in it.
 */

/** The slice of the tldraw Editor this module needs. */
export interface ExportableEditor {
  getCurrentPageShapeIds: () => Set<string>
  // eslint-disable-next-line @typescript-eslint/no-explicit-any -- the real signature is
  // generic over TLShapeId/TLShape; restating it here would import tldraw types into a
  // module the Jest environment cannot load. The call site passes only shape ids.
  getSvgString: (...args: any[]) => Promise<{ svg: string; width: number; height: number } | undefined>
}

interface RenderedSvg {
  svg: string
  width: number
  height: number
}

/** The SVG as a UTF-8 blob — safe for any character the document contains. */
export function svgToBlob(svg: string): Blob {
  return new Blob([svg], { type: 'image/svg+xml;charset=utf-8' })
}

async function svgStringFromShapes(
  editor: ExportableEditor
): Promise<RenderedSvg | null> {
  // TLShapeId is a branded string, so a Set<string> widens cleanly into the
  // shape-id union the editor expects without importing tldraw types here.
  const shapeIds = Array.from(editor.getCurrentPageShapeIds()) as never[]
  if (shapeIds.length === 0) return null
  const result = await editor.getSvgString(shapeIds)
  if (!result) return null
  return { svg: result.svg, width: result.width, height: result.height }
}

/** Rasterize the SVG at its native pixel size, through a blob URL. */
function rasterize(rendered: RenderedSvg): Promise<HTMLCanvasElement> {
  return new Promise<HTMLCanvasElement>((resolve, reject) => {
    const url = URL.createObjectURL(svgToBlob(rendered.svg))
    const img = new Image()
    img.onload = () => {
      try {
        const canvas = document.createElement('canvas')
        canvas.width = rendered.width
        canvas.height = rendered.height
        const ctx = canvas.getContext('2d')
        if (!ctx) throw new Error('Canvas 2D context unavailable')
        ctx.drawImage(img, 0, 0, rendered.width, rendered.height)
        resolve(canvas)
      } catch (error) {
        reject(error instanceof Error ? error : new Error('Could not rasterize the canvas'))
      } finally {
        URL.revokeObjectURL(url)
      }
    }
    img.onerror = () => {
      URL.revokeObjectURL(url)
      reject(new Error('Could not rasterize the canvas'))
    }
    img.src = url
  })
}

function saveBlob(blob: Blob, name: string) {
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url
  link.download = name
  link.click()
  window.setTimeout(() => URL.revokeObjectURL(url), 1000)
}

export function downloadSvg(editor: ExportableEditor, filename = 'garden-plan'): Promise<void> {
  return svgStringFromShapes(editor).then((rendered) => {
    if (!rendered) throw new Error('Nothing on the canvas to export')
    saveBlob(svgToBlob(rendered.svg), `${filename}-${Date.now()}.svg`)
  })
}

export function downloadPng(editor: ExportableEditor, filename = 'garden-plan'): Promise<void> {
  return svgStringFromShapes(editor).then(async (rendered) => {
    if (!rendered) throw new Error('Nothing on the canvas to export')
    const canvas = await rasterize(rendered)
    const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, 'image/png'))
    if (!blob) throw new Error('Could not encode the PNG')
    saveBlob(blob, `${filename}-${Date.now()}.png`)
  })
}

export function downloadPdf(editor: ExportableEditor, filename = 'garden-plan'): Promise<void> {
  return svgStringFromShapes(editor).then(async (rendered) => {
    if (!rendered) throw new Error('Nothing on the canvas to export')
    const canvas = await rasterize(rendered)
    const pngData = canvas.toDataURL('image/png')
    // Landscape/portrait chosen from the plan's own aspect ratio.
    const orientation = rendered.width >= rendered.height ? 'landscape' : 'portrait'
    const pdf = new jsPDF({ orientation, unit: 'pt', format: [rendered.width, rendered.height] })
    pdf.addImage(pngData, 'PNG', 0, 0, rendered.width, rendered.height)
    pdf.save(`${filename}-${Date.now()}.pdf`)
  })
}
