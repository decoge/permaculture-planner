'use client'

import { ScrollArea } from '@/components/ui/scroll-area'
import { TimelineToolCard } from '@/components/garden/garden-tool-panels'
import { GardenTools } from '@/lib/garden/garden-tools'

export function SeasonalTimelinePanel({ tools }: { tools: GardenTools | null }) {
  return (
    <ScrollArea className="h-full">
      <div className="p-3">
        <TimelineToolCard tools={tools} />
      </div>
    </ScrollArea>
  )
}
