'use client'

import { ScrollArea } from '@/components/ui/scroll-area'
import { SuccessionToolCard } from '@/components/garden/garden-tool-panels'
import { GardenTools } from '@/lib/garden/garden-tools'

export function SuccessionPlanningPanel({ tools }: { tools: GardenTools | null }) {
  return (
    <ScrollArea className="h-full">
      <div className="p-3">
        <SuccessionToolCard tools={tools} />
      </div>
    </ScrollArea>
  )
}
