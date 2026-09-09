'use client'

import dynamic from 'next/dynamic'
import type { VersionSegment } from '@/types/database'

const TimelineEditorInner = dynamic(
  () => import('./timeline-editor').then((mod) => mod.TimelineEditor),
  {
    ssr: false,
    loading: () => (
      <div className="border rounded-lg bg-gray-50 p-6 text-center text-sm text-gray-500">
        Завантаження таймлайну…
      </div>
    ),
  }
)

type Props = {
  taskId: string
  versionId: string
  segments: VersionSegment[]
  hasScenes: boolean
}

export function TimelineEditor(props: Props) {
  return <TimelineEditorInner {...props} />
}