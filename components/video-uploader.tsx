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

      setProgress(50)

      const result = await saveUploadedVideo(taskId, storagePath)
      if (!result.success) {
        toast.error(result.error)
        return
      }

      setProgress(100)
      toast.success('Відео завантажено, аналізуємо…')

      // Тригеримо probe у фоні
      try {
        const probeResponse = await fetch(`/api/tasks/${taskId}/probe`, {
          method: 'POST',
        })
        if (probeResponse.ok) {
          const data = await probeResponse.json()
          toast.success(`Тривалість: ${Math.round(data.duration)}s`)
          router.refresh() // duration оновлюється в UI без ручного refresh
        } else {
          const errData = await probeResponse.json().catch(() => ({}))
          toast.error(
            errData.error ?? 'Не вдалося визначити тривалість (не критично)'
          )
        }
      } catch (probeErr) {
        console.error('[VideoUploader] probe fetch failed:', probeErr)
        toast.error('Не вдалося визначити тривалість (не критично)')
      }
    } catch (err) {
      console.error('[VideoUploader] unexpected:', err)
      toast.error('Несподівана помилка')
    } finally {
      setIsUploading(false)
    }
  }

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
          <div className="text-xs text-gray-600">
            {progress < 100 ? 'Завантаження…' : 'Готово'}
          </div>
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