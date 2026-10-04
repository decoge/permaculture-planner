'use client'

import { ScrollArea } from '@/components/ui/scroll-area'
import { SunToolCard } from '@/components/garden/garden-tool-panels'
import { GardenTools } from '@/lib/garden/garden-tools'

export function SunAnalysisPanel({ tools }: { tools: GardenTools | null }) {
  return (
    <ScrollArea className="h-full">
      <div className="p-3">
        <SunToolCard tools={tools} />
      </div>
    </ScrollArea>
  )
}
