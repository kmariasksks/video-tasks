'use server'

import { createClient } from '@/lib/supabase/server'
import { revalidatePath } from 'next/cache'

export type UploadResult =
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

  if (!user) {
    return { success: false, error: 'Не залогінені' }
  }

  const { error } = await supabase
    .from('tasks')
    .update({
      source_video_path: storagePath,
      // duration оновимо окремим кроком (ffprobe на наступному шматку)
    })
    .eq('id', taskId)

  if (error) {
    console.error('[saveUploadedVideo] db error:', JSON.stringify(error))
    return { success: false, error: 'Не вдалося зберегти шлях до відео' }
  }

  revalidatePath(`/tasks/${taskId}`)
  return { success: true }
}

export type DeleteVideoResult =
  | { success: true }
  | { success: false; error: string }

export async function deleteTaskVideo(
  taskId: string
): Promise<DeleteVideoResult> {
  const supabase = await createClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    return { success: false, error: 'Не залогінені' }
  }

  // Отримуємо поточний шлях, щоб знати що видаляти зі Storage
  const { data: task, error: fetchError } = await supabase
    .from('tasks')
    .select('source_video_path')
    .eq('id', taskId)
    .single()

  if (fetchError || !task) {
    return { success: false, error: 'Задачу не знайдено' }
  }

  if (!task.source_video_path) {
    // Немає що видаляти — просто повертаємо success
    return { success: true }
  }

  // 1. Видаляємо файл зі Storage
  const { error: storageError } = await supabase.storage
    .from('source-videos')
    .remove([task.source_video_path])

  if (storageError) {
    console.error(
      '[deleteTaskVideo] storage error:',
      JSON.stringify(storageError)
    )
    // Продовжуємо навіть якщо Storage-видалення впало — може файл вже стерли раніше.
    // Головне очистити БД, щоб UI показав "нема відео".
  }

  // 2. Видаляємо всі знайдені сцени для цієї задачі (вони прив'язані до видаленого відео)
  const { error: scenesError } = await supabase
    .from('scenes')
    .delete()
    .eq('task_id', taskId)

  if (scenesError) {
    console.error(
      '[deleteTaskVideo] scenes delete error:',
      JSON.stringify(scenesError)
    )
  }

  // 3. Обнуляємо посилання в самій задачі
  const { error: updateError } = await supabase
    .from('tasks')
    .update({
      source_video_path: null,
      source_video_duration_sec: null,
    })
    .eq('id', taskId)

  if (updateError) {
    console.error(
      '[deleteTaskVideo] update error:',
      JSON.stringify(updateError)
    )
    return { success: false, error: 'Не вдалося оновити задачу' }
  }

  revalidatePath(`/tasks/${taskId}`)
  return { success: true }
}