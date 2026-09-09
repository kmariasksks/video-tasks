'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import toast from 'react-hot-toast'
import { formatTimecode } from '@/lib/scenes'
import type { Scene } from '@/types/database'

type Props = {
  taskId: string
  scenes: Scene[]
  hasVideo: boolean
}

export function ScenesList({ taskId, scenes, hasVideo }: Props) {
  const [isReanalyzing, setIsReanalyzing] = useState(false)
  const router = useRouter()

  async function handleReanalyze() {
    setIsReanalyzing(true)
    try {
      const res = await fetch(`/api/tasks/${taskId}/detect-scenes`, {
        method: 'POST',
      })
      if (res.ok) {
        const data = await res.json()
        toast.success(`Знайдено сцен: ${data.count}`)
        router.refresh()
      } else {
        const err = await res.json().catch(() => ({}))
        toast.error(err.error ?? 'Не вдалося виявити сцени')
      }
    } catch (e) {
      console.error('[ScenesList] reanalyze failed:', e)
      toast.error('Помилка запиту')
    } finally {
      setIsReanalyzing(false)
    }
  }

  if (!hasVideo) return null

  return (
    <div className="bg-white rounded-lg border p-6 space-y-4">
      <div className="flex justify-between items-center gap-3 flex-wrap">
        <h2 className="font-semibold">
          Сцени <span className="text-gray-400 font-normal">({scenes.length})</span>
        </h2>

        <button
          onClick={handleReanalyze}
          disabled={isReanalyzing}
          className="text-xs px-3 py-1.5 border rounded hover:bg-gray-50 disabled:opacity-50"
        >
          {isReanalyzing ? 'Аналізуємо…' : 'Перезапустити аналіз'}
        </button>
      </div>

      {scenes.length === 0 ? (
        <div className="text-sm text-gray-500 border-2 border-dashed border-gray-300 rounded-lg p-6 text-center">
          Сцени ще не виявлено. Натисни &laquo;Перезапустити аналіз&raquo; вище.
        </div>
      ) : (
        <div className="space-y-1">
          {scenes.map((scene) => {
            const duration = scene.end_sec - scene.start_sec
            return (
              <div
                key={scene.id}
                className="flex items-center gap-3 py-2 px-3 rounded hover:bg-gray-50 text-sm"
              >
                <div className="w-8 h-8 rounded bg-gray-100 flex items-center justify-center font-medium text-gray-700 text-xs shrink-0">
                  {scene.scene_index + 1}
                </div>
                <div className="flex-1 flex items-center gap-3 min-w-0">
                  <span className="font-mono text-gray-900">
                    {formatTimecode(scene.start_sec)} – {formatTimecode(scene.end_sec)}
                  </span>
                  <span className="text-gray-500 text-xs">
                    {duration.toFixed(1)}s
                  </span>
                </div>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}