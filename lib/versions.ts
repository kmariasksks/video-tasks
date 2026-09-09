import { createClient } from '@/lib/supabase/server'
import type { Version, VersionSegment } from '@/types/database'

export async function getVersionsForTask(taskId: string): Promise<Version[]> {
  const supabase = await createClient()

  const { data, error } = await supabase
    .from('versions')
    .select('*')
    .eq('task_id', taskId)
    .order('version_number', { ascending: true })

  if (error) {
    console.error('[getVersionsForTask] error:', JSON.stringify(error))
    return []
  }

  return (data ?? []) as Version[]
}

export async function getVersionSegments(
  versionId: string
): Promise<VersionSegment[]> {
  const supabase = await createClient()

  const { data, error } = await supabase
    .from('version_segments')
    .select('*')
    .eq('version_id', versionId)
    .order('position', { ascending: true })

  if (error) {
    console.error('[getVersionSegments] error:', JSON.stringify(error))
    return []
  }

  return (data ?? []) as VersionSegment[]
}

/**
 * Загальна тривалість версії = сума тривалостей всіх сегментів.
 * Використовується для UI (показ поточної довжини монтажу) і для рендеру.
 */
export function calculateVersionDuration(segments: VersionSegment[]): number {
  return segments.reduce((sum, seg) => sum + (seg.end_sec - seg.start_sec), 0)
}