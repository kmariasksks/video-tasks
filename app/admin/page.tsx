import { notFound } from 'next/navigation'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/server'
import {
  getTasksStatsByUser,
  getRenderStats,
  getRecentErrors,
  getUniqueErrorTypes,
} from '@/lib/admin'
import { AdminUserStats } from '@/components/admin-user-stats'
import { AdminRenderStats } from '@/components/admin-render-stats'
import { AdminErrorsList } from '@/components/admin-errors-list'
import type { ErrorStage } from '@/types/database'
import { AdminTestAlertButton } from '@/components/admin-test-alert-button'

type PageProps = {
  searchParams: Promise<{ stage?: string; type?: string }>
}

const VALID_STAGES: ErrorStage[] = [
  'upload', 'scene_detection', 'render', 'auth', 'db', 'telegram', 'other',
]

export default async function AdminPage({ searchParams }: PageProps) {
  const { stage, type } = await searchParams

  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) return null

  // Перевіряємо чи адмін
  const { data: profile } = await supabase
    .from('profiles')
    .select('is_admin')
    .eq('id', user.id)
    .single()

  if (!profile?.is_admin) {
    notFound() // ховаємо існування адмінки від не-адмінів
  }

  const stageFilter = stage && VALID_STAGES.includes(stage as ErrorStage)
    ? (stage as ErrorStage)
    : undefined
  const typeFilter = type && type !== 'all' ? type : undefined

  const [userStats, renderStats, errors, errorTypes] = await Promise.all([
    getTasksStatsByUser(),
    getRenderStats(),
    getRecentErrors({
      stage: stageFilter,
      errorType: typeFilter,
      limit: 50,
    }),
    getUniqueErrorTypes(),
  ])

  return (
    <div className="min-h-screen bg-gray-50">
      <header className="border-b bg-white">
        <div className="max-w-6xl mx-auto px-6 py-4 flex justify-between items-center">
          <div>
            <h1 className="text-xl font-bold">Адмінка</h1>
            <p className="text-xs text-gray-500">Метрики і моніторинг</p>
          </div>
          <Link
            href="/"
            className="text-sm text-gray-600 hover:text-gray-900"
          >
            ← До дошки
          </Link>
        </div>
      </header>

      <main className="max-w-6xl mx-auto p-6 space-y-6">
        <AdminTestAlertButton />
        <AdminRenderStats stats={renderStats} />
        <AdminUserStats rows={userStats} />
        <AdminErrorsList
          errors={errors}
          errorTypes={errorTypes}
          currentStage={stage ?? 'all'}
          currentType={type ?? 'all'}
        />
      </main>
    </div>
  )
}