import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { logError } from '@/lib/error-logger'

export async function POST() {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    return NextResponse.json({ error: 'Не залогінені' }, { status: 401 })
  }

  const { data: profile } = await supabase
    .from('profiles')
    .select('is_admin')
    .eq('id', user.id)
    .single()

  if (!profile?.is_admin) {
    return NextResponse.json({ error: 'Доступ заборонено' }, { status: 403 })
  }

  await logError({
    stage: 'other',
    message: `Test alert triggered manually from admin panel at ${new Date().toISOString()}`,
    errorType: 'ManualTest',
    userId: user.id,
    context: { source: 'admin-test-button' },
    critical: true,
  })

  return NextResponse.json({ success: true })
}