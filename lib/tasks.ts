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