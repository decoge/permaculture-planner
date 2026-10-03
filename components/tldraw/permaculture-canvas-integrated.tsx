'use client'

import { Tldraw, Editor } from 'tldraw'
import 'tldraw/tldraw.css'
import { useEffect, useState, useCallback, useImperativeHandle, useRef, forwardRef } from 'react'
import { permacultureShapes } from './shapes'
import { permacultureTools } from './tools'
import { PlantTool } from './tools/plant-tool'
import { ElementTool } from './tools/element-tool'
import { GardenBed } from '@/lib/garden/garden-types'
import { dataAdapter, gardenIdFromShape } from './data-adapter'
import { bedLabelWidth, placePlantsInBed } from '@/lib/garden/plant-label-layout'
import { CanvasErrorBoundary } from './canvas-error-boundary'
import { PlantInfo } from '@/lib/data/plant-library'
import { ElementSubtype, ElementCategory } from '@/lib/canvas-elements'
import { Loader2 } from 'lucide-react'

interface PermacultureCanvasIntegratedProps {
  initialData?: GardenBed[]
  onSave?: (data: GardenBed[]) => void
  onEditorReady?: (editor: Editor) => void
  selectedPlant?: PlantInfo | null
  selectedElement?: { subtype: ElementSubtype; category: ElementCategory } | null
  className?: string
  loading?: boolean
  disableAutoSave?: boolean
  saveDebounce?: number
}

export interface PermacultureCanvasHandle {
  editor: Editor | null
  activatePlantTool: (plant: PlantInfo) => void
  activateElementTool: (subtype: ElementSubtype, category: ElementCategory) => void
  activateBedTool: () => void
  returnToSelect: () => void
}

/**
 * PermacultureCanvasIntegrated - Fully wired canvas with tool integration
 *
 * PRODUCTION-READY with:
 * - Editor instance exposed via ref
 * - Tool activation methods
 * - Real-time data synchronization
 * - Plant/Element tool integration
 */
const PermacultureCanvasIntegratedInner = forwardRef<PermacultureCanvasHandle, PermacultureCanvasIntegratedProps>(
  ({
    initialData = [],
    onSave,
    onEditorReady,
    selectedPlant,
    selectedElement,
    className = '',
    loading = false,
    disableAutoSave = false,
    saveDebounce = 1000,
  }, ref) => {
    const [editor, setEditor] = useState<Editor | null>(null)
    const [isInitialized, setIsInitialized] = useState(false)
    const saveTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null)
    const hydratingRef = useRef(false)
    const canPersistRef = useRef(false)
    const onSaveRef = useRef(onSave)
    onSaveRef.current = onSave

    /**
     * Expose editor and tool activation methods
     */
    useImperativeHandle(ref, () => ({
      editor,
      activatePlantTool: (plant: PlantInfo) => {
        if (!editor) return
        const plantTool = editor.getStateDescendant('plant-tool') as PlantTool
        if (plantTool) {
          plantTool.setPlant(plant)
          editor.setCurrentTool('plant-tool')
        }
      },
      activateElementTool: (subtype: ElementSubtype, category: ElementCategory) => {
        if (!editor) return
        const elementTool = editor.getStateDescendant('element-tool') as ElementTool
        if (elementTool) {
          elementTool.setElement(subtype, category)
          editor.setCurrentTool('element-tool')
        }
      },
      activateBedTool: () => {
        if (!editor) return
        editor.setCurrentTool('bed-tool')
      },
      returnToSelect: () => {
        if (!editor) return
        editor.setCurrentTool('select')
      },
    }), [editor])

    /**
     * Activate tools when plant/element is selected
     */
    useEffect(() => {
      if (!editor) return

      if (selectedPlant) {
        const plantTool = editor.getStateDescendant('plant-tool') as PlantTool
        if (plantTool) {
          plantTool.setPlant(selectedPlant)
          editor.setCurrentTool('plant-tool')
        }
      } else if (selectedElement) {
        const elementTool = editor.getStateDescendant('element-tool') as ElementTool
        if (elementTool) {
          elementTool.setElement(selectedElement.subtype, selectedElement.category)
          editor.setCurrentTool('element-tool')
        }
      }
    }, [editor, selectedPlant, selectedElement])

    /**
     * Load initial data once. The parent mounts this canvas only after the plan
     * has finished loading, so an empty list is a real empty plan.
     */
    useEffect(() => {
      if (!editor || isInitialized) return

      hydratingRef.current = true
      try {
        if (initialData.length > 0) {
          const shapes = dataAdapter.gardenBedsToShapes(initialData)
          if (shapes.length > 0) {
            editor.createShapes(shapes)
            setTimeout(() => {
              editor.zoomToFit({ animation: { duration: 300 } })
            }, 100)
          }
        }
        setIsInitialized(true)
      } catch (error) {
        console.error('Failed to load initial data:', error)
      } finally {
        setTimeout(() => {
          hydratingRef.current = false
          canPersistRef.current = true
        }, 0)
      }
    }, [editor, initialData, isInitialized])

    /**
     * Keep plants inside a bed when that bed is moved or resized.
     */
    useEffect(() => {
      if (!editor) return

      let syncingPlants = false
      const dispose = editor.sideEffects.registerAfterChangeHandler('shape', (prev, next) => {
        if (syncingPlants || prev.type !== 'bed' || next.type !== 'bed') return

        const prevProps = prev.props as { w?: number; h?: number }
        const nextProps = next.props as { w?: number; h?: number }
        const prevW = prevProps.w || 1
        const prevH = prevProps.h || 1
        const scaleX = (nextProps.w || prevW) / prevW
        const scaleY = (nextProps.h || prevH) / prevH
        const moved = Math.abs(next.x - prev.x) > 0.01 || Math.abs(next.y - prev.y) > 0.01
        const resized = Math.abs(scaleX - 1) > 0.01 || Math.abs(scaleY - 1) > 0.01
        if (!moved && !resized) return

        const bedId = gardenIdFromShape(next)
        const plants = editor.getCurrentPageShapes().filter((shape) => {
          return shape.type === 'plant' && shape.meta.bedId === bedId
        })
        if (plants.length === 0) return

        syncingPlants = true
        try {
          if (resized) {
            const ordered = plants.slice().sort((a, b) => a.y - b.y || a.x - b.x)
            const spots = placePlantsInBed(
              ordered.map((plant) => ({
                id: plant.id,
                name: String((plant.props as { plantName?: string }).plantName || 'Plant'),
                x: plant.x - next.x,
                y: plant.y - next.y,
              })),
              nextProps.w || prevW,
              nextProps.h || prevH,
            )
            const spotById = new Map(spots.map((spot) => [spot.id, spot]))
            editor.updateShapes(ordered.flatMap((plant) => {
              const spot = spotById.get(plant.id)
              if (!spot) return []
              return [{
                id: plant.id,
                type: 'plant' as const,
                x: next.x + spot.x,
                y: next.y + spot.y,
                props: { radius: spot.radius },
                meta: {
                  ...plant.meta,
                  fontSize: spot.fontSize,
                  labelMaxWidth: bedLabelWidth(nextProps.w || prevW),
                },
              }]
            }))
          } else {
            editor.updateShapes(plants.map((plant) => ({
              id: plant.id,
              type: 'plant' as const,
              x: next.x + (plant.x - prev.x),
              y: next.y + (plant.y - prev.y),
            })))
          }
        } finally {
          syncingPlants = false
        }
      })

      return () => {
        dispose()
      }
    }, [editor])

    /**
     * Listen for canvas changes. Hydrating a saved plan must not write those
     * beds back before the user moves or resizes anything.
     */
    useEffect(() => {
      if (!editor) return

      const unsubscribe = editor.store.listen(() => {
        if (!canPersistRef.current || hydratingRef.current || disableAutoSave || !onSaveRef.current) return

        if (saveTimeoutRef.current) clearTimeout(saveTimeoutRef.current)
        saveTimeoutRef.current = setTimeout(() => {
          try {
            const gardenBeds = dataAdapter.shapesToGardenBeds(editor.getCurrentPageShapes())
            onSaveRef.current?.(gardenBeds)
          } catch (error) {
            console.error('Failed to save canvas data:', error)
          }
        }, saveDebounce)
      }, { scope: 'document', source: 'user' })

      return () => {
        unsubscribe()
        if (saveTimeoutRef.current) clearTimeout(saveTimeoutRef.current)
      }
    }, [editor, disableAutoSave, saveDebounce])

    /**
     * Handle editor mount
     */
    const handleMount = useCallback((mountedEditor: Editor) => {
      setEditor(mountedEditor)

      // Configure editor
      mountedEditor.updateInstanceState({
        isGridMode: true,
      })

      mountedEditor.user.updateUserPreferences({
        isDynamicSizeMode: false,
      })

      // Notify parent
      if (onEditorReady) {
        onEditorReady(mountedEditor)
      }
    }, [onEditorReady])

    if (loading) {
      return (
        <div className={`w-full h-full flex items-center justify-center bg-muted/10 ${className}`}>
          <div className="flex flex-col items-center gap-3">
            <Loader2 className="h-8 w-8 animate-spin text-primary" />
            <p className="text-sm text-muted-foreground">Loading canvas...</p>
          </div>
        </div>
      )
    }

    return (
      <div className={`w-full h-full ${className}`}>
        <style>{`
          .permaculture-canvas .tlui-layout__top__right {
            justify-content: flex-end;
            padding-bottom: 8px;
          }
        `}</style>
        <Tldraw
          shapeUtils={permacultureShapes}
          tools={permacultureTools}
          onMount={handleMount}
          hideUi={false}
          className="permaculture-canvas"
          autoFocus
        />
      </div>
    )
  }
)

PermacultureCanvasIntegratedInner.displayName = 'PermacultureCanvasIntegrated'

/**
 * Exported component with error boundary and ref forwarding
 */
export const PermacultureCanvasIntegrated = forwardRef<PermacultureCanvasHandle, PermacultureCanvasIntegratedProps>(
  (props, ref) => {
    return (
      <CanvasErrorBoundary>
        <PermacultureCanvasIntegratedInner {...props} ref={ref} />
      </CanvasErrorBoundary>
    )
  }
)

PermacultureCanvasIntegrated.displayName = 'PermacultureCanvasIntegrated'
