import Link from 'next/link'
import { LoginForm } from '../login/login-form'

export default function LoginPage() {
  return (
    <main className="min-h-screen flex items-center justify-center p-8">
      <div className="w-full max-w-md space-y-6">
        <div className="text-center">
          <h1 className="text-2xl font-bold">Video Tasks</h1>
          <p className="text-gray-500 text-sm mt-1">Увійти в акаунт</p>
        </div>

        <LoginForm />

        <p className="text-sm text-center text-gray-600">
          Немає акаунту?{' '}
          <Link href="/register" className="text-blue-600 hover:underline">
            Зареєструватись
          </Link>
        </p>
      </div>
    </main>
  )
}