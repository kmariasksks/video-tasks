'use client'

import { useState, useTransition, useOptimistic } from 'react'
import { useRouter } from 'next/navigation'
import {
  DndContext,
  DragEndEvent,
  PointerSensor,
  KeyboardSensor,
  useSensor,
  useSensors,
  closestCenter,
} from '@dnd-kit/core'
import {
  SortableContext,
  useSortable,
  arrayMove,
  horizontalListSortingStrategy,
} from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import toast from 'react-hot-toast'
import { formatTimecode } from '@/lib/scenes'
import { calculateVersionDuration } from '@/lib/versions'
import {
  replaceVersionSegments,
  resetVersionToAutoDetect,
} from '@/app/tasks/[id]/actions'
import type { VersionSegment } from '@/types/database'

type Props = {
  taskId: string
  versionId: string
  segments: VersionSegment[]
  hasScenes: boolean
}

// Мінімальна ширина блоку в pixel'ах, щоб дуже короткі сегменти
// не ставали невидимими (0.5-секундний сегмент інакше — 5px).
const MIN_BLOCK_WIDTH_PX = 60
// Скільки px припадає на 1 секунду таймлайну (масштаб).
const PX_PER_SECOND = 40

export function TimelineEditor({
  taskId,
  versionId,
  segments: initialSegments,
  hasScenes,
}: Props) {
  const router = useRouter()
  const [, startTransition] = useTransition()
  const [isResetting, setIsResetting] = useState(false)
  const [cuttingId, setCuttingId] = useState<string | null>(null)
  const [cutValue, setCutValue] = useState('')

  const [optimisticSegments, setOptimisticSegments] = useOptimistic(
    initialSegments,
    (_current: VersionSegment[], newSegments: VersionSegment[]) => newSegments
  )

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
    useSensor(KeyboardSensor)
  )

  const totalDuration = calculateVersionDuration(optimisticSegments)

  async function persistSegments(newSegments: VersionSegment[]) {
    const payload = newSegments.map((s, i) => ({
      source_scene_id: s.source_scene_id,
      position: i,
      start_sec: s.start_sec,
      end_sec: s.end_sec,
    }))

    const result = await replaceVersionSegments(versionId, payload)
    if (!result.success) {
      toast.error(result.error)
    } else {
      router.refresh()
    }
  }

  function handleDragEnd(event: DragEndEvent) {
    const { active, over } = event
    if (!over || active.id === over.id) return

    const oldIndex = optimisticSegments.findIndex((s) => s.id === active.id)
    const newIndex = optimisticSegments.findIndex((s) => s.id === over.id)
    if (oldIndex === -1 || newIndex === -1) return

    const reordered = arrayMove(optimisticSegments, oldIndex, newIndex).map(
      (s, i) => ({ ...s, position: i })
    )

    startTransition(async () => {
      setOptimisticSegments(reordered)
      await persistSegments(reordered)
    })
  }

  function handleDelete(segmentId: string) {
    const filtered = optimisticSegments
      .filter((s) => s.id !== segmentId)
      .map((s, i) => ({ ...s, position: i }))

    startTransition(async () => {
      setOptimisticSegments(filtered)
      await persistSegments(filtered)
    })
  }

  function handleCutOpen(segmentId: string) {
    setCuttingId(segmentId)
    setCutValue('')
  }

  function handleCutConfirm() {
    if (!cuttingId) return

    const segment = optimisticSegments.find((s) => s.id === cuttingId)
    if (!segment) return

    const cutOffset = parseFloat(cutValue)
    if (isNaN(cutOffset) || cutOffset <= 0) {
      toast.error('Введи число більше 0')
      return
    }

    const segmentDuration = segment.end_sec - segment.start_sec
    if (cutOffset >= segmentDuration) {
      toast.error(`Розріз має бути менше тривалості сегмента (${segmentDuration.toFixed(1)}s)`)
      return
    }

    const cutAt = segment.start_sec + cutOffset

    // Дві нові частини замість однієї
    const firstPart: VersionSegment = {
      ...segment,
      end_sec: cutAt,
      id: `${segment.id}-a`, // тимчасовий id, БД дасть новий
    }
    const secondPart: VersionSegment = {
      ...segment,
      start_sec: cutAt,
      id: `${segment.id}-b`,
    }

    const newSegments = optimisticSegments.flatMap((s) => {
      if (s.id === cuttingId) return [firstPart, secondPart]
      return [s]
    }).map((s, i) => ({ ...s, position: i }))

    setCuttingId(null)
    setCutValue('')

    startTransition(async () => {
      setOptimisticSegments(newSegments)
      await persistSegments(newSegments)
    })
  }

  async function handleReset() {
    if (!hasScenes) return
    setIsResetting(true)
    try {
      const result = await resetVersionToAutoDetect(taskId, versionId)
      if (result.success) {
        toast.success('Таймлайн скинуто до автоматичного розбиття')
        router.refresh()
      } else {
        toast.error(result.error)
      }
    } finally {
      setIsResetting(false)
    }
  }

  if (optimisticSegments.length === 0) {
    return (
      <div className="space-y-3">
        <div className="text-sm text-gray-500 border-2 border-dashed border-gray-300 rounded-lg p-6 text-center">
          У цій версії немає сегментів.
        </div>
        {hasScenes && (
          <button
            onClick={handleReset}
            disabled={isResetting}
            className="text-sm px-3 py-1.5 border rounded hover:bg-gray-50 disabled:opacity-50"
          >
            {isResetting ? 'Скидаємо…' : 'Відновити з автовиявлення'}
          </button>
        )}
      </div>
    )
  }

  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center gap-3 flex-wrap text-xs text-gray-600">
        <div>
          Сегментів: <strong>{optimisticSegments.length}</strong> · Тривалість:{' '}
          <strong>{formatTimecode(totalDuration)}</strong>
        </div>
        <button
          onClick={handleReset}
          disabled={isResetting || !hasScenes}
          className="px-3 py-1 border rounded hover:bg-gray-50 disabled:opacity-50"
        >
          {isResetting ? 'Скидаємо…' : 'Скинути до auto'}
        </button>
      </div>

      <DndContext
        sensors={sensors}
        collisionDetection={closestCenter}
        onDragEnd={handleDragEnd}
      >
        <SortableContext
          items={optimisticSegments.map((s) => s.id)}
          strategy={horizontalListSortingStrategy}
        >
          <div className="overflow-x-auto border rounded-lg bg-gray-50 p-3">
            <div className="flex gap-2 items-stretch" style={{ minHeight: 100 }}>
              {optimisticSegments.map((seg, i) => (
                <SegmentBlock
                  key={seg.id}
                  segment={seg}
                  index={i}
                  onDelete={() => handleDelete(seg.id)}
                  onCut={() => handleCutOpen(seg.id)}
                />
              ))}
            </div>
          </div>
        </SortableContext>
      </DndContext>

      {cuttingId && (
        <CutDialog
          segment={optimisticSegments.find((s) => s.id === cuttingId)!}
          value={cutValue}
          onChange={setCutValue}
          onConfirm={handleCutConfirm}
          onCancel={() => setCuttingId(null)}
        />
      )}

      <p className="text-xs text-gray-500">
        Перетягуй блоки щоб змінити порядок. Тисни ✕ щоб видалити, «Різати» щоб розділити навпіл.
      </p>
    </div>
  )
}

function SegmentBlock({
  segment,
  index,
  onDelete,
  onCut,
}: {
  segment: VersionSegment
  index: number
  onDelete: () => void
  onCut: () => void
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } =
    useSortable({ id: segment.id })

  const duration = segment.end_sec - segment.start_sec
  const width = Math.max(duration * PX_PER_SECOND, MIN_BLOCK_WIDTH_PX)

  const style: React.CSSProperties = {
    transform: CSS.Transform.toString(transform),
    transition,
    width: `${width}px`,
    opacity: isDragging ? 0.4 : 1,
  }

  return (
    <div
      ref={setNodeRef}
      style={style}
      className="shrink-0 bg-white border border-gray-300 rounded shadow-sm flex flex-col overflow-hidden"
    >
      <div
        {...attributes}
        {...listeners}
        className="flex-1 px-2 py-2 cursor-grab active:cursor-grabbing touch-none flex flex-col justify-between"
      >
        <div className="flex items-start justify-between gap-1">
          <span className="text-xs font-medium text-gray-700">#{index + 1}</span>
          <button
            onClick={(e) => {
              e.stopPropagation()
              onDelete()
            }}
            onPointerDown={(e) => e.stopPropagation()}
            className="text-gray-400 hover:text-red-600 text-xs leading-none"
            title="Видалити сегмент"
          >
            ✕
          </button>
        </div>
        <div className="text-xs font-mono text-gray-700 mt-1">
          {formatTimecode(segment.start_sec)}–{formatTimecode(segment.end_sec)}
        </div>
        <div className="text-[10px] text-gray-500">{duration.toFixed(1)}s</div>
      </div>
      <button
        onClick={onCut}
        onPointerDown={(e) => e.stopPropagation()}
        className="text-[10px] px-2 py-1 border-t border-gray-200 text-gray-600 hover:bg-gray-50"
      >
        Різати
      </button>
    </div>
  )
}

function CutDialog({
  segment,
  value,
  onChange,
  onConfirm,
  onCancel,
}: {
  segment: VersionSegment
  value: string
  onChange: (v: string) => void
  onConfirm: () => void
  onCancel: () => void
}) {
  const duration = segment.end_sec - segment.start_sec

  return (
    <div
      className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50"
      onClick={onCancel}
    >
      <div
        className="bg-white rounded-lg p-6 w-full max-w-sm space-y-4"
        onClick={(e) => e.stopPropagation()}
      >
        <h3 className="font-semibold">Розділити сегмент</h3>
        <p className="text-sm text-gray-600">
          Сегмент триває <strong>{duration.toFixed(1)}s</strong>. На якій секунді розрізати?
        </p>
        <input
          type="number"
          min={0.1}
          max={duration - 0.1}
          step={0.1}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder={`0.1 – ${(duration - 0.1).toFixed(1)}`}
          autoFocus
          onKeyDown={(e) => {
            if (e.key === 'Enter') onConfirm()
            if (e.key === 'Escape') onCancel()
          }}
          className="w-full px-3 py-2 border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-blue-500"
        />
        <div className="flex justify-end gap-2">
          <button
            onClick={onCancel}
            className="px-4 py-2 text-sm border rounded hover:bg-gray-50"
          >
            Скасувати
          </button>
          <button
            onClick={onConfirm}
            className="px-4 py-2 text-sm bg-black text-white rounded hover:bg-gray-800"
          >
            Розділити
          </button>
        </div>
      </div>
    </div>
  )
}