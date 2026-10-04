'use client'

import { ScrollArea } from '@/components/ui/scroll-area'
import { MaterialsToolCard } from '@/components/garden/garden-tool-panels'
import { GardenTools } from '@/lib/garden/garden-tools'

export function MaterialsPanel({ tools }: { tools: GardenTools | null }) {
  return (
    <ScrollArea className="h-full">
      <div className="p-3">
        <MaterialsToolCard tools={tools} />
      </div>
    </ScrollArea>
  )
}