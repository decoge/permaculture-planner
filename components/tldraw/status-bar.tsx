'use client'

import { useEffect, useState } from 'react'
import type { Editor } from 'tldraw'

interface StatusBarProps {
  /** The tldraw editor, or null while the canvas is still mounting. */
  editor: Editor | null
  /** Bed / plant / element counts already computed by the editor header. */
  beds: number
  plants: number
  elements: number
  /** Unsaved-changes flag from the editor's change tracking. */
  hasUnsavedChanges: boolean
}

/**
 * Editor status bar: a compact footer with live zoom level, shape counts and
 * save state.
 *
 * Zoom and selection are read from the editor's store on every relevant change
 * via `store.listen`, throttled to one state update per animation frame so
 * dragging the camera does not re-render the footer per pointer move.
 */
export function StatusBar({ editor, beds, plants, elements, hasUnsavedChanges }: StatusBarProps) {
  const [zoomPercent, setZoomPercent] = useState<number | null>(null)
  const [selectedCount, setSelectedCount] = useState(0)

  useEffect(() => {
    if (!editor) return

    let frame: number | null = null

    const readState = () => {
      frame = null
      setZoomPercent(Math.round(editor.getZoomLevel() * 100))
      setSelectedCount(editor.getSelectedShapeIds().length)
    }

    const scheduleRead = () => {
      if (frame !== null) return
      frame = requestAnimationFrame(readState)
    }

    readState()
    // Camera is a session record and selection a document one, so listen to
    // everything and rely on the rAF throttle to keep this cheap.
    const unsubscribe = editor.store.listen(scheduleRead)

    return () => {
      unsubscribe()
      if (frame !== null) cancelAnimationFrame(frame)
    }
  }, [editor])

  return (
    <footer className="shrink-0 border-t bg-card/50 backdrop-blur px-4 py-1.5 flex items-center gap-4 text-xs text-muted-foreground">
      <span data-testid="status-zoom">
        {zoomPercent === null ? '—' : `${zoomPercent}%`}
      </span>
      <span aria-hidden>·</span>
      <span>{beds} beds</span>
      <span>{plants} plants</span>
      <span>{elements} elements</span>
      {selectedCount > 0 && (
        <>
          <span aria-hidden>·</span>
          <span>{selectedCount} selected</span>
        </>
      )}
      <span className="ml-auto">
        {hasUnsavedChanges ? 'Unsaved changes — autosaving…' : 'All changes saved'}
      </span>
    </footer>
  )
}
