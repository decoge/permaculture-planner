'use client'

import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { api } from '@/lib/api/http'
import { Database } from '@/types/database.types'

type Task = Database['public']['Tables']['tasks']['Row']

interface PlanClientProps {
  tasks: Task[]
  planId: string
  onTasksUpdate: (tasks: Task[]) => void
}

export function PlanClient({ tasks: initialTasks, planId, onTasksUpdate }: PlanClientProps) {
  const [tasks, setTasks] = useState<Task[]>(initialTasks)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const toggleTask = async (taskId: string) => {
    setLoading(true)
    setError(null)

    try {
      const task = tasks.find(t => t.id === taskId)
      if (!task) return

      await api(`/api/tasks/${taskId}`, {
        method: 'PATCH',
        body: JSON.stringify({ completed: !task.completed }),
      })
      const error = null

      if (error) {
        setError('Failed to update task')
        return
      }

      // Update local state
      const updatedTasks = tasks.map(t =>
        t.id === taskId ? { ...t, completed: !t.completed } : t
      )
      setTasks(updatedTasks)
      onTasksUpdate(updatedTasks)
    } catch (error) {
      console.error('Error updating task:', error)
      setError('Failed to update task')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div>
      {error && (
        <Alert variant="destructive" className="mb-4">
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      {/* Task interaction buttons could go here */}
      {tasks.length > 0 && (
        <div className="mt-4">
          <p className="text-sm text-gray-600">
            Tasks completed: {tasks.filter(t => t.completed).length} of {tasks.length}
          </p>
        </div>
      )}
    </div>
  )
}