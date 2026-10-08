'use client'

import { Suspense, useEffect, useState } from 'react'
import { useSearchParams } from 'next/navigation'
import { PermacultureEditorIntegrated } from '@/components/tldraw/permaculture-editor-integrated'
import { useGardenStore } from '@/lib/store/garden-store'
import { LocalStoragePersistence } from '@/lib/persistence/local-storage-adapter'
import { PostgresPersistence } from '@/lib/persistence/postgres-adapter'
import { toast } from 'sonner'
import { GardenBed } from '@/lib/garden/garden-types'

// Example starter garden layout
const STARTER_GARDEN: GardenBed[] = [
  {
    id: 'herb-bed',
    name: 'Herb Garden',
    points: [
      { x: 100, y: 100 },
      { x: 300, y: 100 },
      { x: 300, y: 200 },
      { x: 100, y: 200 }
    ],
    fill: '#e0f2e0',
    stroke: '#22c55e',
    plants: [
      { id: 'p1', plantId: 'basil', x: 140, y: 140 },
      { id: 'p2', plantId: 'thyme', x: 200, y: 140 },
      { id: 'p3', plantId: 'rosemary', x: 260, y: 140 }
    ]
  },
  {
    id: 'veggie-bed',
    name: 'Vegetable Bed',
    points: [
      { x: 400, y: 100 },
      { x: 600, y: 100 },
      { x: 600, y: 200 },
      { x: 400, y: 200 }
    ],
    fill: '#fef3c7',
    stroke: '#f59e0b',
    plants: [
      { id: 'p4', plantId: 'tomato', x: 450, y: 140 },
      { id: 'p5', plantId: 'lettuce', x: 520, y: 140 },
      { id: 'p6', plantId: 'pepper', x: 580, y: 140 }
    ]
  }
]

function DemoPageContent() {
  const searchParams = useSearchParams()
  const planId = searchParams.get('planId')

  // Access centralized store
  const beds = useGardenStore((state) => state.beds)
  const isLoading = useGardenStore((state) => state.isLoading)
  const error = useGardenStore((state) => state.error)
  const isDirty = useGardenStore((state) => state.isDirty)

  // Actions
  const setPersistence = useGardenStore((state) => state.setPersistence)
  const setPlanId = useGardenStore((state) => state.setPlanId)
  const load = useGardenStore((state) => state.load)
  const updateBeds = useGardenStore((state) => state.updateBeds)
  const clearError = useGardenStore((state) => state.clearError)
  const reset = useGardenStore((state) => state.reset)
  const [ready, setReady] = useState(false)

  // Setup persistence adapter on mount
  useEffect(() => {
    // Cleanup on unmount
    return () => {
      reset()
    }
  }, [reset])

  useEffect(() => {
    let cancelled = false

    const initializePersistence = async () => {
      setReady(false)

      // Priority 1: Load from planId (wizard flow)
      if (planId) {
        const adapter = new PostgresPersistence(planId)
        setPersistence(adapter)
        setPlanId(planId)

        await load(planId)
        if (cancelled) return

        const loadedBeds = useGardenStore.getState().beds
        const loadError = useGardenStore.getState().error
        if (loadedBeds.length > 0) {
          toast.success('Loaded your garden plan')
        } else {
          toast.error(loadError || 'Could not load your garden plan')
        }
      } else {
        // Priority 2: Demo mode with localStorage
        const adapter = new LocalStoragePersistence()
        setPersistence(adapter)

        await load()
        if (cancelled) return

        const loadedBeds = useGardenStore.getState().beds

        if (loadedBeds.length > 0) {
          toast.success('Loaded your saved demo garden')
        } else {
          // No saved data, use starter garden
          updateBeds(STARTER_GARDEN)
          toast.info('Starting with example garden', {
            description: 'Try the wizard to create a custom plan!'
          })
        }
      }

      if (!cancelled) setReady(true)
    }

    initializePersistence()
    return () => {
      cancelled = true
    }
  }, [planId, setPersistence, setPlanId, load, updateBeds])

  // Loading state. The editor mounts only after beds are in the store so a
  // saved plan is not replaced by an empty canvas.
  if (!ready || isLoading) {
    return (
      <div className="w-full h-screen flex items-center justify-center bg-gradient-to-br from-green-50 to-emerald-50">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-green-600 mx-auto mb-4" />
          <p className="text-gray-600">
            {planId ? 'Loading your garden plan...' : 'Loading demo...'}
          </p>
        </div>
      </div>
    )
  }

  return (
    <div className="flex h-[calc(100vh-4rem)] w-full flex-col overflow-hidden bg-background">
      {/* Error alert */}
      {error && (
        <div className="bg-red-50 border-b border-red-200 px-4 py-2 text-sm text-red-800 flex justify-between items-center">
          <span>⚠️ {error}</span>
          <button
            onClick={clearError}
            className="text-red-600 hover:text-red-800 font-bold"
          >
            ✕
          </button>
        </div>
      )}

      {/* Unsaved changes indicator */}
      {isDirty && (
        <div className="bg-amber-50 border-b border-amber-200 px-4 py-2 text-sm text-amber-800">
          💾 Auto-saving changes...
        </div>
      )}

      {/* Main editor - now directly reads from store */}
      <div className="min-h-0 flex-1 overflow-hidden">
        <PermacultureEditorIntegrated
          key={planId ?? 'demo'}
          initialData={beds}
          onSave={updateBeds}
          planId={planId ?? undefined}
          showHeader={true}
        />
      </div>
    </div>
  )
}

export default function DemoPage() {
  return (
    <Suspense fallback={
      <div className="w-full h-screen flex items-center justify-center bg-gradient-to-br from-green-50 to-emerald-50">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-green-600 mx-auto mb-4" />
          <p className="text-gray-600">Loading demo...</p>
        </div>
      </div>
    }>
      <DemoPageContent />
    </Suspense>
  )
}
