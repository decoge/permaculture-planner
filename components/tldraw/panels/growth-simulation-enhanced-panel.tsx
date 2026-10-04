'use client'

import { ScrollArea } from '@/components/ui/scroll-area'
import { GrowthToolCard } from '@/components/garden/garden-tool-panels'
import { GardenTools } from '@/lib/garden/garden-tools'

export function EnhancedSimulationPanel({ tools }: { tools: GardenTools | null }) {
  return (
    <ScrollArea className="h-full">
      <div className="p-3">
        <GrowthToolCard tools={tools} />
      </div>
    </ScrollArea>
  )
}
