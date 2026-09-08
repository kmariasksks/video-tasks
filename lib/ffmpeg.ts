import { execFile } from 'child_process'
import { promisify } from 'util'

const execFileAsync = promisify(execFile)

/**
 * Читає метадані відео через ffprobe.
 * Повертає JSON у форматі, який видає ffprobe -show_format -show_streams.
 */
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