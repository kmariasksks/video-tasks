'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import toast from 'react-hot-toast'
import { updateTaskStatus } from '@/app/tasks/actions'
import type { TaskStatus } from '@/types/database'

type Props = {
  taskId: string
  currentStatus: TaskStatus
}

type Action = {
  label: string
  targetStatus: TaskStatus
  variant: 'primary' | 'secondary'
}

const ACTIONS_BY_STATUS: Record<TaskStatus, Action[]> = {
  todo: [
    { label: '▶ Взяти в роботу', targetStatus: 'in_progress', variant: 'primary' },
  ],
  in_progress: [
    { label: '→ Віддати на review', targetStatus: 'review', variant: 'primary' },
    { label: '← Повернути в todo', targetStatus: 'todo', variant: 'secondary' },
  ],
  review: [
    { label: '✓ Прийняти (Done)', targetStatus: 'done', variant: 'primary' },
    { label: '← Повернути в роботу', targetStatus: 'in_progress', variant: 'secondary' },
  ],
  done: [
    { label: '← Повернути в review', targetStatus: 'review', variant: 'secondary' },
  ],
}

export function StatusActions({ taskId, currentStatus }: Props) {
  const router = useRouter()
  const [pendingTarget, setPendingTarget] = useState<TaskStatus | null>(null)

  const actions = ACTIONS_BY_STATUS[currentStatus]

  async function handleClick(target: TaskStatus) {
    setPendingTarget(target)
    try {
      const result = await updateTaskStatus(taskId, target)
      if (result.success) {
        toast.success('Статус оновлено')
        router.refresh()
      } else {
        toast.error(result.error)
      }
    } catch (e) {
      console.error('[StatusActions] error:', e)
      toast.error('Не вдалося оновити статус')
    } finally {
      setPendingTarget(null)
    }
  }

  return (
    <div className="flex gap-2 flex-wrap">
      {actions.map((action) => {
        const isPending = pendingTarget === action.targetStatus
        const styles =
          action.variant === 'primary'
            ? 'bg-black text-white hover:bg-gray-800'
            : 'border border-gray-300 text-gray-700 hover:bg-gray-50'

        return (
          <button
            key={action.targetStatus}
            onClick={() => handleClick(action.targetStatus)}
            disabled={pendingTarget !== null}
            className={`text-sm px-3 py-1.5 rounded disabled:opacity-50 ${styles}`}
          >
            {isPending ? 'Оновлення…' : action.label}
          </button>
        )
      })}
    </div>
  )
}