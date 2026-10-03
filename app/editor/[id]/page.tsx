import { redirect } from 'next/navigation'
import { requireUser } from '@/lib/auth/guard'
import { getPlanDetail } from '@/lib/db/gardens'
import { EditorClient } from './editor-client'

export const dynamic = 'force-dynamic'

export default async function EditorPage({
  params,
}: {
  params: { id: string } | Promise<{ id: string }>
}) {
  const { id } = await params
  const user = await requireUser()

  if (!user) {
    redirect('/auth/login')
  }

  const plan = await getPlanDetail(user.id, id)
  if (!plan) {
    redirect('/dashboard')
  }

  return <EditorClient plan={plan} />
}
