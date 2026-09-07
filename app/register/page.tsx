import Link from 'next/link'
import { RegisterForm } from '../register/register-form'

export default function RegisterPage() {
  return (
    <main className="min-h-screen flex items-center justify-center p-8">
      <div className="w-full max-w-md space-y-6">
        <div className="text-center">
          <h1 className="text-2xl font-bold">Video Tasks</h1>
          <p className="text-gray-500 text-sm mt-1">Створити акаунт</p>
        </div>

        <RegisterForm />

        <p className="text-sm text-center text-gray-600">
          Вже є акаунт?{' '}
          <Link href="/login" className="text-blue-600 hover:underline">
            Увійти
          </Link>
        </p>
      </div>
    </main>
  )
}