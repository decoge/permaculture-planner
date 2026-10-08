'use client'

import { useState } from 'react'
import { api } from '@/lib/api/http'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Checkbox } from '@/components/ui/checkbox'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { CheckSquare, Plus, Trash2, Loader2 } from 'lucide-react'

interface TaskItem {
  id: string
  title: string
  due_on: string
  category: string
  completed: boolean
  recurring_pattern?: string | null
  description?: string | null
}

interface TaskChecklistProps {
  planId: string
  initialTasks: TaskItem[]
}

/**
 * The plan's task list: toggle completion, edit due dates, add and delete
 * tasks, and mark tasks as recurring. Toggles are optimistic and roll back on
 * failure. Completing a recurring task asks the server to generate the next
 * occurrence, which arrives on the next load.
 */

const RECURRENCE_CHOICES = [
  { value: 'none', label: 'Does not repeat' },
  { value: 'daily', label: 'Daily' },
  { value: 'weekly', label: 'Weekly' },
  { value: 'biweekly', label: 'Every 2 weeks' },
  { value: 'monthly', label: 'Monthly' },
]

export function TaskChecklist({ planId, initialTasks }: TaskChecklistProps) {
  const [tasks, setTasks] = useState<TaskItem[]>(initialTasks)
  const [pendingId, setPendingId] = useState<string | null>(null)
  const [failedId, setFailedId] = useState<string | null>(null)
  const [adding, setAdding] = useState(false)
  const [newTitle, setNewTitle] = useState('')
  const [newDue, setNewDue] = useState('')
  const [newPattern, setNewPattern] = useState('none')
  const [creating, setCreating] = useState(false)
  const [addError, setAddError] = useState<string | null>(null)
  const [editingDueId, setEditingDueId] = useState<string | null>(null)
  const [dueDraft, setDueDraft] = useState('')

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

  const saveDueDate = async (task: TaskItem) => {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(dueDraft) || dueDraft === task.due_on) {
      setEditingDueId(null)
      return
    }
    setPendingId(task.id)
    setFailedId(null)
    const previous = task.due_on
    setTasks((prev) => prev.map((t) => (t.id === task.id ? { ...t, due_on: dueDraft } : t)))
    try {
      await api(`/api/tasks/${task.id}`, {
        method: 'PATCH',
        body: JSON.stringify({ dueOn: dueDraft }),
      })
      setEditingDueId(null)
    } catch {
      setTasks((prev) => prev.map((t) => (t.id === task.id ? { ...t, due_on: previous } : t)))
      setFailedId(task.id)
    } finally {
      setPendingId(null)
    }
  }

  const setPattern = async (task: TaskItem, pattern: string) => {
    setPendingId(task.id)
    setFailedId(null)
    try {
      await api(`/api/tasks/${task.id}`, {
        method: 'PATCH',
        body: JSON.stringify({ recurringPattern: pattern === 'none' ? null : pattern }),
      })
      setTasks((prev) =>
        prev.map((t) => (t.id === task.id ? { ...t, recurring_pattern: pattern === 'none' ? null : pattern } : t))
      )
    } catch {
      setFailedId(task.id)
    } finally {
      setPendingId(null)
    }
  }

  const remove = async (task: TaskItem) => {
    setPendingId(task.id)
    try {
      await api(`/api/tasks/${task.id}`, { method: 'DELETE' })
      setTasks((prev) => prev.filter((t) => t.id !== task.id))
    } catch {
      setFailedId(task.id)
    } finally {
      setPendingId(null)
    }
  }

  const create = async () => {
    if (!newTitle.trim() || !newDue) return
    setCreating(true)
    setAddError(null)
    try {
      const result = await api<{ id: string }>('/api/tasks/manage', {
        method: 'POST',
        body: JSON.stringify({ planId, title: newTitle.trim(), dueOn: newDue }),
      })
      setTasks((prev) => [
        ...prev,
        { id: result.id, title: newTitle.trim(), due_on: newDue, category: 'maint', completed: false },
      ])
      setNewTitle('')
      setNewDue('')
      setAdding(false)
    } catch {
      setAddError('Could not add the task.')
    } finally {
      setCreating(false)
    }
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
          {tasks.length === 0
            ? 'No tasks yet — add the first one below.'
            : `${done} of ${tasks.length} done`}
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-3">
        {tasks.length > 0 && (
          <div className="space-y-2">
            {tasks.map((task) => (
              <div key={task.id} className="flex items-start space-x-2 group">
                <Checkbox
                  id={`task-${task.id}`}
                  checked={task.completed}
                  disabled={pendingId === task.id}
                  onCheckedChange={() => toggle(task)}
                  className="mt-0.5"
                />
                <div className="flex-1">
                  <Label
                    htmlFor={`task-${task.id}`}
                    className={`cursor-pointer text-sm font-normal ${task.completed ? 'line-through text-gray-400' : ''}`}
                  >
                    {task.title}
                  </Label>
                  <div className="flex items-center gap-2 text-xs text-gray-500">
                    {editingDueId === task.id ? (
                      <input
                        type="date"
                        value={dueDraft}
                        onChange={(e) => setDueDraft(e.target.value)}
                        onBlur={() => saveDueDate(task)}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter') saveDueDate(task)
                          if (e.key === 'Escape') setEditingDueId(null)
                        }}
                        autoFocus
                        className="h-5 text-xs border rounded px-1"
                        aria-label={`Due date for ${task.title}`}
                      />
                    ) : (
                      <button
                        onClick={() => {
                          setDueDraft(task.due_on)
                          setEditingDueId(task.id)
                        }}
                        className="hover:underline"
                        title="Click to change the due date"
                      >
                        due {task.due_on}
                      </button>
                    )}
                    <span>· {task.category}</span>
                    {task.recurring_pattern && <span>· repeats {task.recurring_pattern}</span>}
                    {failedId === task.id && <span className="text-red-600">· save failed, try again</span>}
                  </div>
                  <select
                    value={task.recurring_pattern || 'none'}
                    onChange={(e) => setPattern(task, e.target.value)}
                    disabled={pendingId === task.id}
                    className="mt-1 text-xs border rounded px-1 py-0.5 bg-white"
                    aria-label={`Repeat schedule for ${task.title}`}
                  >
                    {RECURRENCE_CHOICES.map((choice) => (
                      <option key={choice.value} value={choice.value}>
                        {choice.label}
                      </option>
                    ))}
                  </select>
                </div>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => remove(task)}
                  disabled={pendingId === task.id}
                  aria-label={`Delete task: ${task.title}`}
                  className="opacity-0 group-hover:opacity-100 h-6 w-6 p-0"
                >
                  <Trash2 className="h-3 w-3 text-red-500" />
                </Button>
              </div>
            ))}
          </div>
        )}

        <div className="border-t pt-3 space-y-2">
          {adding ? (
            <>
              <Input
                value={newTitle}
                onChange={(e) => setNewTitle(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') create()
                  if (e.key === 'Escape') setAdding(false)
                }}
                placeholder="Task name"
                autoFocus
                className="h-8"
              />
              <Input
                type="date"
                value={newDue}
                onChange={(e) => setNewDue(e.target.value)}
                className="h-8"
              />
              {addError && <p className="text-xs text-red-600">{addError}</p>}
              <div className="flex gap-2">
                <Button size="sm" onClick={create} disabled={creating || !newTitle.trim() || !newDue} className="flex-1 bg-green-600 hover:bg-green-700">
                  {creating && <Loader2 className="h-3 w-3 mr-1 animate-spin" />}
                  Add
                </Button>
                <Button variant="ghost" size="sm" onClick={() => setAdding(false)}>
                  Cancel
                </Button>
              </div>
            </>
          ) : (
            <Button variant="outline" size="sm" onClick={() => setAdding(true)} className="w-full">
              <Plus className="h-3 w-3 mr-1" />
              Add task
            </Button>
          )}
        </div>
      </CardContent>
    </Card>
  )
}
