'use client'

import { useOptimistic, useTransition } from 'react'
import Link from 'next/link'
import {
  DndContext,
  DragEndEvent,
  DragOverlay,
  DragStartEvent,
  PointerSensor,
  KeyboardSensor,
  useSensor,
  useSensors,
  useDraggable,
  useDroppable,
} from '@dnd-kit/core'
import { useState } from 'react'
import toast from 'react-hot-toast'
import { updateTaskStatus } from '@/app/tasks/actions'
import type { TaskStatus, TaskWithAuthor } from '@/types/database'

const TASK_STATUSES: TaskStatus[] = ['todo', 'in_progress', 'review', 'done']

const TASK_STATUS_LABELS: Record<TaskStatus, string> = {
  todo: 'Todo',
  in_progress: 'In progress',
  review: 'Review',
  done: 'Done',
}

const STATUS_COLORS: Record<TaskStatus, string> = {
  todo: 'bg-gray-100 border-gray-300',
  in_progress: 'bg-blue-50 border-blue-300',
  review: 'bg-yellow-50 border-yellow-300',
  done: 'bg-green-50 border-green-300',
}

type OptimisticAction = {
  taskId: string
  newStatus: TaskStatus
}

export function KanbanBoardClient({ tasks }: { tasks: TaskWithAuthor[] }) {
  const [, startTransition] = useTransition()
  const [activeId, setActiveId] = useState<string | null>(null)

  // useOptimistic бере "справжній" стейт і функцію-редьюсер.
  // При виклику addOptimistic — вона застосовує зміну до локального стану,
  // не чекаючи серверу.
  const [optimisticTasks, addOptimistic] = useOptimistic(
    tasks,
    (current: TaskWithAuthor[], action: OptimisticAction) =>
      current.map((t) =>
        t.id === action.taskId ? { ...t, status: action.newStatus } : t
      )
  )

  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: { distance: 5 }, // потрібно потягнути ≥5px, щоб не тригерити перетягування на звичайному кліку
    }),
    useSensor(KeyboardSensor)
  )

  const activeTask = activeId
    ? optimisticTasks.find((t) => t.id === activeId) ?? null
    : null

  function handleDragStart(event: DragStartEvent) {
    setActiveId(String(event.active.id))
  }

  async function handleDragEnd(event: DragEndEvent) {
    const { active, over } = event
    setActiveId(null)

    if (!over) return // впустили не на колонку

    const taskId = String(active.id)
    const newStatus = over.id as TaskStatus
    const task = optimisticTasks.find((t) => t.id === taskId)

    if (!task || task.status === newStatus) return // не змінилось

    // Оптимістично оновлюємо UI + запит до сервера в тому ж transition
    startTransition(async () => {
      addOptimistic({ taskId, newStatus })
      const result = await updateTaskStatus(taskId, newStatus)
      if (!result.success) {
        toast.error(result.error)
        // useOptimistic автоматично відкотиться, коли server-render повернеться зі старим станом
      }
    })
  }

  const grouped: Record<TaskStatus, TaskWithAuthor[]> = {
    todo: [],
    in_progress: [],
    review: [],
    done: [],
  }
  for (const task of optimisticTasks) {
    grouped[task.status].push(task)
  }

  return (
    <DndContext sensors={sensors} onDragStart={handleDragStart} onDragEnd={handleDragEnd}>
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {TASK_STATUSES.map((status) => (
          <Column key={status} status={status} tasks={grouped[status]} />
        ))}
      </div>

      <DragOverlay>
        {activeTask ? <TaskCard task={activeTask} isDragging /> : null}
      </DragOverlay>
    </DndContext>
  )
}

function Column({
  status,
  tasks,
}: {
  status: TaskStatus
  tasks: TaskWithAuthor[]
}) {
  const { isOver, setNodeRef } = useDroppable({ id: status })

  return (
    <div
      ref={setNodeRef}
      className={`rounded-lg border-2 ${STATUS_COLORS[status]} p-3 min-h-[400px] transition-colors ${
        isOver ? 'ring-2 ring-blue-400 ring-offset-2' : ''
      }`}
    >
      <div className="flex justify-between items-center mb-3">
        <h3 className="font-semibold text-sm uppercase tracking-wider">
          {TASK_STATUS_LABELS[status]}
        </h3>
        <span className="text-xs text-gray-500">{tasks.length}</span>
      </div>

      <div className="space-y-2">
        {tasks.length === 0 && (
          <p className="text-xs text-gray-400 italic text-center py-4">
            Порожньо
          </p>
        )}
        {tasks.map((task) => (
          <DraggableTaskCard key={task.id} task={task} />
        ))}
      </div>
    </div>
  )
}

function DraggableTaskCard({ task }: { task: TaskWithAuthor }) {
  const { attributes, listeners, setNodeRef, isDragging } = useDraggable({
    id: task.id,
  })

  return (
    <div
      ref={setNodeRef}
      {...listeners}
      {...attributes}
      className={`touch-none ${isDragging ? 'opacity-30' : ''}`}
    >
      <TaskCard task={task} />
    </div>
  )
}

function TaskCard({
  task,
  isDragging,
}: {
  task: TaskWithAuthor
  isDragging?: boolean
}) {
  return (
    <Link
      href={`/tasks/${task.id}`}
      onClick={(e) => {
        if (isDragging) e.preventDefault() // при перетягуванні не переходити
      }}
      draggable={false}
      className={`block bg-white rounded p-3 shadow-sm border border-gray-200 hover:shadow-md transition-shadow ${
        isDragging ? 'cursor-grabbing shadow-lg' : 'cursor-grab'
      }`}
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