'use client'

import { useSyncExternalStore } from 'react'
import { useEditor } from 'tldraw'
import { fittedFontSize } from '@/lib/garden/plant-label-layout'

interface FittedSvgTextProps {
  text: string
  x: number
  y: number
  maxWidth: number
  maxSize: number
  fontWeight?: number
  label: 'title' | 'plant'
}

let measureContext: CanvasRenderingContext2D | null = null

function measureContext2d(): CanvasRenderingContext2D | null {
  if (measureContext) return measureContext
  if (typeof document === 'undefined') return null
  const canvas = document.createElement('canvas')
  measureContext = canvas.getContext('2d')
  return measureContext
}

/**
 * Screen font that fits maxScreenWidth. The size changes; the tracking does not.
 */
function fontSizeThatFits(
  text: string,
  maxScreenWidth: number,
  maxScreenSize: number,
  fontWeight: number,
): number {
  const size = Math.max(maxScreenSize, 1)
  const ctx = measureContext2d()
  if (!ctx || maxScreenWidth <= 0) return size
  const family = getComputedStyle(document.body).fontFamily || 'sans-serif'
  ctx.font = `${fontWeight} ${size}px ${family}`
  const width = ctx.measureText(text).width
  if (width > maxScreenWidth && width > 0) return size * (maxScreenWidth / width)
  return size
}

/**
 * One line of text, fitted to the bed.
 * Laid out at screen size and counter-scaled so a camera zoom cannot
 * stretch the letters apart. Never sets textLength.
 */
export function FittedSvgText({
  text,
  x,
  y,
  maxWidth,
  maxSize,
  fontWeight = 500,
  label,
}: FittedSvgTextProps) {
  const editor = useEditor()
  const zoom = useSyncExternalStore(
    (notify) => editor.store.listen(() => notify()),
    () => editor.getZoomLevel(),
    () => 1,
  )
  const safeZoom = zoom > 0 ? zoom : 1
  const worldSize = fittedFontSize(text, maxWidth, maxSize)
  const screenSize = fontSizeThatFits(text, maxWidth * safeZoom, worldSize * safeZoom, fontWeight)

  return (
    <div
      data-garden-label={label}
      style={{
        position: 'absolute',
        left: x,
        top: y,
        width: 'max-content',
        transform: `translateX(-50%) scale(${1 / safeZoom})`,
        transformOrigin: 'top center',
        fontSize: screenSize,
        fontWeight,
        lineHeight: 1,
        letterSpacing: '0px',
        wordSpacing: 'normal',
        whiteSpace: 'nowrap',
        textAlign: 'center',
        pointerEvents: 'none',
        userSelect: 'none',
        color: 'inherit',
      }}
    >
      {text}
    </div>
  )
}
