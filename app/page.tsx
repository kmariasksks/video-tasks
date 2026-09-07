import { createClient } from '@/lib/supabase/server'

export default async function Home() {
  const supabase = await createClient()

  const { data: tasks, error } = await supabase
    .from('tasks')
    .select('id')

  return (
    <main className="min-h-screen flex items-center justify-center p-8">
      <div className="max-w-lg space-y-4 text-center">
        <h1 className="text-3xl font-bold">Video Tasks</h1>
        <p className="text-gray-600">Smoke test</p>

        {error ? (
          <div className="border border-red-300 bg-red-50 rounded p-4 text-left">
            <p className="font-semibold text-red-700">Supabase error</p>
            <pre className="text-xs mt-2 text-red-900 whitespace-pre-wrap">
              {error.message}
            </pre>
          </div>
        ) : (
          <div className="border border-green-300 bg-green-50 rounded p-4">
            <p className="font-semibold text-green-700">
              ✓ Connected to Supabase
            </p>
            <p className="text-sm mt-1 text-green-900">
              Tasks visible: {tasks?.length ?? 0}
            </p>
            <p className="text-xs mt-2 text-gray-600">
              (0 очікувано — RLS блокує читання без сесії)
            </p>
          </div>
        )}
      </div>
    </main>
  )
}