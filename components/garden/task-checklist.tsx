'use client'

import { useState } from 'react'
import { api } from '@/lib/api/http'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Checkbox } from '@/components/ui/checkbox'
import { Label } from '@/components/ui/label'
import { CheckSquare } from 'lucide-react'

interface TaskItem {
  id: string
  title: string
  due_on: string
  category: string
  completed: boolean
  description?: string | null
}

interface TaskChecklistProps {
  planId: string
  initialTasks: TaskItem[]
}

export function TaskChecklist({ planId, initialTasks }: TaskChecklistProps) {
  const [tasks, setTasks] = useState<TaskItem[]>(initialTasks)
  const [pendingId, setPendingId] = useState<string | null>(null)
  const [failedId, setFailedId] = useState<string | null>(null)

  const toggle = async (task: TaskItem) => {
    const next = !task.completed
    // Optimistic flip so the checkbox responds immediately; rolled back if the
    // server rejects it.
    setTasks((prev) => prev.map((t) => (t.id === task.id ? { ...t, completed: next } : t)))
    setPendingId(task.id)
    setFailedId(null)

    try {
      await api(`/api/tasks/${task.id}`, {
        method: 'PATCH',
        body: JSON.stringify({ completed: next }),
      })
    } catch {
      setTasks((prev) => prev.map((t) => (t.id === task.id ? { ...t, completed: !next } : t)))
      setFailedId(task.id)
    } finally {
      setPendingId(null)
    }
  }

  if (tasks.length === 0) {
    return (
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base flex items-center">
            <CheckSquare className="h-4 w-4 mr-2" />
            Tasks
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-gray-600">No tasks yet for this plan.</p>
        </CardContent>
      </Card>
    )
  }

  const done = tasks.filter((task) => task.completed).length

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-base flex items-center">
          <CheckSquare className="h-4 w-4 mr-2" />
          Tasks
        </CardTitle>
        <CardDescription>
          {done} of {tasks.length} done
        </CardDescription>
      </CardHeader>
      <CardContent>
        <div className="space-y-2">
          {tasks.map((task) => (
            <div key={task.id} className="flex items-start space-x-2">
              <Checkbox
                id={`task-${task.id}`}
                checked={task.completed}
                disabled={pendingId === task.id}
                onCheckedChange={() => toggle(task)}
                className="mt-0.5"
              />
              <Label
                htmlFor={`task-${task.id}`}
                className={`cursor-pointer text-sm font-normal ${task.completed ? 'line-through text-gray-400' : ''}`}
              >
                {task.title}
                <span className="block text-xs text-gray-500">
                  {task.category} · due {task.due_on}
                  {failedId === task.id ? ' · save failed, try again' : ''}
                </span>
              </Label>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  )
}
