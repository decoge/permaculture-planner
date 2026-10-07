'use client'

import { jsPDF } from 'jspdf'

/**
 * Export a tldraw canvas to SVG and PDF.
 *
 * Both start from the same SVG string the editor's PNG path already uses
 * (Editor.getSvgString). The PDF embeds that SVG rasterized through a canvas
 * at the SVG's native pixel size, so the PDF page matches the plan's own
 * proportions rather than stretching to a fixed sheet.
 */

/** The slice of the tldraw Editor this module needs. */
export interface ExportableEditor {
  getCurrentPageShapeIds: () => Set<string>
  // eslint-disable-next-line @typescript-eslint/no-explicit-any -- the real signature is
  // generic over TLShapeId/TLShape; restating it here would import tldraw types into a
  // module the Jest environment cannot load. The call site passes only shape ids.
  getSvgString: (...args: any[]) => Promise<{ svg: string; width: number; height: number } | undefined>
}

async function svgStringFromShapes(
  editor: ExportableEditor
): Promise<{ svg: string; width: number; height: number } | null> {
  // TLShapeId is a branded string, so a Set<string> widens cleanly into the
  // shape-id union the editor expects without importing tldraw types here.
  const shapeIds = Array.from(editor.getCurrentPageShapeIds()) as never[]
  if (shapeIds.length === 0) return null
  const result = await editor.getSvgString(shapeIds)
  if (!result) return null
  return { svg: result.svg, width: result.width, height: result.height }
}

export function downloadSvg(editor: ExportableEditor, filename = 'garden-plan'): Promise<void> {
  return svgStringFromShapes(editor).then((result) => {
    if (!result) throw new Error('Nothing on the canvas to export')
    const blob = new Blob([result.svg], { type: 'image/svg+xml;charset=utf-8' })
    const url = URL.createObjectURL(blob)
    const link = document.createElement('a')
    link.href = url
    link.download = `${filename}-${Date.now()}.svg`
    link.click()
    window.setTimeout(() => URL.revokeObjectURL(url), 1000)
  })
}

export function downloadPdf(editor: ExportableEditor, filename = 'garden-plan'): Promise<void> {
  return svgStringFromShapes(editor).then((result) => {
    if (!result) throw new Error('Nothing on the canvas to export')
    return new Promise<void>((resolve, reject) => {
      const svgBlob = new Blob([result.svg], { type: 'image/svg+xml;charset=utf-8' })
      const url = URL.createObjectURL(svgBlob)
      const img = new Image()
      img.onload = () => {
        try {
          const canvas = document.createElement('canvas')
          canvas.width = result.width
          canvas.height = result.height
          const ctx = canvas.getContext('2d')
          if (!ctx) throw new Error('Canvas 2D context unavailable')
          ctx.drawImage(img, 0, 0, result.width, result.height)
          URL.revokeObjectURL(url)

          const pngData = canvas.toDataURL('image/png')
          // Landscape/portrait chosen from the plan's own aspect ratio.
          const orientation = result.width >= result.height ? 'landscape' : 'portrait'
          const pdf = new jsPDF({ orientation, unit: 'pt', format: [result.width, result.height] })
          pdf.addImage(pngData, 'PNG', 0, 0, result.width, result.height)
          pdf.save(`${filename}-${Date.now()}.pdf`)
          resolve()
        } catch (error) {
          reject(error instanceof Error ? error : new Error('PDF export failed'))
        }
      }
      img.onerror = () => {
        URL.revokeObjectURL(url)
        reject(new Error('Could not rasterize the canvas'))
      }
      img.src = url
    })
  })
}
