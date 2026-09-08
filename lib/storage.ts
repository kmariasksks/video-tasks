import { createClient } from '@/lib/supabase/server'

const SOURCE_BUCKET = 'source-videos'
const RENDERED_BUCKET = 'rendered-videos'
const SIGNED_URL_TTL_SEC = 60 * 60 // 1 година

export async function getSignedSourceVideoUrl(
  path: string
): Promise<string | null> {
  const supabase = await createClient()
  const { data, error } = await supabase.storage
    .from(SOURCE_BUCKET)
    .createSignedUrl(path, SIGNED_URL_TTL_SEC)

  if (error || !data) {
    console.error('[getSignedSourceVideoUrl] error:', JSON.stringify(error))
    return null
  }
  return data.signedUrl
}

export async function getSignedRenderedVideoUrl(
  path: string
): Promise<string | null> {
  const supabase = await createClient()
  const { data, error } = await supabase.storage
    .from(RENDERED_BUCKET)
    .createSignedUrl(path, SIGNED_URL_TTL_SEC)

  if (error || !data) {
    console.error('[getSignedRenderedVideoUrl] error:', JSON.stringify(error))
    return null
  }
  return data.signedUrl
}

export const STORAGE_BUCKETS = {
  SOURCE: SOURCE_BUCKET,
  RENDERED: RENDERED_BUCKET,
} as const