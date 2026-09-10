const TELEGRAM_BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN
const TELEGRAM_CHAT_ID = process.env.TELEGRAM_CHAT_ID

// In-memory дедуплікація: {ключ-помилки: timestamp останньої відправки}
// В serverless це може скидатись між cold starts, але базовий флуд-контроль дає.
const recentAlerts = new Map<string, number>()
const DEDUP_WINDOW_MS = 5 * 60 * 1000 // 5 хвилин

function isRecentDuplicate(dedupKey: string): boolean {
  const lastSent = recentAlerts.get(dedupKey)
  if (!lastSent) return false
  return Date.now() - lastSent < DEDUP_WINDOW_MS
}

function markSent(dedupKey: string) {
  recentAlerts.set(dedupKey, Date.now())

  // Прибираємо старі записи щоб map не ріс безкінечно
  if (recentAlerts.size > 100) {
    const cutoff = Date.now() - DEDUP_WINDOW_MS
    for (const [key, ts] of recentAlerts.entries()) {
      if (ts < cutoff) recentAlerts.delete(key)
    }
  }
}

type TelegramAlertParams = {
  stage: string
  message: string
  taskId?: string | null
  userId?: string | null
  errorType?: string | null
}

/**
 * Відправляє алерт у Telegram. Fire-and-forget: не блокує викликача,
 * помилки самого Telegram тільки логуються в console.
 */
export function sendTelegramAlert(params: TelegramAlertParams): void {
  if (!TELEGRAM_BOT_TOKEN || !TELEGRAM_CHAT_ID) {
    console.warn('[telegram] TELEGRAM_BOT_TOKEN або TELEGRAM_CHAT_ID не задані, пропускаємо алерт')
    return
  }

  // Ключ дедуплікації: stage + errorType + перші 50 символів повідомлення.
  // Різні task_id того ж типу помилки — все одно шлемо (важливо знати масштаб),
  // але дублікати з тим самим текстом за 5 хв — тільки раз.
  const dedupKey = `${params.stage}:${params.errorType ?? 'unknown'}:${params.message.slice(0, 50)}`

  if (isRecentDuplicate(dedupKey)) {
    console.log('[telegram] Пропускаємо дубль:', dedupKey)
    return
  }

  markSent(dedupKey)

  // Форматуємо повідомлення в HTML
  const escapedMessage = escapeHtml(params.message)
  const text = [
    `🚨 <b>CRITICAL: ${escapeHtml(params.stage)}</b>`,
    params.errorType && `<b>Тип:</b> <code>${escapeHtml(params.errorType)}</code>`,
    ``,
    `<b>Повідомлення:</b>`,
    `<pre>${escapedMessage}</pre>`,
    params.taskId && `<b>Task:</b> <code>${escapeHtml(params.taskId)}</code>`,
    params.userId && `<b>User:</b> <code>${escapeHtml(params.userId)}</code>`,
    ``,
    `<i>${new Date().toISOString()}</i>`,
  ]
    .filter(Boolean)
    .join('\n')

  // Fire-and-forget — не await
  fetch(`https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/sendMessage`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      chat_id: TELEGRAM_CHAT_ID,
      text,
      parse_mode: 'HTML',
      disable_web_page_preview: true,
    }),
  })
    .then(async (res) => {
      if (!res.ok) {
        const body = await res.text()
        console.error('[telegram] API error:', res.status, body)
      }
    })
    .catch((err) => {
      console.error('[telegram] fetch failed:', err)
    })
}

function escapeHtml(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
}