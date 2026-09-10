import { createAdminClient } from '@/lib/supabase/admin'
import { sendTelegramAlert } from '@/lib/telegram'
import type { ErrorStage } from '@/types/database'

type LogErrorOptions = {
  stage: ErrorStage
  message: string
  error?: unknown
  errorType?: string
  taskId?: string | null
  userId?: string | null
  context?: Record<string, unknown>
  critical?: boolean
}

/**
 * Централізована функція логування помилок.
 * - Пише в public.error_logs
 * - Якщо critical=true — шле Telegram-алерт (fire-and-forget)
 * - Дублює в console.error для локального дебагу
 *
 * Ніколи не кидає exception сама — щоб логер не міг зламати основну логіку.
 */
export async function logError(options: LogErrorOptions): Promise<void> {
  const {
    stage,
    message,
    error,
    errorType,
    taskId,
    userId,
    context,
    critical = false,
  } = options

  // Дублюємо в console — це помічне при локальній розробці
  console.error(`[${stage}] ${message}`, error ?? '')

  // Витягуємо stack trace якщо є
  let stackTrace: string | null = null
  let inferredErrorType: string | null = errorType ?? null

  if (error instanceof Error) {
    stackTrace = error.stack ?? null
    if (!inferredErrorType) {
      inferredErrorType = error.name || 'Error'
    }
  } else if (typeof error === 'string') {
    stackTrace = error
  } else if (error && typeof error === 'object') {
    // Supabase-помилки (не Error instances) — серіалізуємо як JSON
    try {
      stackTrace = JSON.stringify(error, null, 2)
    } catch {
      stackTrace = String(error)
    }
  }

  // Пишемо в БД
  try {
    const admin = createAdminClient()
    const { error: insertError } = await admin.from('error_logs').insert({
      stage,
      error_type: inferredErrorType,
      message,
      stack_trace: stackTrace,
      user_id: userId ?? null,
      task_id: taskId ?? null,
      context: context ?? null,
      is_critical: critical,
    })

    if (insertError) {
      // Не робимо recursive logError — це заклинило б рекурсію.
      // Просто console.
      console.error('[logError] Не вдалося записати в error_logs:', insertError)
    }
  } catch (dbErr) {
    console.error('[logError] Виняток при записі в БД:', dbErr)
  }

  // Telegram алерт для критичних
  if (critical) {
    sendTelegramAlert({
      stage,
      message,
      taskId,
      userId,
      errorType: inferredErrorType,
    })
  }
}