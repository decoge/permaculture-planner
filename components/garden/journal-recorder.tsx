'use client'

import { useState } from 'react'
import { api } from '@/lib/api/http'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { BookOpen, Trash2, Loader2 } from 'lucide-react'

export interface JournalRecord {
  id: string
  title: string | null
  content: string
  createdAt: string
}

interface JournalRecorderProps {
  planId: string
  entries: JournalRecord[]
}

/**
 * Write journal entries for a plan. The facts panels already read journal
 * entries; this is the write path they never had.
 */
export function JournalRecorder({ planId, entries }: JournalRecorderProps) {
  const [title, setTitle] = useState('')
  const [content, setContent] = useState('')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [items, setItems] = useState<JournalRecord[]>(entries)
  const [deletingId, setDeletingId] = useState<string | null>(null)

  const submit = async () => {
    if (!content.trim()) return
    setSaving(true)
    setError(null)
    try {
      await api('/api/journal', {
        method: 'POST',
        body: JSON.stringify({ planId, title: title.trim() || null, content: content.trim() }),
      })
      setItems((prev) => [
        ...prev,
        {
          id: `local-${Date.now()}`,
          title: title.trim() || null,
          content: content.trim(),
          createdAt: new Date().toISOString(),
        },
      ])
      setTitle('')
      setContent('')
    } catch {
      setError('Could not save the entry. Try again.')
    } finally {
      setSaving(false)
    }
  }

  const remove = async (id: string) => {
    if (id.startsWith('local-')) {
      setItems((prev) => prev.filter((entry) => entry.id !== id))
      return
    }
    setDeletingId(id)
    try {
      await api(`/api/journal/${id}`, { method: 'DELETE' })
      setItems((prev) => prev.filter((entry) => entry.id !== id))
    } catch {
      setError('Could not delete the entry.')
    } finally {
      setDeletingId(null)
    }
  }

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-base flex items-center">
          <BookOpen className="h-4 w-4 mr-2" />
          Garden Journal
        </CardTitle>
        <CardDescription>
          {items.length === 0 ? 'Notes, observations, weather — whatever the garden taught you.' : `${items.length} entr${items.length === 1 ? 'y' : 'ies'}`}
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-3">
        {items.length > 0 && (
          <div className="space-y-2 max-h-60 overflow-y-auto">
            {items.map((entry) => (
              <div key={entry.id} className="flex items-start justify-between gap-2 text-sm border-b pb-2 last:border-b-0">
                <div>
                  {entry.title && <p className="font-medium">{entry.title}</p>}
                  <p className="text-gray-600 whitespace-pre-wrap">{entry.content}</p>
                  <span className="block text-xs text-gray-500">
                    {entry.createdAt ? new Date(entry.createdAt).toLocaleDateString() : ''}
                  </span>
                </div>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => remove(entry.id)}
                  disabled={deletingId === entry.id}
                  aria-label="Delete entry"
                >
                  {deletingId === entry.id ? <Loader2 className="h-3 w-3 animate-spin" /> : <Trash2 className="h-3 w-3" />}
                </Button>
              </div>
            ))}
          </div>
        )}

        <div className="space-y-2 border-t pt-3">
          <div className="space-y-1">
            <Label htmlFor="journal-title" className="text-xs">Title (optional)</Label>
            <Input
              id="journal-title"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="e.g. First frost damage"
              className="h-8"
            />
          </div>
          <div className="space-y-1">
            <Label htmlFor="journal-content" className="text-xs">Entry</Label>
            <Textarea
              id="journal-content"
              value={content}
              onChange={(e) => setContent(e.target.value)}
              placeholder="What happened in the garden?"
              rows={3}
            />
          </div>
          {error && <p className="text-xs text-red-600">{error}</p>}
          <Button size="sm" onClick={submit} disabled={saving || !content.trim()} className="w-full bg-green-600 hover:bg-green-700">
            {saving && <Loader2 className="h-3 w-3 mr-1 animate-spin" />}
            Save entry
          </Button>
        </div>
      </CardContent>
    </Card>
  )
}
