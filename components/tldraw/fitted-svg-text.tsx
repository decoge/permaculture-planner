'use client'

import { useLayoutEffect, useRef, useState } from 'react'
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

/**
 * One line of SVG text, shrunk to its measured width.
 * Never sets textLength, which letter-spaces short labels.
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
  const ref = useRef<SVGTextElement>(null)
  const estimate = fittedFontSize(text, maxWidth, maxSize)
  const [fontSize, setFontSize] = useState(estimate)

  useLayoutEffect(() => {
    const node = ref.current
    if (!node) return
    let cancelled = false

    const fit = () => {
      const element = ref.current
      if (cancelled || !element) return
      element.setAttribute('font-size', String(estimate))
      let length = 0
      try {
        length = element.getComputedTextLength()
      } catch {
        length = 0
      }
      const next = length > maxWidth && length > 0
        ? (estimate * maxWidth) / length
        : estimate
      setFontSize((current) => (Math.abs(current - next) < 0.05 ? current : next))
    }

    fit()
    const fonts = document.fonts
    fonts?.ready.then(fit).catch(() => undefined)

    return () => {
      cancelled = true
    }
  }, [estimate, maxWidth, text])

  return (
    <text
      ref={ref}
      x={x}
      y={y}
      textAnchor="middle"
      dominantBaseline="hanging"
      fill="currentColor"
      fontSize={fontSize}
      fontWeight={fontWeight}
      data-garden-label={label}
      style={{
        pointerEvents: 'none',
        userSelect: 'none',
        letterSpacing: 'normal',
        wordSpacing: 'normal',
        whiteSpace: 'nowrap',
      }}
    >
      {text}
    </text>
  )
}
