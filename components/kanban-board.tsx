import Link from 'next/link'
import {
  TASK_STATUSES,
  TASK_STATUS_LABELS,
  groupTasksByStatus,
} from '@/lib/tasks'
import type { TaskWithAuthor } from '@/types/database'

const STATUS_COLORS: Record<string, string> = {
  todo: 'bg-gray-100 border-gray-300',
  in_progress: 'bg-blue-50 border-blue-300',
  review: 'bg-yellow-50 border-yellow-300',
  done: 'bg-green-50 border-green-300',
}

export function KanbanBoard({ tasks }: { tasks: TaskWithAuthor[] }) {
  const grouped = groupTasksByStatus(tasks)

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
      {TASK_STATUSES.map((status) => (
        <div
          key={status}
          className={`rounded-lg border-2 ${STATUS_COLORS[status]} p-3 min-h-[400px]`}
        >
          <div className="flex justify-between items-center mb-3">
            <h3 className="font-semibold text-sm uppercase tracking-wider">
              {TASK_STATUS_LABELS[status]}
            </h3>
            <span className="text-xs text-gray-500">
              {grouped[status].length}
            </span>
          </div>

          <div className="space-y-2">
            {grouped[status].length === 0 && (
              <p className="text-xs text-gray-400 italic text-center py-4">
                Порожньо
              </p>
            )}
            {grouped[status].map((task) => (
              <TaskCard key={task.id} task={task} />
            ))}
          </div>
        </div>
      ))}
    </div>
  )
}

function TaskCard({ task }: { task: TaskWithAuthor }) {
  return (
    <Link
      href={`/tasks/${task.id}`}
      className="block bg-white rounded p-3 shadow-sm border border-gray-200 hover:shadow-md transition-shadow"
    >
      <h4 className="font-medium text-sm mb-1 line-clamp-2">{task.title}</h4>
      {task.description && (
        <p className="text-xs text-gray-600 line-clamp-2 mb-2">
          {task.description}
        </p>
      )}
      <div className="flex justify-between items-center text-xs text-gray-500 mt-2">
        <span className="truncate">
          {task.author?.full_name ?? task.author?.email ?? 'Unknown'}
        </span>
        {task.source_video_duration_sec !== null && (
          <span className="ml-2 shrink-0">
            {Math.round(task.source_video_duration_sec)}s
          </span>
        )}
      </div>
    </Link>
  )
}