import { KanbanBoardClient } from './kanban-board-client'
import type { TaskWithAuthor } from '@/types/database'

export function KanbanBoard({ tasks }: { tasks: TaskWithAuthor[] }) {
  return <KanbanBoardClient tasks={tasks} />
}