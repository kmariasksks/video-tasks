import { NextResponse } from 'next/server'
import { writeFile } from 'fs/promises'
import { join } from 'path'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { probeVideo } from '@/lib/ffmpeg'
import { createTempDir, cleanupTempDir } from '@/lib/temp-files'
import { revalidatePath } from 'next/cache'

type RouteParams = {
  params: Promise<{ id: string }>
}

export async function POST(_request: Request, { params }: RouteParams) {
  const { id: taskId } = await params

  // 1. Auth-перевірка через звичайний server client (з cookies)
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    return NextResponse.json({ error: 'Не залогінені' }, { status: 401 })
  }

  // 2. Отримуємо задачу і перевіряємо чи є source_video_path
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
      { error: 'Немає завантаженого відео для аналізу' },
      { status: 400 }
    )
  }

  // 3. Готуємо тимчасову папку
  const tempDir = await createTempDir('probe-')
  const localVideoPath = join(tempDir, 'video')

  try {
    // 4. Завантажуємо файл з Supabase Storage через admin-клієнт
    // (щоб не залежати від RLS на файл, ми вже перевірили доступ вище)
    const admin = createAdminClient()
    const { data: fileData, error: downloadError } = await admin.storage
      .from('source-videos')
      .download(task.source_video_path)

    if (downloadError || !fileData) {
      console.error('[probe] download error:', downloadError)
      return NextResponse.json(
        { error: 'Не вдалося завантажити відео зі сховища' },
        { status: 500 }
      )
    }

    // Blob → Buffer → файл на диску
    const arrayBuffer = await fileData.arrayBuffer()
    await writeFile(localVideoPath, Buffer.from(arrayBuffer))

    // 5. Запускаємо ffprobe
    const probe = await probeVideo(localVideoPath)

    // 6. Оновлюємо БД
    const { error: updateError } = await supabase
      .from('tasks')
      .update({
        source_video_duration_sec: probe.duration,
      })
      .eq('id', taskId)

    if (updateError) {
      console.error('[probe] update error:', JSON.stringify(updateError))
      return NextResponse.json(
        { error: 'Не вдалося оновити задачу' },
        { status: 500 }
      )
    }

    revalidatePath(`/tasks/${taskId}`)

    return NextResponse.json({
      success: true,
      duration: probe.duration,
      format: probe.format,
    })
  } catch (err) {
    console.error('[probe] unexpected error:', err)
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Невідома помилка' },
      { status: 500 }
    )
  } finally {
    // 7. ЗАВЖДИ чистимо тимчасову папку
    await cleanupTempDir(tempDir)
  }
}