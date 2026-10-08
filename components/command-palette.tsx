'use client'

import React, { useEffect, useState, useCallback, useMemo } from 'react'
import { Command } from 'cmdk'
import { Dialog, DialogContent, DialogTitle } from '@/components/ui/dialog'
import {
  Search,
  Save,
  Download,
  FileImage,
  FileText,
  FileCode,
  Undo2,
  Redo2,
  PanelLeft,
  PanelRight,
  ZoomIn,
  ZoomOut,
  Sparkles,
} from 'lucide-react'

export interface EditorCommand {
  id: string
  label: string
  shortcut?: string
  icon: React.ComponentType<{ className?: string }>
  run: () => void
  group: string
}

interface CommandPaletteProps {
  /** Called with no arguments to check whether the editor instance is ready. */
  commands: EditorCommand[]
  open: boolean
  onOpenChange: (open: boolean) => void
}

/**
 * Editor command palette (Cmd/Ctrl+K).
 *
 * Backed by cmdk; every command comes from the editor, so entries can never
 * drift from what the editor can actually do.
 */
export function CommandPalette({ commands, open, onOpenChange }: CommandPaletteProps) {
  const [search, setSearch] = useState('')

  useEffect(() => {
    if (!open) setSearch('')
  }, [open])

  const groups = useMemo(() => {
    const byGroup = new Map<string, EditorCommand[]>()
    for (const command of commands) {
      const list = byGroup.get(command.group) || []
      list.push(command)
      byGroup.set(command.group, list)
    }
    return [...byGroup.entries()]
  }, [commands])

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[480px] p-0 overflow-hidden" aria-describedby={undefined}>
        <DialogTitle className="sr-only">Command palette</DialogTitle>
        <Command shouldFilter loop>
          <div className="flex items-center border-b px-3">
            <Search className="h-4 w-4 mr-2 text-muted-foreground" />
            <Command.Input
              value={search}
              onValueChange={setSearch}
              placeholder="Type a command..."
              className="h-11 w-full bg-transparent text-sm outline-none placeholder:text-muted-foreground"
            />
          </div>
          <Command.List className="max-h-[320px] overflow-y-auto p-1">
            <Command.Empty className="py-6 text-center text-sm text-muted-foreground">
              No matching command
            </Command.Empty>
            {groups.map(([group, groupCommands]) => (
              <Command.Group key={group} heading={group} className="px-1 py-1">
                {groupCommands.map((command) => (
                  <Command.Item
                    key={command.id}
                    value={`${command.label} ${command.id}`}
                    onSelect={() => {
                      onOpenChange(false)
                      command.run()
                    }}
                    className="flex items-center gap-2 rounded-md px-2 py-1.5 text-sm cursor-pointer aria-selected:bg-accent"
                  >
                    <command.icon className="h-4 w-4 text-muted-foreground" />
                    <span className="flex-1">{command.label}</span>
                    {command.shortcut && (
                      <kbd className="text-xs text-muted-foreground font-mono">{command.shortcut}</kbd>
                    )}
                  </Command.Item>
                ))}
              </Command.Group>
            ))}
          </Command.List>
        </Command>
      </DialogContent>
    </Dialog>
  )
}
