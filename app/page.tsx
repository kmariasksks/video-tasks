import { createClient } from '@/lib/supabase/server'
import { signOut } from '@/app/auth/actions'
import { getAllTasks } from '@/lib/tasks'
import { KanbanBoard } from '@/components/kanban-board'
import { CreateTaskDialog } from '@/components/create-task-dialog'

export default async function Home() {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) return null

  const [{ data: profile }, tasks] = await Promise.all([
    supabase
      .from('profiles')
      .select('full_name, is_admin')
      .eq('id', user.id)
      .single(),
    getAllTasks(),
  ])

  return (
    <div className="min-h-screen bg-gray-50">
      <header className="border-b bg-white">
        <div className="max-w-7xl mx-auto px-6 py-4 flex justify-between items-center">
          <h1 className="text-xl font-bold">Video Tasks</h1>

          <div className="flex items-center gap-4">
            {profile?.is_admin && (
              <a
                href="/admin"
                className="text-sm text-blue-600 hover:underline"
              >
                Адмінка
              </a>
            )}
            <div className="text-sm text-right">
              <div className="font-medium">
                {profile?.full_name ?? user.email}
              </div>
              <div className="text-gray-500 text-xs">{user.email}</div>
            </div>
            <form action={signOut}>
              <button
                type="submit"
                className="text-sm px-3 py-1.5 border rounded hover:bg-gray-50"
              >
                Вийти
              </button>
            </form>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto p-6 space-y-4">
        <div className="flex justify-between items-center">
          <h2 className="text-lg font-semibold">Дошка задач</h2>
          <CreateTaskDialog />
        </div>

        <KanbanBoard tasks={tasks} />
      </main>
    </div>
  )
}