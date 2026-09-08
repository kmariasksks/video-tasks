'use client'

import { useState, useTransition } from 'react'
import { deleteTaskVideo } from '@/app/tasks/[id]/actions'
import toast from 'react-hot-toast'

type Props = {
  taskId: string
}

export function DeleteVideoButton({ taskId }: Props) {
  const [confirming, setConfirming] = useState(false)
  const [isPending, startTransition] = useTransition()

  function handleClick() {
    if (!confirming) {
      setConfirming(true)
      // Автоскидання підтвердження через 3с, щоб кнопка не залишалась "заряджена"
      setTimeout(() => setConfirming(false), 3000)
      return
    }

    startTransition(async () => {
      const result = await deleteTaskVideo(taskId)
      if (result.success) {
        toast.success('Відео видалено')
      } else {
        toast.error(result.error)
      }
      setConfirming(false)
    })
  }

  return (
    <button
      onClick={handleClick}
      disabled={isPending}
      className={`text-sm px-3 py-1.5 rounded border transition-colors disabled:opacity-50 ${
        confirming
          ? 'bg-red-600 text-white border-red-600 hover:bg-red-700'
          : 'text-red-600 border-red-300 hover:bg-red-50'
      }`}
    >
      {isPending
        ? 'Видаляємо…'
        : confirming
          ? 'Точно видалити?'
          : 'Видалити відео'}
    </button>
  )
}