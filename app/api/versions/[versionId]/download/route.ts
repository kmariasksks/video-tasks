import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'

type RouteParams = {
  params: Promise<{ versionId: string }>
}

export async function GET(_request: Request, { params }: RouteParams) {
  const { versionId } = await params

  const supabase = await createClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    return NextResponse.json({ error: 'Не залогінені' }, { status: 401 })
  }

  const { data: version, error: versionError } = await supabase
    .from('versions')
    .select('id, name, task_id, rendered_video_path')
    .eq('id', versionId)
    .single()

  if (versionError || !version || !version.rendered_video_path) {
    return NextResponse.json(
      { error: 'Рендер не знайдено' },
      { status: 404 }
    )
  }

  // Тягнемо файл з Supabase Storage через admin (обходить RLS)
  const admin = createAdminClient()
  const { data: fileData, error: downloadError } = await admin.storage
    .from('rendered-videos')
    .download(version.rendered_video_path)

  if (downloadError || !fileData) {
    console.error('[download] error:', downloadError)
    return NextResponse.json(
      { error: 'Не вдалося завантажити файл' },
      { status: 500 }
    )
  }

  // Формуємо ім'я файлу для скачування: v1.mp4, v2.mp4 тощо
  const filename = `${version.name}.mp4`

  // Віддаємо файл з заголовками, які форсять download
  return new NextResponse(fileData, {
    headers: {
      'Content-Type': 'video/mp4',
      'Content-Disposition': `attachment; filename="${filename}"`,
      'Content-Length': fileData.size.toString(),
    },
  })
}