import { createClient } from '@/lib/supabase/server'
import type { TaskStatus, TaskWithAuthor } from '@/types/database'

export const TASK_STATUSES: TaskStatus[] = ['todo', 'in_progress', 'review', 'done']

export const TASK_STATUS_LABELS: Record<TaskStatus, string> = {
  todo: 'Todo',
  in_progress: 'In progress',
  review: 'Review',
  done: 'Done',
}

export async function getAllTasks(): Promise<TaskWithAuthor[]> {
  const supabase = await createClient()

  const { data: tasks, error: tasksError } = await supabase
    .from('tasks')
    .select('*')
    .order('position', { ascending: true })
    .order('created_at', { ascending: true })

  if (tasksError) {
    console.error('[getAllTasks] tasks error:', JSON.stringify(tasksError, null, 2))
    return []
  }

  if (!tasks || tasks.length === 0) return []

  // Збираємо унікальні user_id щоб одним запитом підтягнути всі профілі
  const userIds = [...new Set(tasks.map((t) => t.user_id))]

  const { data: profiles, error: profilesError } = await supabase
    .from('profiles')
    .select('id, full_name, email')
    .in('id', userIds)

  if (profilesError) {
    console.error('[getAllTasks] profiles error:', JSON.stringify(profilesError, null, 2))
    return tasks.map((t) => ({ ...t, author: null })) as TaskWithAuthor[]
  }

  const profilesMap = new Map(profiles?.map((p) => [p.id, p]) ?? [])

  return tasks.map((t) => {
    const profile = profilesMap.get(t.user_id)
    return {
      ...t,
      author: profile
        ? { full_name: profile.full_name, email: profile.email }
        : null,
    }
  }) as TaskWithAuthor[]
}

export function groupTasksByStatus(
  tasks: TaskWithAuthor[]
): Record<TaskStatus, TaskWithAuthor[]> {
  const grouped: Record<TaskStatus, TaskWithAuthor[]> = {
    todo: [],
    in_progress: [],
    review: [],
    done: [],
  }

  for (const task of tasks) {
    grouped[task.status].push(task)
  }

  return grouped
}

export async function getTaskById(taskId: string): Promise<TaskWithAuthor | null> {
  const supabase = await createClient()

  const { data: task, error } = await supabase
    .from('tasks')
    .select('*')
    .eq('id', taskId)
    .single()

  if (error || !task) {
    return null
  }

  // Підтягуємо автора окремим запитом (як у getAllTasks)
  const { data: profile } = await supabase
    .from('profiles')
    .select('id, full_name, email')
    .eq('id', task.user_id)
    .single()

  return {
    ...task,
    author: profile
      ? { full_name: profile.full_name, email: profile.email }
      : null,
  } as TaskWithAuthor
}

export function formatDuration(seconds: number | null): string {
  if (seconds === null || seconds < 0) return '—'

  const totalSeconds = Math.round(seconds)
  const minutes = Math.floor(totalSeconds / 60)
  const remainingSeconds = totalSeconds % 60

  if (minutes === 0) {
    return `${remainingSeconds}s`
  }

  return `${minutes}m ${remainingSeconds.toString().padStart(2, '0')}s`
}

import type { Scene } from '@/types/database'
// ↑ додай Scene в існуючий імпорт з types/database, або окремим рядком

export async function getScenesForTask(taskId: string): Promise<Scene[]> {
  const supabase = await createClient()

  const { data, error } = await supabase
    .from('scenes')
    .select('*')
    .eq('task_id', taskId)
    .order('scene_index', { ascending: true })

  if (error) {
    console.error('[getScenesForTask] error:', JSON.stringify(error))
    return []
  }

  return (data ?? []) as Scene[]
}

import type { Version, VersionSegment } from '@/types/database'
// ↑ якщо Version/VersionSegment ще не в цьому імпорті — додай їх

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