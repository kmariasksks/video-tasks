import { createClient } from '@/lib/supabase/server'
import { signOut } from '@/app/auth/actions'

export default async function Home() {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  // Middleware вже гарантує що user не null тут,
  // але TypeScript цього не знає — тому перестраховуємось.
  if (!user) return null

  const { data: profile } = await supabase
    .from('profiles')
    .select('full_name, is_admin')
    .eq('id', user.id)
    .single()

  return (
    <div className="min-h-screen">
      <header className="border-b bg-white">
        <div className="max-w-6xl mx-auto px-6 py-4 flex justify-between items-center">
          <h1 className="text-xl font-bold">Video Tasks</h1>

          <div className="flex items-center gap-4">
            <div className="text-sm text-right">
              <div className="font-medium">{profile?.full_name ?? user.email}</div>
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

      <main className="max-w-6xl mx-auto p-6">
        <div className="border-2 border-dashed border-gray-300 rounded-lg p-12 text-center text-gray-500">
          <p className="text-lg">Kanban board</p>
          <p className="text-sm mt-1">Буде тут завтра</p>
        </div>
      </main>
    </div>
  )
}