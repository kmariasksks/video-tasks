import { NextResponse } from 'next/server'
import { readFile, writeFile } from 'fs/promises'
import { join } from 'path'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { probeVideo, renderConcatVideo } from '@/lib/ffmpeg'
import { createTempDir, cleanupTempDir } from '@/lib/temp-files'
import { revalidatePath } from 'next/cache'

type RouteParams = {
  params: Promise<{ versionId: string }>
}

export async function POST(_request: Request, { params }: RouteParams) {
  const { versionId } = await params

  const supabase = await createClient()
  const admin = createAdminClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    return NextResponse.json({ error: 'Не залогінені' }, { status: 401 })
  }

  // 1. Отримуємо версію
  const { data: version, error: versionError } = await supabase
    .from('versions')
    .select('id, task_id, version_number')
    .eq('id', versionId)
    .single()

  if (versionError || !version) {
    return NextResponse.json({ error: 'Версію не знайдено' }, { status: 404 })
  }

  // 2. Отримуємо задачу з шляхом до сирого відео
  const { data: task, error: taskError } = await supabase
    .from('tasks')
    .select('id, source_video_path, status')
    .eq('id', version.task_id)
    .single()

  if (taskError || !task || !task.source_video_path) {
    return NextResponse.json(
      { error: 'Немає вихідного відео для задачі' },
      { status: 400 }
    )
  }

  // 3. Отримуємо сегменти версії
  const { data: segments, error: segmentsError } = await supabase
    .from('version_segments')
    .select('start_sec, end_sec, position')
    .eq('version_id', versionId)
    .order('position', { ascending: true })

  if (segmentsError) {
    return NextResponse.json(
      { error: 'Не вдалося прочитати сегменти' },
      { status: 500 }
    )
  }

  if (!segments || segments.length === 0) {
    return NextResponse.json(
      { error: 'У версії немає сегментів для рендеру' },
      { status: 400 }
    )
  }

  // 4. Позначаємо статус як "rendering"
  await admin
    .from('versions')
    .update({ render_status: 'rendering', render_error: null })
    .eq('id', versionId)

  const startTime = Date.now()
  const tempDir = await createTempDir('render-')
  const localSourcePath = join(tempDir, 'source')
  const localOutputPath = join(tempDir, 'output.mp4')

  try {
    // 5. Скачуємо оригінал з Storage
    const { data: fileData, error: downloadError } = await admin.storage
      .from('source-videos')
      .download(task.source_video_path)

    if (downloadError || !fileData) {
      throw new Error(`Не вдалося завантажити оригінал: ${downloadError?.message}`)
    }

    await writeFile(localSourcePath, Buffer.from(await fileData.arrayBuffer()))

    // 6. Запускаємо рендер
    await renderConcatVideo(
      localSourcePath,
      localOutputPath,
      segments.map((s) => ({ start: s.start_sec, end: s.end_sec }))
    )

    // 7. Дізнаємось тривалість фінального рендеру
    const { duration: renderedDuration } = await probeVideo(localOutputPath)

    // 8. Заливаємо рендер у Storage
    const renderedBuffer = await readFile(localOutputPath)
    const timestamp = Date.now()
    const renderedPath = `${task.id}/v${version.version_number}-${timestamp}.mp4`

    const { error: uploadError } = await admin.storage
      .from('rendered-videos')
      .upload(renderedPath, renderedBuffer, {
        contentType: 'video/mp4',
        upsert: false,
      })

    if (uploadError) {
      throw new Error(`Не вдалося залити рендер: ${uploadError.message}`)
    }

    const renderDurationMs = Date.now() - startTime

    // 9. Оновлюємо версію
    const { error: updateVersionError } = await admin
      .from('versions')
      .update({
        render_status: 'done',
        rendered_video_path: renderedPath,
        rendered_duration_sec: renderedDuration,
        render_duration_ms: renderDurationMs,
        render_error: null,
      })
      .eq('id', versionId)

    if (updateVersionError) {
      throw new Error(`Не вдалося оновити версію: ${updateVersionError.message}`)
    }

    // 10. Автоматично міняємо статус задачі на review (вимога ТЗ)
    // Робимо тільки якщо задача була у todo/in_progress. Не чіпаємо якщо вже review/done.
    if (task.status === 'todo' || task.status === 'in_progress') {
      await admin
        .from('tasks')
        .update({ status: 'review' })
        .eq('id', task.id)
    }

    revalidatePath(`/tasks/${task.id}`)

    return NextResponse.json({
      success: true,
      renderDurationMs,
      renderedDuration,
      renderedPath,
    })
  } catch (err) {
    console.error('[render] error:', err)
    const message = err instanceof Error ? err.message : 'Невідома помилка'

    // Пишемо помилку в БД щоб юзер побачив
    await admin
      .from('versions')
      .update({
        render_status: 'failed',
        render_error: message,
        render_duration_ms: Date.now() - startTime,
      })
      .eq('id', versionId)

    revalidatePath(`/tasks/${task.id}`)

    return NextResponse.json({ error: message }, { status: 500 })
  } finally {
    await cleanupTempDir(tempDir)
  }
}