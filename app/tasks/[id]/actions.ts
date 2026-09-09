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

export type TimelineResult =
  | { success: true }
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
    const { error: storageError } = await admin.storage
      .from('source-videos')
      .remove([task.source_video_path])

    if (storageError) {
      console.error('[deleteTaskVideo] storage error:', JSON.stringify(storageError))
    }
  }

  const { error: versionsError } = await admin
    .from('versions')
    .delete()
    .eq('task_id', taskId)

  if (versionsError) {
    console.error('[deleteTaskVideo] versions delete:', JSON.stringify(versionsError))
  }

  const { error: scenesError } = await admin
    .from('scenes')
    .delete()
    .eq('task_id', taskId)

  if (scenesError) {
    console.error('[deleteTaskVideo] scenes delete:', JSON.stringify(scenesError))
  }

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

  if (segmentsToInsert.length > 0) {
    const { error: segmentsError } = await admin
      .from('version_segments')
      .insert(segmentsToInsert)

    if (segmentsError) {
      console.error('[createVersion] segments error:', JSON.stringify(segmentsError))
    }
  }

  revalidatePath(`/tasks/${taskId}`)

  return {
    success: true,
    versionId: newVersion.id,
    versionNumber: nextVersionNumber,
  }
}

/**
 * Замінює всі сегменти версії новими.
 * Використовуємо для reorder, видалення, розрізу — всіх мутацій таймлайну.
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

  for (const seg of segments) {
    if (seg.start_sec >= seg.end_sec) {
      return { success: false, error: 'Некоректний сегмент: start >= end' }
    }
    if (seg.start_sec < 0) {
      return { success: false, error: 'Некоректний сегмент: start < 0' }
    }
  }

  const { error: deleteError } = await admin
    .from('version_segments')
    .delete()
    .eq('version_id', versionId)

  if (deleteError) {
    console.error('[replaceVersionSegments] delete error:', JSON.stringify(deleteError))
    return { success: false, error: 'Не вдалося очистити сегменти' }
  }

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
 * Скидає таймлайн версії до дефолту — копіює всі сцени як сегменти.
 */
export async function resetVersionToAutoDetect(
  taskId: string,
  versionId: string
): Promise<TimelineResult> {
  const supabase = await createClient()

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