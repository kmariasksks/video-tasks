// Типи, що дзеркалять нашу схему в Supabase.
// Оновлюй цей файл коли додаєш/змінюєш колонки в БД.

export type TaskStatus = 'todo' | 'in_progress' | 'review' | 'done'

export type RenderStatus = 'pending' | 'rendering' | 'done' | 'failed'

export type ErrorStage =
  | 'upload'
  | 'scene_detection'
  | 'render'
  | 'auth'
  | 'db'
  | 'telegram'
  | 'other'

export interface Profile {
  id: string
  email: string
  full_name: string | null
  is_admin: boolean
  created_at: string
}

export interface Task {
  id: string
  user_id: string
  title: string
  description: string | null
  status: TaskStatus
  source_video_path: string | null
  source_video_duration_sec: number | null
  position: number
  created_at: string
  updated_at: string
}

export interface Scene {
  id: string
  task_id: string
  scene_index: number
  start_sec: number
  end_sec: number
  created_at: string
}

export interface Version {
  id: string
  task_id: string
  version_number: number
  name: string
  rendered_video_path: string | null
  rendered_duration_sec: number | null
  render_status: RenderStatus
  render_duration_ms: number | null
  render_error: string | null
  created_at: string
}

export interface VersionSegment {
  id: string
  version_id: string
  source_scene_id: string | null
  position: number
  start_sec: number
  end_sec: number
  created_at: string
}

export interface Comment {
  id: string
  task_id: string
  user_id: string
  body: string
  created_at: string
}

export interface ErrorLog {
  id: string
  stage: ErrorStage
  error_type: string | null
  message: string
  stack_trace: string | null
  user_id: string | null
  task_id: string | null
  context: Record<string, unknown> | null
  is_critical: boolean
  created_at: string
}

// Композитні типи — задача з розширеним контекстом
export interface TaskWithAuthor extends Task {
  author: Pick<Profile, 'full_name' | 'email'> | null
}