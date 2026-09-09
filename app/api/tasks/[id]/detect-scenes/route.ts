import { NextResponse } from 'next/server'
import { writeFile } from 'fs/promises'
import { join } from 'path'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { probeVideo, detectScenes } from '@/lib/ffmpeg'
import { createTempDir, cleanupTempDir } from '@/lib/temp-files'
import { revalidatePath } from 'next/cache'

type RouteParams = {
  params: Promise<{ id: string }>
}

export async function POST(_request: Request, { params }: RouteParams) {
  const { id: taskId } = await params

  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    return NextResponse.json({ error: 'Не залогінені' }, { status: 401 })
  }

  const { data: task, error: taskError } = await supabase
    .from('tasks')
    .select('id, source_video_path')
    .eq('id', taskId)
    .single()

  if (taskError || !task) {
    return NextResponse.json({ error: 'Задачу не знайдено' }, { status: 404 })
  }

  if (!task.source_video_path) {
    return NextResponse.json(
      { error: 'Немає завантаженого відео' },
      { status: 400 }
    )
  }

  const tempDir = await createTempDir('scenes-')
  const localVideoPath = join(tempDir, 'video')
  const admin = createAdminClient()

  try {
    // 1. Завантажуємо файл
    const { data: fileData, error: downloadError } = await admin.storage
      .from('source-videos')
      .download(task.source_video_path)

    if (downloadError || !fileData) {
      console.error('[detect-scenes] download error:', downloadError)
      return NextResponse.json(
        { error: 'Не вдалося завантажити відео' },
        { status: 500 }
      )
    }

    await writeFile(localVideoPath, Buffer.from(await fileData.arrayBuffer()))

    // 2. Дізнаємось duration (потрібен для меж останньої сцени)
    const { duration } = await probeVideo(localVideoPath)

    // 3. Запускаємо scene detection
    const scenes = await detectScenes(localVideoPath, duration)

    // 4. Видаляємо старі сцени цієї задачі (якщо повторний прогін)
    const { error: deleteError } = await admin
      .from('scenes')
      .delete()
      .eq('task_id', taskId)

    if (deleteError) {
      console.error('[detect-scenes] delete error:', JSON.stringify(deleteError))
      return NextResponse.json(
        { error: 'Не вдалося очистити старі сцени' },
        { status: 500 }
      )
    }

    // 5. Вставляємо нові
    if (scenes.length > 0) {
      const { error: insertError } = await admin.from('scenes').insert(
        scenes.map((s, i) => ({
          task_id: taskId,
          scene_index: i,
          start_sec: s.start,
          end_sec: s.end,
        }))
      )

      if (insertError) {
        console.error('[detect-scenes] insert error:', JSON.stringify(insertError))
        return NextResponse.json(
          { error: 'Не вдалося зберегти сцени' },
          { status: 500 }
        )
      }
    }

    revalidatePath(`/tasks/${taskId}`)

    return NextResponse.json({
      success: true,
      count: scenes.length,
      duration,
    })
  } catch (err) {
    console.error('[detect-scenes] unexpected:', err)
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Невідома помилка' },
      { status: 500 }
    )
  } finally {
    await cleanupTempDir(tempDir)
  }
}