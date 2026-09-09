'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import toast from 'react-hot-toast'
import { formatTimecode } from '@/lib/scenes'
import { calculateVersionDuration } from '@/lib/versions'
import type { Version, VersionSegment } from '@/types/database'

type Props = {
  version: Version
  segments: VersionSegment[]
  renderedVideoUrl: string | null
}

export function RenderPanel({ version, segments, renderedVideoUrl }: Props) {
  const router = useRouter()
  const [isRendering, setIsRendering] = useState(false)

  const totalDuration = calculateVersionDuration(segments)
  const isRenderStale =
    version.render_status === 'done' &&
    version.rendered_duration_sec !== null &&
    Math.abs(version.rendered_duration_sec - totalDuration) > 0.5

  async function handleRender() {
    if (segments.length === 0) {
      toast.error('Немає сегментів для рендеру')
      return
    }

    setIsRendering(true)
    try {
      const res = await fetch(`/api/versions/${version.id}/render`, {
        method: 'POST',
      })

      if (res.ok) {
        const data = await res.json()
        toast.success(
          `Рендер готовий за ${(data.renderDurationMs / 1000).toFixed(1)}s`
        )
        router.refresh()
      } else {
        const err = await res.json().catch(() => ({}))
        toast.error(err.error ?? 'Помилка рендеру')
        router.refresh()
      }
    } catch (e) {
      console.error('[RenderPanel] error:', e)
      toast.error('Мережева помилка')
    } finally {
      setIsRendering(false)
    }
  }

  return (
    <div className="border-t pt-4 space-y-3">
      <div className="flex justify-between items-center gap-3 flex-wrap">
        <div className="text-sm">
          <span className="font-medium">Рендер</span>
          <span className="text-gray-500 ml-2">
            {version.render_status === 'done' &&
              `готово · ${formatTimecode(version.rendered_duration_sec ?? 0)}`}
            {version.render_status === 'rendering' && 'у процесі…'}
            {version.render_status === 'pending' && 'не запущено'}
            {version.render_status === 'failed' && 'помилка'}
          </span>
        </div>

        <button
          onClick={handleRender}
          disabled={isRendering || segments.length === 0}
          className="text-sm px-4 py-1.5 bg-black text-white rounded hover:bg-gray-800 disabled:opacity-50"
        >
          {isRendering
            ? 'Рендеримо…'
            : version.render_status === 'done'
              ? 'Перерендерити'
              : 'Зрендерити версію'}
        </button>
      </div>

      {isRenderStale && (
        <div className="text-xs text-amber-700 bg-amber-50 border border-amber-200 rounded p-2">
          Таймлайн змінився після останнього рендеру. Перерендер рекомендується.
        </div>
      )}

      {version.render_status === 'failed' && version.render_error && (
        <div className="text-xs text-red-700 bg-red-50 border border-red-200 rounded p-2">
          <div className="font-semibold mb-1">Помилка рендеру:</div>
          <div className="font-mono break-words">{version.render_error}</div>
        </div>
      )}

      {version.render_status === 'done' && renderedVideoUrl && (
        <div className="space-y-2">
          <video
            controls
            src={renderedVideoUrl}
            className="w-full rounded border bg-black max-h-[400px]"
          >
            Ваш браузер не підтримує відео-тег
          </video>

          <div className="flex justify-between items-center text-xs text-gray-500 gap-2">
            <div className="flex gap-3">
              {version.render_duration_ms !== null && (
                <span>
                  Час рендеру: {(version.render_duration_ms / 1000).toFixed(1)}s
                </span>
              )}
            </div>
            <a
              href={renderedVideoUrl}
              download={`${version.name}.mp4`}
              className="text-blue-600 hover:underline"
            >
              Завантажити
            </a>
          </div>
        </div>
      )}
    </div>
  )
}