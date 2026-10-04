'use client'

import { TimelineToolCard } from '@/components/garden/garden-tool-panels'
import { GardenTools } from '@/lib/garden/garden-tools'

export function SeasonalTimelinePanel({ tools }: { tools: GardenTools | null }) {
  return (
    <div className="min-h-0 flex-1 overflow-y-auto">
      <div className="p-3">
        <TimelineToolCard tools={tools} />
      </div>
    </div>
  )
}
