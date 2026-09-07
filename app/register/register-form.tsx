'use client'

import { useActionState } from 'react'
import { signUp, type AuthState } from '@/app/auth/actions'

const initialState: AuthState = null

export function RegisterForm() {
  const [state, formAction, pending] = useActionState(signUp, initialState)

  return (
    <form action={formAction} className="space-y-4">
      <div>
        <label htmlFor="full_name" className="block text-sm font-medium mb-1">
          Імʼя <span className="text-gray-400">(опційно)</span>
        </label>
        <input
          id="full_name"
          name="full_name"
          type="text"
          autoComplete="name"
          className="w-full px-3 py-2 border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-blue-500"
        />
      </div>

      <div>
        <label htmlFor="email" className="block text-sm font-medium mb-1">
          Email
        </label>
        <input
          id="email"
          name="email"
          type="email"
          required
          autoComplete="email"
          className="w-full px-3 py-2 border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-blue-500"
        />
      </div>

      <div>
        <label htmlFor="password" className="block text-sm font-medium mb-1">
          Пароль <span className="text-gray-400">(мін. 6 символів)</span>
        </label>
        <input
          id="password"
          name="password"
          type="password"
          required
          minLength={6}
          autoComplete="new-password"
          className="w-full px-3 py-2 border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-blue-500"
        />
      </div>

      {state?.error && (
        <div className="text-sm text-red-700 bg-red-50 border border-red-200 rounded p-3">
          {state.error}
        </div>
      )}

      <button
        type="submit"
        disabled={pending}
        className="w-full bg-black text-white py-2 rounded font-medium hover:bg-gray-800 disabled:opacity-50 disabled:cursor-not-allowed"
      >
        {pending ? 'Створюємо…' : 'Створити акаунт'}
      </button>
    </form>
  )
}