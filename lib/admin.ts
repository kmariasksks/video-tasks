import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import type { ErrorLog, ErrorStage } from '@/types/database'

export type TaskStatsRow = {
  user_id: string
  full_name: string | null
  email: string
  total_tasks: number
  todo_count: number
  in_progress_count: number
  review_count: number
  done_count: number
}

export type RenderStats = {
  totalRenders: number
  successCount: number
  failedCount: number
  averageDurationMs: number | null
}

export async function getTasksStatsByUser(): Promise<TaskStatsRow[]> {
  const supabase = await createClient()
  const { data, error } = await supabase.rpc('get_tasks_stats_by_user')

  if (error) {
    console.error('[getTasksStatsByUser] error:', JSON.stringify(error))
    return []
  }

  return (data ?? []) as TaskStatsRow[]
}

export async function getRenderStats(): Promise<RenderStats> {
  const admin = createAdminClient()

  const { data: renders, error } = await admin
    .from('versions')
    .select('render_status, render_duration_ms')
    .in('render_status', ['done', 'failed'])

  if (error || !renders) {
    console.error('[getRenderStats] error:', JSON.stringify(error))
    return {
      totalRenders: 0,
      successCount: 0,
      failedCount: 0,
      averageDurationMs: null,
    }
  }

  const successful = renders.filter((r) => r.render_status === 'done')
  const failed = renders.filter((r) => r.render_status === 'failed')

  const durationsMs = successful
    .map((r) => r.render_duration_ms)
    .filter((d): d is number => d !== null && d > 0)

  const averageDurationMs =
    durationsMs.length > 0
      ? durationsMs.reduce((sum, d) => sum + d, 0) / durationsMs.length
      : null

  return {
    totalRenders: renders.length,
    successCount: successful.length,
    failedCount: failed.length,
    averageDurationMs,
  }
}

type ErrorFilter = {
  stage?: ErrorStage
  errorType?: string
  limit?: number
}

export async function getRecentErrors(
  filter: ErrorFilter = {}
): Promise<ErrorLog[]> {
  const admin = createAdminClient()

  let query = admin
    .from('error_logs')
    .select('*')
    .order('created_at', { ascending: false })
    .limit(filter.limit ?? 50)

  if (filter.stage) {
    query = query.eq('stage', filter.stage)
  }
  if (filter.errorType) {
    query = query.eq('error_type', filter.errorType)
  }

  const { data, error } = await query

  if (error) {
    console.error('[getRecentErrors] error:', JSON.stringify(error))
    return []
  }

  return (data ?? []) as ErrorLog[]
}

export async function getUniqueErrorTypes(): Promise<string[]> {
  const admin = createAdminClient()

  const { data, error } = await admin
    .from('error_logs')
    .select('error_type')
    .not('error_type', 'is', null)
    .limit(500)

  if (error || !data) return []

  const unique = [...new Set(data.map((r) => r.error_type as string))]
  return unique.sort()
}