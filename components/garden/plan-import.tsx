'use client'

import { useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import { api } from '@/lib/api/http'
import { Button } from '@/components/ui/button'
import { Loader2, Upload } from 'lucide-react'

/**
 * Normalizes both JSON export shapes this app has ever produced:
 *  - the editor's export: a bare GardenBed[] array
 *  - the demo/localStorage export: { beds, metadata?, planName? }
 */
function parseImportedPlan(text: string): { beds: unknown[]; name: string | null } | null {
  try {
    const parsed = JSON.parse(text) as unknown

    if (Array.isArray(parsed)) {
      return { beds: parsed, name: null }
    }

    if (parsed && typeof parsed === 'object' && Array.isArray((parsed as { beds?: unknown }).beds)) {
      const record = parsed as { beds: unknown[]; planName?: unknown }
      return {
        beds: record.beds,
        name: typeof record.planName === 'string' && record.planName.trim() ? record.planName.trim() : null,
      }
    }

    return null
  } catch {
    return null
  }
}

/**
 * Import an exported plan JSON as a NEW plan in the user's account. The raw
 * beds payload is forwarded to POST /api/gardens, which sanitizes dimensions
 * and persists through the same path the wizard uses -- the import never
 * touches the database directly from the client.
 */
export function PlanImport() {
  const router = useRouter()
  const inputRef = useRef<HTMLInputElement>(null)
  const [importing, setImporting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const handleFile = async (file: File) => {
    setImporting(true)
    setError(null)
    try {
      const text = await file.text()
      const parsed = parseImportedPlan(text)
      if (!parsed || parsed.beds.length === 0) {
        setError('That file does not look like a plan export (no beds found).')
        setImporting(false)
        return
      }

      const result = await api<{ planId: string; success: boolean }>('/api/gardens', {
        method: 'POST',
        body: JSON.stringify({
          beds: parsed.beds,
          metadata: {},
          planData: parsed.name ? { name: parsed.name } : {},
        }),
      })

      if (result.planId) {
        router.push(`/plans/${result.planId}`)
      } else {
        setError('Import succeeded but no plan was returned.')
        setImporting(false)
      }
    } catch {
      setError('Could not import that file.')
      setImporting(false)
    }
  }

  return (
    <div>
      <input
        ref={inputRef}
        type="file"
        accept="application/json,.json"
        className="hidden"
        onChange={(e) => {
          const file = e.target.files?.[0]
          if (file) void handleFile(file)
          // Reset so picking the same file twice still fires onChange.
          e.target.value = ''
        }}
      />
      <Button variant="outline" size="sm" onClick={() => inputRef.current?.click()} disabled={importing}>
        {importing ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Upload className="h-4 w-4 mr-2" />}
        Import plan
      </Button>
      {error && <p className="mt-2 text-xs text-red-600">{error}</p>}
    </div>
  )
}
