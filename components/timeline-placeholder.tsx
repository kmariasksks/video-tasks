import { formatTimecode } from '@/lib/scenes'
import { calculateVersionDuration } from '@/lib/versions'
import type { VersionSegment } from '@/types/database'

type Props = {
  segments: VersionSegment[]
}

export function TimelinePlaceholder({ segments }: Props) {
  const totalDuration = calculateVersionDuration(segments)

  if (segments.length === 0) {
    return (
      <div className="text-sm text-gray-500 border-2 border-dashed border-gray-300 rounded-lg p-6 text-center">
        Ця версія не має сегментів.
      </div>
    )
  }

  return (
    <div className="space-y-2">
      <div className="text-xs text-gray-600">
        Сегментів: {segments.length} · Загальна тривалість: {formatTimecode(totalDuration)}
      </div>
      <div className="space-y-1">
        {segments.map((seg, i) => (
          <div
            key={seg.id}
            className="flex items-center gap-3 py-2 px-3 border rounded text-sm bg-gray-50"
          >
            <div className="w-8 h-8 rounded bg-white border flex items-center justify-center font-medium text-xs shrink-0">
              {i + 1}
            </div>
            <span className="font-mono">
              {formatTimecode(seg.start_sec)} – {formatTimecode(seg.end_sec)}
            </span>
            <span className="text-gray-500 text-xs">
              {(seg.end_sec - seg.start_sec).toFixed(1)}s
            </span>
          </div>
        ))}
      </div>
      <div className="text-xs text-gray-400 italic mt-4">
        (drag&drop редактор буде тут наступним кроком)
      </div>
    </div>
  )
}