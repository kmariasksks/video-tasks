'use server'

import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
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

export type UpdateStatusResult = { success: true } | { success: false; error: string }

export async function updateTaskStatus(
  taskId: string,
  newStatus: TaskStatus
): Promise<UpdateStatusResult> {
  const supabase = await createClient()

  const { error } = await supabase
    .from('tasks')
    .update({ status: newStatus })
    .eq('id', taskId)

  if (error) {
    console.error('[updateTaskStatus] Supabase error:', JSON.stringify(error, null, 2))
    return { success: false, error: 'Не вдалося оновити статус' }
  }

  revalidatePath('/')
  return { success: true }
}

export type TimelineResult =
  | { success: true }
  | { success: false; error: string }

/**
 * Замінює всі сегменти версії новими.
 * Використовуємо для реордеру, видалення, розрізу — всіх мутацій таймлайну.
 * Це delete-then-insert підхід: простий і надійний для наших розмірів (~5-30 сегментів).
 */
export async function replaceVersionSegments(
  versionId: string,
  segments: Array<{
    source_scene_id: string | null
    position: number
    start_sec: number
    end_sec: number
  }>
): Promise<TimelineResult> {
  const supabase = await createClient()
  const admin = createAdminClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) return { success: false, error: 'Не залогінені' }

  // Валідація: сегменти мають бути валідні
  for (const seg of segments) {
    if (seg.start_sec >= seg.end_sec) {
      return { success: false, error: 'Некоректний сегмент: start >= end' }
    }
    if (seg.start_sec < 0) {
      return { success: false, error: 'Некоректний сегмент: start < 0' }
    }
  }

  // 1. Видаляємо всі поточні сегменти
  const { error: deleteError } = await admin
    .from('version_segments')
    .delete()
    .eq('version_id', versionId)

  if (deleteError) {
    console.error('[replaceVersionSegments] delete error:', JSON.stringify(deleteError))
    return { success: false, error: 'Не вдалося очистити сегменти' }
  }

  // 2. Вставляємо нові
  if (segments.length > 0) {
    const { error: insertError } = await admin
      .from('version_segments')
      .insert(
        segments.map((s) => ({
          version_id: versionId,
          source_scene_id: s.source_scene_id,
          position: s.position,
          start_sec: s.start_sec,
          end_sec: s.end_sec,
        }))
      )

    if (insertError) {
      console.error('[replaceVersionSegments] insert error:', JSON.stringify(insertError))
      return { success: false, error: 'Не вдалося зберегти сегменти' }
    }
  }

  // 3. Якщо змінили сегменти — рендер став застарілим. Скидаємо статус.
  await admin
    .from('versions')
    .update({
      render_status: 'pending',
      rendered_video_path: null,
      rendered_duration_sec: null,
      render_duration_ms: null,
      render_error: null,
    })
    .eq('id', versionId)

  // Знаходимо taskId для revalidatePath
  const { data: version } = await admin
    .from('versions')
    .select('task_id')
    .eq('id', versionId)
    .single()

  if (version) {
    revalidatePath(`/tasks/${version.task_id}`)
  }

  return { success: true }
}

/**
 * Скидає таймлайн версії до дефолту — копіює всі сцени як сегменти по порядку.
 */
export async function resetVersionToAutoDetect(
  taskId: string,
  versionId: string
): Promise<TimelineResult> {
  const supabase = await createClient()
  const admin = createAdminClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) return { success: false, error: 'Не залогінені' }

  const { data: scenes } = await supabase
    .from('scenes')
    .select('id, scene_index, start_sec, end_sec')
    .eq('task_id', taskId)
    .order('scene_index', { ascending: true })

  if (!scenes || scenes.length === 0) {
    return { success: false, error: 'Немає сцен для скидання' }
  }

  return replaceVersionSegments(
    versionId,
    scenes.map((s, i) => ({
      source_scene_id: s.id,
      position: i,
      start_sec: s.start_sec,
      end_sec: s.end_sec,
    }))
  )
}