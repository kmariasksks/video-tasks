import { mkdtemp, rm } from 'fs/promises'
import { tmpdir } from 'os'
import { join } from 'path'

/**
 * Створює тимчасову папку в системному tmp, повертає її шлях.
 * Використовуй з try/finally + cleanupTempDir, щоб гарантувати чистку.
 */
export async function createTempDir(prefix = 'video-tasks-'): Promise<string> {
  return await mkdtemp(join(tmpdir(), prefix))
}

/**
 * Видаляє папку рекурсивно. Не кидає помилку, якщо папка вже не існує.
 */
export async function cleanupTempDir(dir: string): Promise<void> {
  try {
    await rm(dir, { recursive: true, force: true })
  } catch (err) {
    console.error('[cleanupTempDir] error:', err)
  }
}