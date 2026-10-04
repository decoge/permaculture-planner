'use client'

import { ScrollArea } from '@/components/ui/scroll-area'
import { TasksToolCard } from '@/components/garden/garden-tool-panels'
import { GardenTools } from '@/lib/garden/garden-tools'

export function TasksPanel({ tools }: { tools: GardenTools | null }) {
  return (
    <ScrollArea className="h-full">
      <div className="p-3">
        <TasksToolCard tools={tools} />
      </div>
    </ScrollArea>
  )
}
