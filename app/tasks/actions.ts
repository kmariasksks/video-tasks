'use server'

import { createClient } from '@/lib/supabase/server'
import { revalidatePath } from 'next/cache'
import type { TaskStatus } from '@/types/database'

export type CreateTaskState = { error: string | null } | null

export async function createTask(
  _prevState: CreateTaskState,
  formData: FormData
): Promise<CreateTaskState> {
  const title = (formData.get('title') as string)?.trim()
  const description = (formData.get('description') as string)?.trim() || null

  if (!title) {
    return { error: 'Назва задачі не може бути пустою' }
  }

  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    return { error: 'Ви не залогінені' }
  }

  // Розрахувати наступний position — макс + 1 серед задач у todo
  const { data: existing } = await supabase
    .from('tasks')
    .select('position')
    .eq('status', 'todo')
    .order('position', { ascending: false })
    .limit(1)

  const nextPosition = existing && existing.length > 0 ? existing[0].position + 1 : 0

  const { error } = await supabase.from('tasks').insert({
    user_id: user.id,
    title,
    description,
    status: 'todo',
    position: nextPosition,
  })

  if (error) {
    console.error('[createTask] Supabase error:', error)
    return { error: 'Не вдалося створити задачу' }
  }

  revalidatePath('/')
  return null
}

export async function updateTaskStatus(taskId: string, newStatus: TaskStatus) {
  const supabase = await createClient()

  const { error } = await supabase
    .from('tasks')
    .update({ status: newStatus })
    .eq('id', taskId)

  if (error) {
    console.error('[updateTaskStatus] Supabase error:', error)
    throw new Error('Не вдалося оновити статус')
  }

  revalidatePath('/')
}