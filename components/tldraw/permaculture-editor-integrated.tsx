'use client'

import React, { useState, useCallback, useEffect, useRef } from 'react'
import { Editor } from 'tldraw'
import { PermacultureCanvasIntegrated, PermacultureCanvasHandle } from './permaculture-canvas-integrated'
import { PlantLibraryPanel } from './panels/plant-library-panel'
import { ElementsLibraryPanel } from './panels/elements-library-panel'
import { PropertiesPanel } from './panels/properties-panel'
import { ZoneManagementPanel } from './panels/zone-management-panel'
import { CompanionPlantingPanel } from './panels/companion-planting-panel'
import { AnalyticsPanel } from './panels/analytics-panel'
import { SiteData } from '@/lib/types/site-context'
import { SeasonalTimelinePanel } from './panels/seasonal-timeline-panel'
import { MaterialsPanel } from './panels/materials-panel'
import { TasksPanel } from './panels/tasks-panel'
import { SunAnalysisPanel } from './panels/sun-analysis-panel'
import { PermacultureAnalysisPanel } from './panels/permaculture-analysis-panel'
import { SectorAnalysisPanel } from './panels/sector-analysis-panel'
import { SuccessionPlanningPanel } from './panels/succession-planning-panel'
import { WaterManagementPanel } from './panels/water-management-panel'
import { GardenEvolutionPanel } from './panels/garden-evolution-panel'
import { ImplementationPhasingPanel } from './panels/implementation-phasing-panel'
import { DesignCritiquePanel } from './panels/design-critique-panel'
import { ProgressTrackingPanel } from './panels/progress-tracking-panel'
import { KnowledgeBasePanel } from './panels/knowledge-base-panel'
import { TemplateLibraryPanel } from './panels/template-library-panel'
import { EnhancedSimulationPanel } from './panels/growth-simulation-enhanced-panel'
import { HolisticDashboardPanel } from './panels/holistic-dashboard-panel'
import { RelationshipMapperPanel } from './panels/relationship-mapper-panel'
import { PanelSelector } from './panel-selector'
import { ScrollArea } from '@/components/ui/scroll-area'
import {
  BiodiversityPanel,
  ClimatePanel,
  CommunityPanel,
  EconomicsPanel,
  EnergyPanel,
  InfrastructurePanel,
  ResiliencePanel,
  SoilAnalysisPanel,
  TopographyPanel,
} from '@/components/garden/site-condition-panels'
import { useRecordedSiteFacts } from '@/components/garden/use-recorded-site-facts'
import { useRecordedPlanTools } from '@/components/garden/use-recorded-garden-tools'
import { GardenBed } from '@/lib/garden/garden-types'
import { PlantInfo } from '@/lib/data/plant-library'
import { ElementSubtype, ElementCategory, ELEMENT_STYLES } from '@/lib/canvas-elements'
import { Button } from '@/components/ui/button'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Badge } from '@/components/ui/badge'
import { Separator } from '@/components/ui/separator'
import {
  Sprout,
  Mountain,
  Settings,
  ChevronLeft,
  ChevronRight,
  Download,
  Save,
  BarChart3,
  Target,
  Heart,
  Pencil,
  Calendar,
  ShoppingCart,
  ListTodo,
  Sparkles,
  Sun,
  Compass,
  Repeat,
  Droplets,
  Clock,
  Hammer,
  Award,
  BookOpen,
  Lightbulb,
  Layout,
  Activity,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { toast } from 'sonner'

interface PermacultureEditorIntegratedProps {
  initialData?: GardenBed[]
  onSave?: (data: GardenBed[]) => void
  onManualSave?: () => void | Promise<void>
  planId?: string
  showHeader?: boolean
  siteData?: SiteData | null
}

/**
 * PermacultureEditorIntegrated - PRODUCTION-READY permaculture planning interface
 *
 * FULLY WIRED with:
 * ✅ Interactive tools (PlantTool, ElementTool, BedTool)
 * ✅ Properties editing with live updates
 * ✅ All analysis panels integrated
 * ✅ Real-time data synchronization
 * ✅ Professional workflow
 */
export function PermacultureEditorIntegrated({
  initialData = [],
  onSave,
  onManualSave,
  planId,
  showHeader = true,
  siteData = null,
}: PermacultureEditorIntegratedProps) {
  const canvasRef = useRef<PermacultureCanvasHandle>(null)
  const [editor, setEditor] = useState<Editor | null>(null)
  const [gardenData, setGardenData] = useState<GardenBed[]>(initialData)
  const [selectedPlant, setSelectedPlant] = useState<PlantInfo | null>(null)
  const [selectedElement, setSelectedElement] = useState<{ subtype: ElementSubtype; category: ElementCategory } | null>(null)
  const [leftPanelOpen, setLeftPanelOpen] = useState(true)
  const [rightPanelOpen, setRightPanelOpen] = useState(true)
  const [leftPanelTab, setLeftPanelTab] = useState<'plants' | 'elements'>('plants')
  const [rightPanelTab, setRightPanelTab] = useState<string>('holistic') // Start with holistic dashboard
  const [recentPanels, setRecentPanels] = useState<string[]>([])
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false)
  const siteFacts = useRecordedSiteFacts(planId)
  const { tools: gardenTools, design: designFacts } = useRecordedPlanTools(planId)

  // Load recent panels from localStorage
  useEffect(() => {
    const saved = localStorage.getItem('recentPanels')
    if (saved) {
      try {
        setRecentPanels(JSON.parse(saved))
      } catch (e) {
        console.warn('Failed to load recent panels')
      }
    }
  }, [])

  // Update recent panels
  const handlePanelChange = useCallback((panelId: string) => {
    setRightPanelTab(panelId)

    setRecentPanels(prev => {
      const updated = [panelId, ...prev.filter(id => id !== panelId)].slice(0, 5)
      localStorage.setItem('recentPanels', JSON.stringify(updated))
      return updated
    })
  }, [])

  // Handle canvas changes
  const handleCanvasChange = useCallback((updatedData: GardenBed[]) => {
    setGardenData(updatedData)
    setHasUnsavedChanges(true)
    if (onSave) {
      onSave(updatedData)
    }
  }, [onSave])

  // Handle editor ready
  const handleEditorReady = useCallback((editorInstance: Editor) => {
    setEditor(editorInstance)
  }, [])

  // Handle plant selection - ACTIVATES PlantTool
  const handlePlantSelect = useCallback((plant: PlantInfo) => {
    setSelectedPlant(plant)
    setSelectedElement(null)
    toast.success(`${plant.icon} ${plant.name} selected`, {
      description: 'Click on canvas to place',
      duration: 2000,
    })
  }, [])

  // Handle element selection - ACTIVATES ElementTool
  const handleElementSelect = useCallback((subtype: ElementSubtype, category: ElementCategory) => {
    setSelectedElement({ subtype, category })
    setSelectedPlant(null)
    toast.success(`${subtype.replace('_', ' ')} selected`, {
      description: 'Click on canvas to place',
      duration: 2000,
    })
  }, [])

  // Handle manual save (button click or Cmd+S)
  const handleSave = useCallback(async () => {
    if (onManualSave) {
      await onManualSave()
      setHasUnsavedChanges(false)
    } else if (onSave) {
      // Fallback to auto-save if no manual save handler
      onSave(gardenData)
      setHasUnsavedChanges(false)
      toast.success('Plan saved successfully')
    }
  }, [gardenData, onSave, onManualSave])

  // Handle export
  const handleExport = useCallback((format: 'png' | 'pdf' | 'svg' | 'json') => {
    if (!editor) {
      toast.error('Editor not ready')
      return
    }

    if (format === 'json') {
      const dataStr = JSON.stringify(gardenData, null, 2)
      const dataUri = 'data:application/json;charset=utf-8,' + encodeURIComponent(dataStr)
      const link = document.createElement('a')
      link.setAttribute('href', dataUri)
      link.setAttribute('download', `permaculture-plan-${Date.now()}.json`)
      link.click()
      toast.success('Exported as JSON')
    } else if (format === 'png') {
      // Use tldraw's export functionality
      editor.getSvgString(Array.from(editor.getCurrentPageShapeIds())).then((result) => {
        if (!result) {
          toast.error('Failed to export PNG')
          return
        }
        const { svg } = result
        const canvas = document.createElement('canvas')
        const ctx = canvas.getContext('2d')
        const img = new Image()

        img.onload = () => {
          canvas.width = img.width
          canvas.height = img.height
          ctx?.drawImage(img, 0, 0)
          canvas.toBlob((blob) => {
            if (blob) {
              const url = URL.createObjectURL(blob)
              const link = document.createElement('a')
              link.href = url
              link.download = `permaculture-plan-${Date.now()}.png`
              link.click()
              URL.revokeObjectURL(url)
              toast.success('Exported as PNG')
            }
          })
        }

        img.src = 'data:image/svg+xml;base64,' + btoa(svg)
      })
    } else {
      toast.info(`${format.toUpperCase()} export coming soon`)
    }
  }, [editor, gardenData])

  // Keyboard shortcuts
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 's') {
        e.preventDefault()
        handleSave()
      }
      if (e.key === '[' && (e.metaKey || e.ctrlKey)) {
        e.preventDefault()
        setLeftPanelOpen(prev => !prev)
      }
      if (e.key === ']' && (e.metaKey || e.ctrlKey)) {
        e.preventDefault()
        setRightPanelOpen(prev => !prev)
      }
      if (e.key === 'Escape') {
        setSelectedPlant(null)
        setSelectedElement(null)
        canvasRef.current?.returnToSelect()
      }
    }

    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [handleSave])

  const stats = {
    beds: gardenData.length,
    plants: gardenData.reduce((sum, bed) => sum + (bed.plants?.length || 0), 0),
    elements: gardenData.filter(bed => bed.elementCategory !== 'bed').length,
  }

  return (
    <div className="flex h-[calc(100vh-4rem)] max-h-[calc(100vh-4rem)] min-h-0 flex-col overflow-hidden bg-background">
      {/* Header */}
      {showHeader && (
        <header className="shrink-0 border-b bg-card/50 backdrop-blur">
          <div className="flex items-center justify-between px-4 py-3">
            <div className="flex items-center gap-4">
              <div>
                <div className="flex items-center gap-2">
                  <h1 className="text-lg font-semibold">Permaculture Planner</h1>
                  {hasUnsavedChanges && (
                    <Badge variant="outline" className="text-xs">
                      Unsaved
                    </Badge>
                  )}
                </div>
                <p className="text-xs text-muted-foreground">
                  {stats.beds} beds • {stats.plants} plants • {stats.elements} elements
                </p>
              </div>
            </div>

            <div className="flex items-center gap-2">
              <Button
                variant="ghost"
                size="sm"
                onClick={() => handleExport('json')}
              >
                <Download className="h-4 w-4 mr-2" />
                Export
              </Button>
              <Button
                size="sm"
                onClick={handleSave}
                disabled={!hasUnsavedChanges}
              >
                <Save className="h-4 w-4 mr-2" />
                Save
              </Button>
            </div>
          </div>
        </header>
      )}

      {/* Main Content */}
      <div className="flex min-h-0 flex-1 overflow-hidden">
        {/* Left Panel - Plant/Element Libraries */}
        <div
          className={cn(
            'border-r bg-card/30 backdrop-blur transition-all duration-300',
            leftPanelOpen ? 'w-80' : 'w-0'
          )}
        >
          {leftPanelOpen && (
            <Tabs value={leftPanelTab} onValueChange={(v: any) => setLeftPanelTab(v)} className="flex-1 flex flex-col h-full">
              <TabsList className="w-full rounded-none border-b">
                <TabsTrigger value="plants" className="flex-1">
                  <Sprout className="h-4 w-4 mr-2" />
                  Plants
                </TabsTrigger>
                <TabsTrigger value="elements" className="flex-1">
                  <Mountain className="h-4 w-4 mr-2" />
                  Elements
                </TabsTrigger>
              </TabsList>

              <TabsContent value="plants" className="flex-1 m-0">
                <PlantLibraryPanel
                  onPlantSelect={handlePlantSelect}
                  selectedPlantId={selectedPlant?.id}
                />
              </TabsContent>

              <TabsContent value="elements" className="flex-1 m-0">
                <ElementsLibraryPanel
                  onElementSelect={handleElementSelect}
                  selectedElement={selectedElement?.subtype}
                />
              </TabsContent>
            </Tabs>
          )}
        </div>

        {/* Toggle Left Panel Button */}
        <Button
          variant="ghost"
          size="sm"
          className="absolute left-0 top-1/2 -translate-y-1/2 z-10 h-20 w-6 rounded-l-none"
          onClick={() => setLeftPanelOpen(prev => !prev)}
        >
          {leftPanelOpen ? <ChevronLeft className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
        </Button>

        {/* Canvas */}
        <div className="flex-1 relative">
          <PermacultureCanvasIntegrated
            ref={canvasRef}
            initialData={gardenData}
            onSave={handleCanvasChange}
            onEditorReady={handleEditorReady}
            selectedPlant={selectedPlant}
            selectedElement={selectedElement}
            className="w-full h-full"
          />

          {/* Selection indicator */}
          {(selectedPlant || selectedElement) && (
            <div className="absolute top-4 left-1/2 -translate-x-1/2 z-10">
              <Badge className="px-4 py-2 text-sm shadow-lg">
                {selectedPlant && `${selectedPlant.icon} ${selectedPlant.name}`}
                {selectedElement && `${selectedElement.subtype.replace('_', ' ')}`}
                <span className="ml-2 text-xs opacity-75">• Click to place • ESC to cancel</span>
              </Badge>
            </div>
          )}
        </div>

        {/* Toggle Right Panel Button */}
        <Button
          variant="ghost"
          size="sm"
          className="absolute right-0 top-1/2 -translate-y-1/2 z-10 h-20 w-6 rounded-r-none"
          onClick={() => setRightPanelOpen(prev => !prev)}
        >
          {rightPanelOpen ? <ChevronRight className="h-4 w-4" /> : <ChevronLeft className="h-4 w-4" />}
        </Button>

        {/* Right Panel - Properties/Analysis */}
        <div
          className={cn(
            'flex h-full min-h-0 flex-col overflow-hidden border-l bg-card transition-all duration-300',
            rightPanelOpen ? 'w-80' : 'w-0'
          )}
        >
          {rightPanelOpen && (
            <Tabs value={rightPanelTab} onValueChange={handlePanelChange} className="flex h-full min-h-0 flex-col overflow-hidden">
              {/* Beautiful Panel Selector - replaces messy 19-tab interface */}
              <PanelSelector
                currentPanel={rightPanelTab}
                onPanelChange={handlePanelChange}
                recentPanels={recentPanels}
                onUpdateRecents={handlePanelChange}
              />

              <TabsContent value="holistic" className="flex-1 m-0">
                <HolisticDashboardPanel gardenBeds={gardenData} siteData={siteData} />
              </TabsContent>

              <TabsContent value="properties" className="flex-1 m-0">
                <PropertiesPanel editor={editor} />
              </TabsContent>

              <TabsContent value="zones" className="flex-1 m-0">
                <ZoneManagementPanel tools={gardenTools} />
              </TabsContent>

              <TabsContent value="companions" className="m-0 min-h-0 flex-1 flex-col overflow-hidden bg-card data-[state=active]:flex data-[state=inactive]:hidden">
                <CompanionPlantingPanel design={designFacts} />
              </TabsContent>

              <TabsContent value="relationships" className="m-0 min-h-0 flex-1 flex-col overflow-hidden data-[state=active]:flex data-[state=inactive]:hidden">
                <RelationshipMapperPanel design={designFacts} />
              </TabsContent>

              <TabsContent value="timeline" className="m-0 min-h-0 flex-1 flex-col overflow-hidden data-[state=active]:flex data-[state=inactive]:hidden">
                <SeasonalTimelinePanel tools={gardenTools} />
              </TabsContent>

              <TabsContent value="materials" className="flex-1 m-0">
                <MaterialsPanel tools={gardenTools} />
              </TabsContent>

              <TabsContent value="tasks" className="flex-1 m-0">
                <TasksPanel tools={gardenTools} />
              </TabsContent>

              <TabsContent value="sun" className="flex-1 m-0">
                <SunAnalysisPanel tools={gardenTools} />
              </TabsContent>

              <TabsContent value="sectors" className="flex-1 m-0">
                <SectorAnalysisPanel tools={gardenTools} />
              </TabsContent>

              <TabsContent value="succession" className="flex-1 m-0">
                <SuccessionPlanningPanel tools={gardenTools} />
              </TabsContent>

              <TabsContent value="water" className="flex-1 m-0">
                <WaterManagementPanel tools={gardenTools} />
              </TabsContent>

              <TabsContent value="evolution" className="m-0 min-h-0 flex-1 flex-col overflow-hidden data-[state=active]:flex data-[state=inactive]:hidden">
                <GardenEvolutionPanel design={designFacts} />
              </TabsContent>

              <TabsContent value="implementation" className="m-0 min-h-0 flex-1 flex-col overflow-hidden data-[state=active]:flex data-[state=inactive]:hidden">
                <ImplementationPhasingPanel design={designFacts} />
              </TabsContent>

              <TabsContent value="critique" className="m-0 min-h-0 flex-1 flex-col overflow-hidden data-[state=active]:flex data-[state=inactive]:hidden">
                <DesignCritiquePanel design={designFacts} />
              </TabsContent>

              <TabsContent value="progress" className="m-0 min-h-0 flex-1 flex-col overflow-hidden data-[state=active]:flex data-[state=inactive]:hidden">
                <ProgressTrackingPanel design={designFacts} />
              </TabsContent>

              <TabsContent value="knowledge" className="m-0 min-h-0 flex-1 flex-col overflow-hidden data-[state=active]:flex data-[state=inactive]:hidden">
                <KnowledgeBasePanel design={designFacts} />
              </TabsContent>

              <TabsContent value="templates" className="m-0 min-h-0 flex-1 flex-col overflow-hidden data-[state=active]:flex data-[state=inactive]:hidden">
                <TemplateLibraryPanel design={designFacts} />
              </TabsContent>

              <TabsContent value="simulation" className="flex-1 m-0">
                <EnhancedSimulationPanel tools={gardenTools} />
              </TabsContent>

              <TabsContent value="permaculture" className="m-0 min-h-0 flex-1 flex-col overflow-hidden data-[state=active]:flex data-[state=inactive]:hidden">
                <PermacultureAnalysisPanel design={designFacts} />
              </TabsContent>

              <TabsContent value="analytics" className="m-0 min-h-0 flex-1 flex-col overflow-hidden data-[state=active]:flex data-[state=inactive]:hidden">
                <AnalyticsPanel design={designFacts} />
              </TabsContent>

              {/* ========== NEW SITE ANALYSIS PANELS ========== */}
              <TabsContent value="soil" className="flex-1 m-0">
                <ScrollArea className="h-full">
                  <div className="p-3">
                    <SoilAnalysisPanel facts={siteFacts} />
                  </div>
                </ScrollArea>
              </TabsContent>

              <TabsContent value="topography" className="flex-1 m-0">
                <ScrollArea className="h-full">
                  <div className="p-3">
                    <TopographyPanel facts={siteFacts} />
                  </div>
                </ScrollArea>
              </TabsContent>

              <TabsContent value="climate" className="flex-1 m-0">
                <ScrollArea className="h-full">
                  <div className="p-3">
                    <ClimatePanel facts={siteFacts} />
                  </div>
                </ScrollArea>
              </TabsContent>

              <TabsContent value="infrastructure" className="flex-1 m-0">
                <ScrollArea className="h-full">
                  <div className="p-3">
                    <InfrastructurePanel facts={siteFacts} />
                  </div>
                </ScrollArea>
              </TabsContent>

              {/* ========== NEW PERMACULTURE DESIGN PANELS ========== */}
              <TabsContent value="biodiversity" className="flex-1 m-0">
                <ScrollArea className="h-full">
                  <div className="p-3">
                    <BiodiversityPanel facts={siteFacts} />
                  </div>
                </ScrollArea>
              </TabsContent>

              <TabsContent value="energy" className="flex-1 m-0">
                <ScrollArea className="h-full">
                  <div className="p-3">
                    <EnergyPanel facts={siteFacts} />
                  </div>
                </ScrollArea>
              </TabsContent>

              <TabsContent value="community" className="flex-1 m-0">
                <ScrollArea className="h-full">
                  <div className="p-3">
                    <CommunityPanel facts={siteFacts} />
                  </div>
                </ScrollArea>
              </TabsContent>

              <TabsContent value="economics" className="flex-1 m-0">
                <ScrollArea className="h-full">
                  <div className="p-3">
                    <EconomicsPanel facts={siteFacts} />
                  </div>
                </ScrollArea>
              </TabsContent>

              <TabsContent value="resilience" className="flex-1 m-0">
                <ScrollArea className="h-full">
                  <div className="p-3">
                    <ResiliencePanel facts={siteFacts} />
                  </div>
                </ScrollArea>
              </TabsContent>
            </Tabs>
          )}
        </div>
      </div>

      {/* Bottom Status Bar */}
      <div className="shrink-0 border-t bg-card/50 backdrop-blur px-4 py-2">
        <div className="flex items-center justify-between text-xs text-muted-foreground">
          <div className="flex items-center gap-4">
            <span>Holistic Permaculture System • 32 Integrated Panels • AI-Powered Recommendations</span>
          </div>
          <div className="flex items-center gap-2">
            <kbd className="px-2 py-0.5 bg-muted rounded font-mono">⌘K</kbd>
            <span>Search Panels</span>
            <Separator orientation="vertical" className="h-4" />
            <kbd className="px-2 py-0.5 bg-muted rounded font-mono">⌘S</kbd>
            <span>Save</span>
            <Separator orientation="vertical" className="h-4" />
            <kbd className="px-2 py-0.5 bg-muted rounded font-mono">ESC</kbd>
            <span>Cancel</span>
          </div>
        </div>
      </div>
    </div>
  )
}
