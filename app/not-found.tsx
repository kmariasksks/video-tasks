import Link from 'next/link'

export default function NotFound() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 p-6">
      <div className="text-center space-y-4 max-w-md">
        <h1 className="text-4xl font-bold text-gray-900">404</h1>
        <p className="text-gray-600">
          Такої сторінки не існує або задачу видалено.
        </p>
        <Link
          href="/"
          className="inline-block px-4 py-2 bg-black text-white rounded hover:bg-gray-800 text-sm"
        >
          На головну
        </Link>
      </div>
    </div>
  )
}