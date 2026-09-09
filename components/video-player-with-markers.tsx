'use client'

import { useRef } from 'react'
import { formatTimecode } from '@/lib/scenes'
import type { Scene } from '@/types/database'

type Props = {
  videoUrl: string
  duration: number | null
  scenes: Scene[]
}

export function VideoPlayerWithMarkers({ videoUrl, duration, scenes }: Props) {
  const videoRef = useRef<HTMLVideoElement>(null)

  function jumpTo(seconds: number) {
    const video = videoRef.current
    if (!video) return
    video.currentTime = seconds
    video.play().catch(() => {
      // Автоплей може бути заблокований браузером — не критично
    })
  }

  // Використовуємо duration з БД (з ffprobe), а не з відео-елемента.
  // Це потрібно, бо на момент рендеру відео ще не завантажене
  // і його duration невідомий, а нам треба порахувати left% для маркерів.
  const totalDuration = duration ?? 0

  return (
    <div className="space-y-2">
      <video
        ref={videoRef}
        controls
        src={videoUrl}
        className="w-full rounded border bg-black max-h-[500px]"
      >
        Ваш браузер не підтримує відео-тег
      </video>

      {scenes.length > 0 && totalDuration > 0 && (
        <div className="space-y-1">
          <div className="text-xs text-gray-500 flex justify-between">
            <span>Склейки на таймлайні ({scenes.length - 1})</span>
            <span className="text-gray-400">клікни щоб перейти</span>
          </div>

          {/* Смуга з маркерами */}
          <div className="relative h-8 bg-gray-100 rounded border border-gray-200">
            {/* Маркери — беремо scene.start_sec для кожної сцени крім першої (0) */}
            {scenes.slice(1).map((scene) => {
              const positionPercent = (scene.start_sec / totalDuration) * 100
              return (
                <button
                  key={scene.id}
                  onClick={() => jumpTo(scene.start_sec)}
                  title={`${formatTimecode(scene.start_sec)} — сцена ${scene.scene_index + 1}`}
                  className="absolute top-0 bottom-0 w-0.5 bg-red-500 hover:bg-red-600 hover:w-1 transition-all cursor-pointer"
                  style={{ left: `${positionPercent}%` }}
                />
              )
            })}

            {/* Мітки початку і кінця */}
            <div className="absolute left-1 top-1/2 -translate-y-1/2 text-[10px] text-gray-500 font-mono">
              0:00
            </div>
            <div className="absolute right-1 top-1/2 -translate-y-1/2 text-[10px] text-gray-500 font-mono">
              {formatTimecode(totalDuration)}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}