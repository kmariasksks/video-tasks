import { notFound } from 'next/navigation'
import Link from 'next/link'
import { getTaskById, formatDuration, TASK_STATUS_LABELS } from '@/lib/tasks'
import { VideoUploader } from '@/components/video-uploader'
import { getSignedSourceVideoUrl } from '@/lib/storage'

type PageProps = {
  params: Promise<{ id: string }>
}

const STATUS_BADGE_COLORS: Record<string, string> = {
  todo: 'bg-gray-100 text-gray-700 border-gray-300',
  in_progress: 'bg-blue-100 text-blue-700 border-blue-300',
  review: 'bg-yellow-100 text-yellow-700 border-yellow-300',
  done: 'bg-green-100 text-green-700 border-green-300',
}

export default async function TaskPage({ params }: PageProps) {
  const { id } = await params
  const task = await getTaskById(id)

  if (!task) {
    notFound()
  }

  const videoUrl = task.source_video_path
    ? await getSignedSourceVideoUrl(task.source_video_path)
    : null

  return (
    <div className="min-h-screen bg-gray-50">
      <header className="border-b bg-white">
        <div className="max-w-4xl mx-auto px-6 py-4">
          <Link
            href="/"
            className="text-sm text-gray-600 hover:text-gray-900 inline-flex items-center gap-1"
          >
            ← До дошки
          </Link>
        </div>
      </header>

      <main className="max-w-4xl mx-auto p-6 space-y-6">
        <div className="bg-white rounded-lg border p-6 space-y-4">
          <div className="flex justify-between items-start gap-4">
            <div className="space-y-2 flex-1 min-w-0">
              <h1 className="text-2xl font-bold break-words">{task.title}</h1>
              <div className="text-sm text-gray-600">
                Автор: {task.author?.full_name ?? task.author?.email ?? 'Unknown'}
              </div>
            </div>

            <span
              className={`shrink-0 px-3 py-1 rounded-full border text-xs font-medium ${STATUS_BADGE_COLORS[task.status]}`}
            >
              {TASK_STATUS_LABELS[task.status]}
            </span>
          </div>

          {task.description && (
            <div className="text-gray-700 whitespace-pre-wrap border-t pt-4">
              {task.description}
            </div>
          )}

          <div className="grid grid-cols-2 gap-4 text-sm border-t pt-4">
            <div>
              <div className="text-gray-500 text-xs uppercase tracking-wider mb-1">
                Тривалість відео
              </div>
              <div className="font-medium">
                {formatDuration(task.source_video_duration_sec)}
              </div>
            </div>
            <div>
              <div className="text-gray-500 text-xs uppercase tracking-wider mb-1">
                Створено
              </div>
              <div className="font-medium">
                {new Date(task.created_at).toLocaleString('uk-UA', {
                  day: '2-digit',
                  month: '2-digit',
                  year: 'numeric',
                  hour: '2-digit',
                  minute: '2-digit',
                })}
              </div>
            </div>
          </div>
        </div>

        <div className="bg-white rounded-lg border p-6 space-y-4">
          <h2 className="font-semibold">Відео</h2>

          {task.source_video_path && videoUrl ? (
            <div className="space-y-3">
              <video
                controls
                src={videoUrl}
                className="w-full rounded border bg-black max-h-[500px]"
              >
                Ваш браузер не підтримує відео-тег
              </video>
              <div className="text-xs text-gray-500 truncate">
                {task.source_video_path}
              </div>
            </div>
          ) : (
            <div className="space-y-4">
              <div className="border-2 border-dashed border-gray-300 rounded-lg p-8 text-center text-gray-500">
                <p className="mb-3">Відео ще не завантажене</p>
              </div>
              <VideoUploader taskId={task.id} />
            </div>
          )}
        </div>
      </main>
    </div>
  )
}