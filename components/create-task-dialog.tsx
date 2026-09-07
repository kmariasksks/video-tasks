'use client'

import { useActionState, useEffect, useRef, useState } from 'react'
import { createTask, type CreateTaskState } from '@/app/tasks/actions'
import toast from 'react-hot-toast'

const initialState: CreateTaskState = null

export function CreateTaskDialog() {
  const [isOpen, setIsOpen] = useState(false)
  const [state, formAction, pending] = useActionState(createTask, initialState)
  const formRef = useRef<HTMLFormElement>(null)

  // Якщо action завершився без помилки — закриваємо модалку і показуємо toast
  useEffect(() => {
    if (state === null && !pending && formRef.current) {
      // ця умова спрацює тільки після успішного submit
      // (initial state теж null, тому додатково перевіряємо через ref)
    }
  }, [state, pending])

  return (
    <>
      <button
        onClick={() => setIsOpen(true)}
        className="px-4 py-2 bg-black text-white rounded hover:bg-gray-800 text-sm font-medium"
      >
        + Нова задача
      </button>

      {isOpen && (
        <div
          className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50"
          onClick={() => setIsOpen(false)}
        >
          <div
            className="bg-white rounded-lg p-6 w-full max-w-md space-y-4"
            onClick={(e) => e.stopPropagation()}
          >
            <h2 className="text-lg font-semibold">Нова задача</h2>

            <form
              ref={formRef}
              action={async (formData) => {
                const result = await createTask(null, formData)
                if (result?.error) {
                  toast.error(result.error)
                } else {
                  toast.success('Задачу створено')
                  formRef.current?.reset()
                  setIsOpen(false)
                }
              }}
              className="space-y-4"
            >
              <div>
                <label htmlFor="title" className="block text-sm font-medium mb-1">
                  Назва <span className="text-red-500">*</span>
                </label>
                <input
                  id="title"
                  name="title"
                  type="text"
                  required
                  autoFocus
                  maxLength={200}
                  className="w-full px-3 py-2 border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>

              <div>
                <label htmlFor="description" className="block text-sm font-medium mb-1">
                  Опис <span className="text-gray-400">(опційно)</span>
                </label>
                <textarea
                  id="description"
                  name="description"
                  rows={3}
                  className="w-full px-3 py-2 border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none"
                />
              </div>

              {state?.error && (
                <div className="text-sm text-red-700 bg-red-50 border border-red-200 rounded p-2">
                  {state.error}
                </div>
              )}

              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setIsOpen(false)}
                  className="px-4 py-2 text-sm border rounded hover:bg-gray-50"
                >
                  Скасувати
                </button>
                <button
                  type="submit"
                  disabled={pending}
                  className="px-4 py-2 text-sm bg-black text-white rounded hover:bg-gray-800 disabled:opacity-50"
                >
                  {pending ? 'Створюємо…' : 'Створити'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </>
  )
}