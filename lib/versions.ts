import type { VersionSegment } from '@/types/database'

/**
 * Загальна тривалість версії = сума тривалостей всіх сегментів.
 * Client-safe: не використовує серверні API.
 */
export function calculateVersionDuration(segments: VersionSegment[]): number {
  return segments.reduce((sum, seg) => sum + (seg.end_sec - seg.start_sec), 0)
}