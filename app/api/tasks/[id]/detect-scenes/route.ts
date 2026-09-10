import { NextResponse } from 'next/server'
import { writeFile } from 'fs/promises'
import { join } from 'path'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { probeVideo, detectScenes } from '@/lib/ffmpeg'
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
      { error: 'Немає завантаженого відео' },
      { status: 400 }
    )
  }

  const tempDir = await createTempDir('scenes-')
  const localVideoPath = join(tempDir, 'video')
  const admin = createAdminClient()

  try {
    const { data: fileData, error: downloadError } = await admin.storage
      .from('source-videos')
      .download(task.source_video_path)

    if (downloadError || !fileData) {
      throw new Error(`Не вдалося завантажити відео: ${downloadError?.message}`)
    }

    await writeFile(localVideoPath, Buffer.from(await fileData.arrayBuffer()))

    const { duration } = await probeVideo(localVideoPath)
    const scenes = await detectScenes(localVideoPath, duration)

    const { error: deleteError } = await admin
      .from('scenes')
      .delete()
      .eq('task_id', taskId)

    if (deleteError) {
      throw new Error(`Не вдалося очистити старі сцени: ${deleteError.message}`)
    }

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
        throw new Error(`Не вдалося зберегти сцени: ${insertError.message}`)
      }
    }

    // Автостворення v1
    const { data: existingVersions } = await admin
      .from('versions')
      .select('id')
      .eq('task_id', taskId)
      .limit(1)

    if (!existingVersions || existingVersions.length === 0) {
      const { data: newVersion, error: versionErr } = await admin
        .from('versions')
        .insert({
          task_id: taskId,
          version_number: 1,
          name: 'v1',
          render_status: 'pending',
        })
        .select('id')
        .single()

      if (versionErr) {
        console.error('[detect-scenes] auto v1 error:', JSON.stringify(versionErr))
      } else if (newVersion && scenes.length > 0) {
        const { data: freshScenes } = await admin
          .from('scenes')
          .select('id, scene_index, start_sec, end_sec')
          .eq('task_id', taskId)
          .order('scene_index', { ascending: true })

        if (freshScenes) {
          await admin.from('version_segments').insert(
            freshScenes.map((s, i) => ({
              version_id: newVersion.id,
              source_scene_id: s.id,
              position: i,
              start_sec: s.start_sec,
              end_sec: s.end_sec,
            }))
          )
        }
      }
    }

    revalidatePath(`/tasks/${taskId}`)

    return NextResponse.json({
      success: true,
      count: scenes.length,
      duration,
    })
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Невідома помилка'

    await logError({
      stage: 'scene_detection',
      message,
      error: err,
      taskId,
      userId: user.id,
      critical: true,
    })

    return NextResponse.json({ error: message }, { status: 500 })
  } finally {
    await cleanupTempDir(tempDir)
  }
}