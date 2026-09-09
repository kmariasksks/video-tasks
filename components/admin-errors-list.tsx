'use client'

import { useState } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import type { ErrorLog, ErrorStage } from '@/types/database'

const STAGES: Array<ErrorStage | 'all'> = [
  'all',
  'upload',
  'scene_detection',
  'render',
  'auth',
  'db',
  'telegram',
  'other',
]

const STAGE_LABELS: Record<string, string> = {
  all: 'Всі',
  upload: 'Upload',
  scene_detection: 'Scene detection',
  render: 'Render',
  auth: 'Auth',
  db: 'DB',
  telegram: 'Telegram',
  other: 'Other',
}

type Props = {
  errors: ErrorLog[]
  errorTypes: string[]
  currentStage: string
  currentType: string
}

export function AdminErrorsList({ errors, errorTypes, currentStage, currentType }: Props) {
  const router = useRouter()
  const searchParams = useSearchParams()
  const [expandedId, setExpandedId] = useState<string | null>(null)

  function updateFilter(key: 'stage' | 'type', value: string) {
    const params = new URLSearchParams(searchParams.toString())
    if (value === 'all' || !value) {
      params.delete(key)
    } else {
      params.set(key, value)
    }
    router.push(`/admin?${params.toString()}`, { scroll: false })
  }

  return (
    <div className="bg-white rounded-lg border overflow-hidden">
      <div className="px-4 py-3 border-b bg-gray-50 space-y-3">
        <div className="flex justify-between items-center gap-2 flex-wrap">
          <div>
            <h2 className="font-semibold">Останні помилки</h2>
            <p className="text-xs text-gray-500 mt-0.5">
              Показано {errors.length}. Клік на рядок — розгорнути stack trace.
            </p>
          </div>
        </div>

        <div className="flex gap-3 items-center flex-wrap text-sm">
          <div className="flex items-center gap-2">
            <label className="text-xs text-gray-600">Етап:</label>
            <select
              value={currentStage}
              onChange={(e) => updateFilter('stage', e.target.value)}
              className="border border-gray-300 rounded px-2 py-1 text-xs bg-white"
            >
              {STAGES.map((s) => (
                <option key={s} value={s}>
                  {STAGE_LABELS[s]}
                </option>
              ))}
            </select>
          </div>

          <div className="flex items-center gap-2">
            <label className="text-xs text-gray-600">Тип:</label>
            <select
              value={currentType}
              onChange={(e) => updateFilter('type', e.target.value)}
              className="border border-gray-300 rounded px-2 py-1 text-xs bg-white"
            >
              <option value="all">Всі</option>
              {errorTypes.map((t) => (
                <option key={t} value={t}>
                  {t}
                </option>
              ))}
            </select>
          </div>

          {(currentStage !== 'all' || currentType !== 'all') && (
            <button
              onClick={() => router.push('/admin', { scroll: false })}
              className="text-xs text-blue-600 hover:underline"
            >
              Скинути фільтри
            </button>
          )}
        </div>
      </div>

      {errors.length === 0 ? (
        <div className="p-6 text-sm text-gray-500 text-center">
          Немає помилок за цими фільтрами.
        </div>
      ) : (
        <div className="divide-y">
          {errors.map((err) => {
            const isExpanded = expandedId === err.id
            return (
              <div key={err.id} className="text-sm">
                <button
                  onClick={() => setExpandedId(isExpanded ? null : err.id)}
                  className="w-full text-left px-4 py-3 hover:bg-gray-50"
                >
                  <div className="flex items-start gap-3">
                    {err.is_critical && (
                      <span className="shrink-0 text-red-600 font-medium text-xs px-2 py-0.5 bg-red-50 border border-red-200 rounded">
                        CRITICAL
                      </span>
                    )}
                    <span className="shrink-0 text-xs px-2 py-0.5 bg-gray-100 border border-gray-200 rounded font-mono">
                      {err.stage}
                    </span>
                    {err.error_type && (
                      <span className="shrink-0 text-xs px-2 py-0.5 bg-gray-100 border border-gray-200 rounded font-mono">
                        {err.error_type}
                      </span>
                    )}
                    <span className="flex-1 min-w-0 truncate text-gray-700">
                      {err.message}
                    </span>
                    <span className="shrink-0 text-xs text-gray-500 whitespace-nowrap">
                      {new Date(err.created_at).toLocaleString('uk-UA', {
                        day: '2-digit',
                        month: '2-digit',
                        hour: '2-digit',
                        minute: '2-digit',
                      })}
                    </span>
                  </div>
                </button>

                {isExpanded && (
                  <div className="px-4 pb-4 space-y-2 bg-gray-50 border-t">
                    <div className="text-xs pt-3">
                      <div className="text-gray-500 mb-1">Повне повідомлення:</div>
                      <div className="font-mono bg-white border rounded p-2 break-words whitespace-pre-wrap">
                        {err.message}
                      </div>
                    </div>

                    {err.stack_trace && (
                      <div className="text-xs">
                        <div className="text-gray-500 mb-1">Stack trace:</div>
                        <pre className="font-mono bg-white border rounded p-2 overflow-x-auto text-[11px] leading-relaxed">
                          {err.stack_trace}
                        </pre>
                      </div>
                    )}

                    <div className="text-xs grid grid-cols-2 gap-2 pt-1">
                      <div>
                        <span className="text-gray-500">Task ID:</span>{' '}
                        <span className="font-mono">{err.task_id ?? '—'}</span>
                      </div>
                      <div>
                        <span className="text-gray-500">User ID:</span>{' '}
                        <span className="font-mono">{err.user_id ?? '—'}</span>
                      </div>
                    </div>

                    {err.context && Object.keys(err.context).length > 0 && (
                      <div className="text-xs">
                        <div className="text-gray-500 mb-1">Контекст:</div>
                        <pre className="font-mono bg-white border rounded p-2 overflow-x-auto text-[11px]">
                          {JSON.stringify(err.context, null, 2)}
                        </pre>
                      </div>
                    )}
                  </div>
                )}
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}