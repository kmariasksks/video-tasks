import type { RenderStats } from '@/lib/admin'

type Props = {
  stats: RenderStats
}

export function AdminRenderStats({ stats }: Props) {
  const successRate =
    stats.totalRenders > 0
      ? Math.round((stats.successCount / stats.totalRenders) * 100)
      : null

  return (
    <div className="bg-white rounded-lg border p-4">
      <h2 className="font-semibold mb-3">Статистика рендерів</h2>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <StatCard
          label="Всього рендерів"
          value={stats.totalRenders.toString()}
        />
        <StatCard
          label="Успішних"
          value={
            successRate !== null
              ? `${stats.successCount} (${successRate}%)`
              : stats.successCount.toString()
          }
          tone="success"
        />
        <StatCard
          label="Провалених"
          value={stats.failedCount.toString()}
          tone={stats.failedCount > 0 ? 'danger' : 'neutral'}
        />
        <StatCard
          label="Середній час"
          value={
            stats.averageDurationMs !== null
              ? `${(stats.averageDurationMs / 1000).toFixed(1)}s`
              : '—'
          }
        />
      </div>
    </div>
  )
}

function StatCard({
  label,
  value,
  tone = 'neutral',
}: {
  label: string
  value: string
  tone?: 'success' | 'danger' | 'neutral'
}) {
  const valueColor = {
    success: 'text-green-700',
    danger: 'text-red-700',
    neutral: 'text-gray-900',
  }[tone]

  return (
    <div>
      <div className="text-xs text-gray-500 uppercase tracking-wider mb-1">
        {label}
      </div>
      <div className={`text-2xl font-semibold ${valueColor}`}>{value}</div>
    </div>
  )
}