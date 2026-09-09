'use server'

import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { revalidatePath } from 'next/cache'

export type UploadResult =
  | { success: true }
  | { success: false; error: string }

export type DeleteVideoResult =
  | { success: true }
  | { success: false; error: string }

export type CreateVersionResult =
  | { success: true; versionId: string; versionNumber: number }
  | { success: false; error: string }

export async function saveUploadedVideo(
  taskId: string,
  storagePath: string
): Promise<UploadResult> {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) return { success: false, error: 'Не залогінені' }

  const { error } = await supabase
    .from('tasks')
    .update({ source_video_path: storagePath })
    .eq('id', taskId)

  if (error) {
    console.error('[saveUploadedVideo] db error:', JSON.stringify(error))
    return { success: false, error: 'Не вдалося зберегти шлях до відео' }
  }

  revalidatePath(`/tasks/${taskId}`)
  return { success: true }
}

export async function deleteTaskVideo(
  taskId: string
): Promise<DeleteVideoResult> {
  const supabase = await createClient()
  const admin = createAdminClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) return { success: false, error: 'Не залогінені' }

  const { data: task, error: fetchError } = await supabase
    .from('tasks')
    .select('source_video_path')
    .eq('id', taskId)
    .single()

  if (fetchError || !task) {
    return { success: false, error: 'Задачу не знайдено' }
  }

  if (task.source_video_path) {
    // 1. Видаляємо файл зі Storage
    const { error: storageError } = await admin.storage
      .from('source-videos')
      .remove([task.source_video_path])

    if (storageError) {
      console.error('[deleteTaskVideo] storage error:', JSON.stringify(storageError))
    }
  }

  // 2. Видаляємо всі версії задачі (каскадно видаляться і segments)
  const { error: versionsError } = await admin
    .from('versions')
    .delete()
    .eq('task_id', taskId)

  if (versionsError) {
    console.error('[deleteTaskVideo] versions delete:', JSON.stringify(versionsError))
  }

  // 3. Видаляємо сцени
  const { error: scenesError } = await admin
    .from('scenes')
    .delete()
    .eq('task_id', taskId)

  if (scenesError) {
    console.error('[deleteTaskVideo] scenes delete:', JSON.stringify(scenesError))
  }

  // 4. Обнуляємо посилання і тривалість
  const { error: updateError } = await supabase
    .from('tasks')
    .update({
      source_video_path: null,
      source_video_duration_sec: null,
    })
    .eq('id', taskId)

  if (updateError) {
    console.error('[deleteTaskVideo] update error:', JSON.stringify(updateError))
    return { success: false, error: 'Не вдалося оновити задачу' }
  }

  revalidatePath(`/tasks/${taskId}`)
  return { success: true }
}

/**
 * Створює нову версію.
 * Якщо переданий copyFromVersionId — копіює segments звідти.
 * Інакше копіює з базових scenes (для першої версії).
 */
export async function createVersion(
  taskId: string,
  copyFromVersionId?: string
): Promise<CreateVersionResult> {
  const supabase = await createClient()
  const admin = createAdminClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) return { success: false, error: 'Не залогінені' }

  // 1. Отримуємо найбільший version_number
  const { data: existingVersions } = await supabase
    .from('versions')
    .select('version_number')
    .eq('task_id', taskId)
    .order('version_number', { ascending: false })
    .limit(1)

  const nextVersionNumber =
    existingVersions && existingVersions.length > 0
      ? existingVersions[0].version_number + 1
      : 1

  // 2. Створюємо саму версію
  const { data: newVersion, error: versionError } = await admin
    .from('versions')
    .insert({
      task_id: taskId,
      version_number: nextVersionNumber,
      name: `v${nextVersionNumber}`,
      render_status: 'pending',
    })
    .select('id')
    .single()

  if (versionError || !newVersion) {
    console.error('[createVersion] insert error:', JSON.stringify(versionError))
    return { success: false, error: 'Не вдалося створити версію' }
  }

  // 3. Готуємо сегменти — або копія з іншої версії, або з базових scenes
  let segmentsToInsert: Array<{
    version_id: string
    source_scene_id: string | null
    position: number
    start_sec: number
    end_sec: number
  }> = []

  if (copyFromVersionId) {
    const { data: sourceSegments } = await supabase
      .from('version_segments')
      .select('source_scene_id, position, start_sec, end_sec')
      .eq('version_id', copyFromVersionId)
      .order('position', { ascending: true })

    if (sourceSegments) {
      segmentsToInsert = sourceSegments.map((s, i) => ({
        version_id: newVersion.id,
        source_scene_id: s.source_scene_id,
        position: i,
        start_sec: s.start_sec,
        end_sec: s.end_sec,
      }))
    }
  } else {
    // Перша версія — беремо з базових сцен
    const { data: scenes } = await supabase
      .from('scenes')
      .select('id, scene_index, start_sec, end_sec')
      .eq('task_id', taskId)
      .order('scene_index', { ascending: true })

    if (scenes) {
      segmentsToInsert = scenes.map((s, i) => ({
        version_id: newVersion.id,
        source_scene_id: s.id,
        position: i,
        start_sec: s.start_sec,
        end_sec: s.end_sec,
      }))
    }
  }

  // 4. Вставляємо сегменти (може бути порожньо, якщо нема ні джерела ні сцен)
  if (segmentsToInsert.length > 0) {
    const { error: segmentsError } = await admin
      .from('version_segments')
      .insert(segmentsToInsert)

    if (segmentsError) {
      console.error('[createVersion] segments error:', JSON.stringify(segmentsError))
      // Не критично — версія створена, юзер може додати сегменти вручну
    }
  }

  revalidatePath(`/tasks/${taskId}`)

  return {
    success: true,
    versionId: newVersion.id,
    versionNumber: nextVersionNumber,
  }
}