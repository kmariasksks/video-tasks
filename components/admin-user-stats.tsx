import type { TaskStatsRow } from '@/lib/admin'

type Props = {
  rows: TaskStatsRow[]
}

export function AdminUserStats({ rows }: Props) {
  return (
    <div className="bg-white rounded-lg border overflow-hidden">
      <div className="px-4 py-3 border-b bg-gray-50">
        <h2 className="font-semibold">Задачі по користувачах</h2>
        <p className="text-xs text-gray-500 mt-0.5">
          Розподіл задач за автором і статусом
        </p>
      </div>

      {rows.length === 0 ? (
        <div className="p-6 text-sm text-gray-500 text-center">
          Немає даних
        </div>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-xs text-gray-500 uppercase tracking-wider border-b">
                <th className="px-4 py-2 font-medium">Користувач</th>
                <th className="px-4 py-2 font-medium text-right">Всього</th>
                <th className="px-4 py-2 font-medium text-right">Todo</th>
                <th className="px-4 py-2 font-medium text-right">In progress</th>
                <th className="px-4 py-2 font-medium text-right">Review</th>
                <th className="px-4 py-2 font-medium text-right">Done</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => (
                <tr key={row.user_id} className="border-b last:border-b-0 hover:bg-gray-50">
                  <td className="px-4 py-2">
                    <div className="font-medium">{row.full_name ?? row.email}</div>
                    {row.full_name && (
                      <div className="text-xs text-gray-500">{row.email}</div>
                    )}
                  </td>
                  <td className="px-4 py-2 text-right font-medium">
                    {row.total_tasks}
                  </td>
                  <td className="px-4 py-2 text-right text-gray-600">
                    {row.todo_count || '—'}
                  </td>
                  <td className="px-4 py-2 text-right text-gray-600">
                    {row.in_progress_count || '—'}
                  </td>
                  <td className="px-4 py-2 text-right text-gray-600">
                    {row.review_count || '—'}
                  </td>
                  <td className="px-4 py-2 text-right text-gray-600">
                    {row.done_count || '—'}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}