'use client'

import { useState, useRef } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { saveUploadedVideo } from '@/app/tasks/[id]/actions'
import toast from 'react-hot-toast'

const MAX_SIZE_MB = 50
const ACCEPTED_TYPES = ['video/mp4', 'video/quicktime', 'video/webm', 'video/x-matroska']

type Props = {
  taskId: string
}

export function VideoUploader({ taskId }: Props) {
  const [isUploading, setIsUploading] = useState(false)
  const [progress, setProgress] = useState(0)
  const [stage, setStage] = useState<'upload' | 'probe' | 'scenes' | ''>('')
  const inputRef = useRef<HTMLInputElement>(null)
  const router = useRouter()

  async function handleFile(file: File) {
    if (!ACCEPTED_TYPES.includes(file.type)) {
      toast.error('Дозволені формати: MP4, MOV, WebM, MKV')
      return
    }
    if (file.size > MAX_SIZE_MB * 1024 * 1024) {
      toast.error(`Максимальний розмір ${MAX_SIZE_MB} MB`)
      return
    }

    setIsUploading(true)
    setProgress(0)
    setStage('upload')

    try {
      const supabase = createClient()

      const timestamp = Date.now()
      const cleanName = file.name.replace(/[^a-zA-Z0-9.-]/g, '_')
      const storagePath = `${taskId}/${timestamp}-${cleanName}`

      const { error: uploadError } = await supabase.storage
        .from('source-videos')
        .upload(storagePath, file, {
          upsert: false,
          contentType: file.type,
        })

      if (uploadError) {
        console.error('[VideoUploader] upload error:', uploadError)
        toast.error(`Помилка завантаження: ${uploadError.message}`)
        return
      }

      setProgress(33)

      const result = await saveUploadedVideo(taskId, storagePath)
      if (!result.success) {
        toast.error(result.error)
        return
      }

      // Probe
      setStage('probe')
      setProgress(50)
      try {
        const probeRes = await fetch(`/api/tasks/${taskId}/probe`, {
          method: 'POST',
        })
        if (probeRes.ok) {
          const data = await probeRes.json()
          toast.success(`Тривалість: ${Math.round(data.duration)}s`)
        } else {
          const err = await probeRes.json().catch(() => ({}))
          toast.error(err.error ?? 'Не вдалося визначити тривалість')
        }
      } catch (e) {
        console.error('[VideoUploader] probe failed:', e)
      }

      // Scene detection
      setStage('scenes')
      setProgress(75)
      try {
        const scenesRes = await fetch(`/api/tasks/${taskId}/detect-scenes`, {
          method: 'POST',
        })
        if (scenesRes.ok) {
          const data = await scenesRes.json()
          toast.success(`Знайдено сцен: ${data.count}`)
        } else {
          const err = await scenesRes.json().catch(() => ({}))
          toast.error(err.error ?? 'Не вдалося виявити сцени')
        }
      } catch (e) {
        console.error('[VideoUploader] scenes failed:', e)
      }

      setProgress(100)
      router.refresh()
    } catch (err) {
      console.error('[VideoUploader] unexpected:', err)
      toast.error('Несподівана помилка')
    } finally {
      setIsUploading(false)
      setStage('')
    }
  }

  const stageLabel = {
    upload: 'Завантаження…',
    probe: 'Визначення тривалості…',
    scenes: 'Пошук сцен…',
    '': '',
  }[stage]

  return (
    <div className="space-y-3">
      <input
        ref={inputRef}
        type="file"
        accept="video/mp4,video/quicktime,video/webm,video/x-matroska"
        disabled={isUploading}
        onChange={(e) => {
          const file = e.target.files?.[0]
          if (file) handleFile(file)
        }}
        className="block w-full text-sm text-gray-700
          file:mr-4 file:py-2 file:px-4
          file:rounded file:border-0
          file:text-sm file:font-medium
          file:bg-black file:text-white
          hover:file:bg-gray-800
          file:cursor-pointer
          disabled:opacity-50"
      />

      {isUploading && (
        <div className="space-y-1">
          <div className="text-xs text-gray-600">{stageLabel}</div>
          <div className="h-1.5 bg-gray-200 rounded overflow-hidden">
            <div
              className="h-full bg-black transition-all"
              style={{ width: `${progress}%` }}
            />
          </div>
        </div>
      )}

      <p className="text-xs text-gray-500">
        Формати: MP4, MOV, WebM, MKV. До {MAX_SIZE_MB} MB.
      </p>
    </div>
  )
}