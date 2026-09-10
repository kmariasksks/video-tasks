'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import toast from 'react-hot-toast'

export function AdminTestAlertButton() {
  const router = useRouter()
  const [isPending, setIsPending] = useState(false)

  async function handleClick() {
    setIsPending(true)
    try {
      const res = await fetch('/api/admin/test-error', { method: 'POST' })
      if (res.ok) {
        toast.success('Тестовий алерт відправлено. Перевір Telegram і список помилок нижче.')
        router.refresh()
      } else {
        const err = await res.json().catch(() => ({}))
        toast.error(err.error ?? 'Не вдалося відправити')
      }
    } catch (e) {
      console.error('[test-alert] error:', e)
      toast.error('Мережева помилка')
    } finally {
      setIsPending(false)
    }
  }

  return (
    <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 flex items-center justify-between gap-3 flex-wrap">
      <div className="text-sm">
        <div className="font-medium text-blue-900">🧪 Тест моніторингу</div>
        <div className="text-xs text-blue-700 mt-0.5">
          Створить запис у error_logs та відправить алерт у Telegram
        </div>
      </div>
      <button
        onClick={handleClick}
        disabled={isPending}
        className="text-sm px-3 py-1.5 bg-blue-600 text-white rounded hover:bg-blue-700 disabled:opacity-50 shrink-0"
      >
        {isPending ? 'Відправляємо…' : 'Відправити тестовий алерт'}
      </button>
    </div>
  )
}