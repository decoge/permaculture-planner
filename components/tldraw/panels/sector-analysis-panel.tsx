'use client'

import { ScrollArea } from '@/components/ui/scroll-area'
import { SectorToolCard } from '@/components/garden/garden-tool-panels'
import { GardenTools } from '@/lib/garden/garden-tools'

export function SectorAnalysisPanel({ tools }: { tools: GardenTools | null }) {
  return (
    <ScrollArea className="h-full">
      <div className="p-3">
        <SectorToolCard tools={tools} />
      </div>
    </ScrollArea>
  )
}
