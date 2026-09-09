'use client'

import dynamic from 'next/dynamic'
import type { TaskWithAuthor } from '@/types/database'

const KanbanBoardClient = dynamic(
  () => import('./kanban-board-client').then((mod) => mod.KanbanBoardClient),
  {
    ssr: false,
    loading: () => (
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {['Todo', 'In progress', 'Review', 'Done'].map((label) => (
          <div
            key={label}
            className="rounded-lg border-2 border-gray-200 bg-gray-50 p-3 min-h-[400px]"
          >
            <div className="flex justify-between items-center mb-3">
              <h3 className="font-semibold text-sm uppercase tracking-wider text-gray-400">
                {label}
              </h3>
            </div>
            <div className="text-xs text-gray-300 text-center py-4">Завантаження…</div>
          </div>
        ))}
      </div>
    ),
  }
)

export function KanbanBoard({ tasks }: { tasks: TaskWithAuthor[] }) {
  return <KanbanBoardClient tasks={tasks} />
}