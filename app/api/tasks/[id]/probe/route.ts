import { NextResponse } from 'next/server'
import { writeFile } from 'fs/promises'
import { join } from 'path'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { probeVideo } from '@/lib/ffmpeg'
import { createTempDir, cleanupTempDir } from '@/lib/temp-files'
import { logError } from '@/lib/error-logger'
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
      { error: 'Немає завантаженого відео для аналізу' },
      { status: 400 }
    )
  }

  const tempDir = await createTempDir('probe-')
  const localVideoPath = join(tempDir, 'video')

  try {
    const admin = createAdminClient()
    const { data: fileData, error: downloadError } = await admin.storage
      .from('source-videos')
      .download(task.source_video_path)

    if (downloadError || !fileData) {
      throw new Error(`Не вдалося завантажити відео: ${downloadError?.message}`)
    }

    await writeFile(localVideoPath, Buffer.from(await fileData.arrayBuffer()))

    const probe = await probeVideo(localVideoPath)

    const { error: updateError } = await supabase
      .from('tasks')
      .update({
        source_video_duration_sec: probe.duration,
      })
      .eq('id', taskId)

    if (updateError) {
      throw new Error(`Не вдалося оновити задачу: ${updateError.message}`)
    }

    revalidatePath(`/tasks/${taskId}`)

    return NextResponse.json({
      success: true,
      duration: probe.duration,
      format: probe.format,
    })
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Невідома помилка'

    // Probe — не критично (це просто метадані, не блокує основний функціонал).
    // Логуємо в БД, але не в Telegram.
    await logError({
      stage: 'upload',
      message,
      error: err,
      taskId,
      userId: user.id,
      critical: false,
    })

    return NextResponse.json({ error: message }, { status: 500 })
  } finally {
    await cleanupTempDir(tempDir)
  }
}