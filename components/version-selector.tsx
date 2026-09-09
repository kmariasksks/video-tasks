'use client'

import { useState, useTransition } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import toast from 'react-hot-toast'
import { createVersion } from '@/app/tasks/[id]/actions'
import type { Version } from '@/types/database'

type Props = {
  taskId: string
  versions: Version[]
  currentVersionId: string | null
}

const RENDER_STATUS_LABELS: Record<string, string> = {
  pending: 'Не рендерилась',
  rendering: 'Рендериться…',
  done: 'Готово',
  failed: 'Помилка',
}

const RENDER_STATUS_COLORS: Record<string, string> = {
  pending: 'text-gray-500',
  rendering: 'text-blue-600',
  done: 'text-green-600',
  failed: 'text-red-600',
}

export function VersionSelector({ taskId, versions, currentVersionId }: Props) {
  const router = useRouter()
  const searchParams = useSearchParams()
  const [isPending, startTransition] = useTransition()
  const [isCreating, setIsCreating] = useState(false)

  const currentVersion =
    versions.find((v) => v.id === currentVersionId) ?? versions[0] ?? null

  function selectVersion(versionId: string) {
    const params = new URLSearchParams(searchParams.toString())
    params.set('version', versionId)
    startTransition(() => {
      router.push(`/tasks/${taskId}?${params.toString()}`, { scroll: false })
    })
  }

  async function handleCreateVersion() {
    setIsCreating(true)
    try {
      const result = await createVersion(taskId, currentVersionId ?? undefined)
      if (result.success) {
        toast.success(`Створено v${result.versionNumber}`)
        const params = new URLSearchParams(searchParams.toString())
        params.set('version', result.versionId)
        router.push(`/tasks/${taskId}?${params.toString()}`, { scroll: false })
        router.refresh()
      } else {
        toast.error(result.error)
      }
    } catch (e) {
      console.error('[VersionSelector] create error:', e)
      toast.error('Не вдалося створити версію')
    } finally {
      setIsCreating(false)
    }
  }

  if (versions.length === 0) {
    return (
      <div className="text-sm text-gray-500">
        Версії з'являться після виявлення сцен.
      </div>
    )
  }

  return (
    <div className="flex items-center gap-3 flex-wrap">
      <div className="flex items-center gap-2">
        <label htmlFor="version-select" className="text-sm font-medium">
          Версія:
        </label>
        <select
          id="version-select"
          value={currentVersion?.id ?? ''}
          onChange={(e) => selectVersion(e.target.value)}
          disabled={isPending}
          className="text-sm border border-gray-300 rounded px-2 py-1 bg-white disabled:opacity-50"
        >
          {versions.map((v) => (
            <option key={v.id} value={v.id}>
              {v.name}
            </option>
          ))}
        </select>
      </div>

      {currentVersion && (
        <div className={`text-xs ${RENDER_STATUS_COLORS[currentVersion.render_status]}`}>
          {RENDER_STATUS_LABELS[currentVersion.render_status]}
        </div>
      )}

      <button
        onClick={handleCreateVersion}
        disabled={isCreating}
        className="ml-auto text-sm px-3 py-1 border rounded hover:bg-gray-50 disabled:opacity-50"
      >
        {isCreating ? 'Створюємо…' : '+ Нова версія'}
      </button>
    </div>
  )
}