import { execFile, spawn } from 'child_process'
import { promisify } from 'util'

const execFileAsync = promisify(execFile)

export async function probeVideo(filePath: string): Promise<{
  duration: number
  format: string
  streams: Array<{ codec_type: string; codec_name: string; width?: number; height?: number }>
}> {
  const { stdout } = await execFileAsync('ffprobe', [
    '-v', 'quiet',
    '-print_format', 'json',
    '-show_format',
    '-show_streams',
    filePath,
  ])

  const data = JSON.parse(stdout)

  const duration = parseFloat(data.format?.duration ?? '0')
  const format = data.format?.format_name ?? 'unknown'
  const streams = (data.streams ?? []).map((s: {
    codec_type: string
    codec_name: string
    width?: number
    height?: number
  }) => ({
    codec_type: s.codec_type,
    codec_name: s.codec_name,
    width: s.width,
    height: s.height,
  }))

  return { duration, format, streams }
}

export type SceneRange = { start: number; end: number }

/**
 * Виявляє межі сцен через ffmpeg scene filter.
 * Повертає масив діапазонів [start, end] в секундах.
 * threshold — чутливість (0..1), 0.4 стандарт.
 */
export async function detectScenes(
  filePath: string,
  totalDuration: number,
  threshold = 0.1
): Promise<SceneRange[]> {
  return new Promise((resolve, reject) => {
    const proc = spawn('ffmpeg', [
      '-i', filePath,
      '-vf', `select='gt(scene,${threshold})',showinfo`,
      '-f', 'null',
      '-',
    ])

    let stderr = ''
    proc.stderr.on('data', (chunk) => {
      stderr += chunk.toString()
    })

    proc.on('error', (err) => reject(err))

    proc.on('close', (code) => {
      if (code !== 0) {
        reject(new Error(`ffmpeg exited with code ${code}. Last output: ${stderr.slice(-400)}`))
        return
      }

      // Парсимо pts_time з рядків showinfo
      const timestamps: number[] = []
      const regex = /pts_time:([\d.]+)/g
      let match: RegExpExecArray | null
      while ((match = regex.exec(stderr)) !== null) {
        const t = parseFloat(match[1])
        if (!isNaN(t) && t > 0 && t < totalDuration) {
          timestamps.push(t)
        }
      }

      // Сортуємо і викидаємо дублі (буває)
      const uniqueSorted = [...new Set(timestamps)].sort((a, b) => a - b)

      // Формуємо межі сцен: 0 → t1 → t2 → ... → duration
      const boundaries = [0, ...uniqueSorted, totalDuration]
      const scenes: SceneRange[] = []

      for (let i = 0; i < boundaries.length - 1; i++) {
        const start = boundaries[i]
        const end = boundaries[i + 1]
        // Фільтруємо мікросцени <100 мс — це шум від FFmpeg
        if (end - start >= 0.1) {
          scenes.push({ start, end })
        }
      }

      resolve(scenes)
    })
  })
}

export type RenderSegment = {
  start: number
  end: number
}

/**
 * Рендерить фінальне відео з переданих сегментів вихідного файлу.
 * Використовує filter_complex з trim + concat в одному виклику ffmpeg.
 */
  
export async function renderConcatVideo(

  sourceFilePath: string,
  outputFilePath: string,
  segments: RenderSegment[]
): Promise<void> {

  if (segments.length === 0) {
    throw new Error('Немає сегментів для рендеру')
  }

  // Будуємо filter_complex рядок
  const filterParts: string[] = []
  const concatInputs: string[] = []

  segments.forEach((seg, i) => {
    filterParts.push(
      `[0:v]trim=start=${seg.start}:end=${seg.end},setpts=PTS-STARTPTS[v${i}]`
    )
    filterParts.push(
      `[0:a]atrim=start=${seg.start}:end=${seg.end},asetpts=PTS-STARTPTS[a${i}]`
    )
    concatInputs.push(`[v${i}][a${i}]`)
  })

  filterParts.push(
    `${concatInputs.join('')}concat=n=${segments.length}:v=1:a=1[outv][outa]`
  )

  const filterComplex = filterParts.join(';')

  return new Promise((resolve, reject) => {
    const proc = spawn('ffmpeg', [
      '-y', // перезаписуй output якщо вже існує
      '-i', sourceFilePath,
      '-filter_complex', filterComplex,
      '-map', '[outv]',
      '-map', '[outa]',
      '-c:v', 'libx264',
      '-c:a', 'aac',
      '-preset', 'fast',
      '-movflags', '+faststart', // оптимізує mp4 для стрімінгу в браузері
      outputFilePath,
    ])

    let stderr = ''
    proc.stderr.on('data', (chunk) => {
      stderr += chunk.toString()
    })

    proc.on('error', (err) => reject(err))
    proc.on('close', (code) => {
      if (code !== 0) {
        reject(
          new Error(
            `ffmpeg render exited with code ${code}. Last output: ${stderr.slice(-500)}`
          )
        )
        return
      }
      resolve()
    })
  })
}