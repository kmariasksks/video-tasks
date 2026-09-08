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