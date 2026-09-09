'use client'

import { useState, useTransition, useRef } from 'react'
import { useRouter } from 'next/navigation'
import toast from 'react-hot-toast'
import { addComment, deleteComment } from '@/app/tasks/[id]/actions'
import type { CommentWithAuthor } from '@/lib/tasks'

type Props = {
  taskId: string
  comments: CommentWithAuthor[]
  currentUserId: string
}

export function CommentsSection({ taskId, comments, currentUserId }: Props) {
  const router = useRouter()
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [body, setBody] = useState('')
  const [deletingId, setDeletingId] = useState<string | null>(null)
  const [, startTransition] = useTransition()
  const textareaRef = useRef<HTMLTextAreaElement>(null)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!body.trim()) return

    setIsSubmitting(true)
    try {
      const result = await addComment(taskId, body)
      if (result.success) {
        setBody('')
        textareaRef.current?.focus()
        router.refresh()
      } else {
        toast.error(result.error)
      }
    } finally {
      setIsSubmitting(false)
    }
  }

  async function handleDelete(commentId: string) {
    setDeletingId(commentId)
    startTransition(async () => {
      const result = await deleteComment(commentId, taskId)
      if (result.success) {
        router.refresh()
      } else {
        toast.error(result.error)
      }
      setDeletingId(null)
    })
  }

  return (
    <div className="bg-white rounded-lg border p-6 space-y-4">
      <h2 className="font-semibold">
        Коментарі{' '}
        <span className="text-gray-400 font-normal">({comments.length})</span>
      </h2>

      <form onSubmit={handleSubmit} className="space-y-2">
        <textarea
          ref={textareaRef}
          value={body}
          onChange={(e) => setBody(e.target.value)}
          placeholder="Додати коментар…"
          rows={3}
          maxLength={2000}
          disabled={isSubmitting}
          onKeyDown={(e) => {
            // Cmd+Enter (Mac) або Ctrl+Enter (Win) відправляє
            if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) {
              e.preventDefault()
              handleSubmit(e as unknown as React.FormEvent)
            }
          }}
          className="w-full px-3 py-2 border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none disabled:opacity-50"
        />
        <div className="flex justify-between items-center gap-2">
          <div className="text-xs text-gray-400">
            {body.length > 0 && `${body.length} / 2000`}
            {body.length === 0 && 'Cmd+Enter для швидкого надсилання'}
          </div>
          <button
            type="submit"
            disabled={isSubmitting || !body.trim()}
            className="text-sm px-4 py-1.5 bg-black text-white rounded hover:bg-gray-800 disabled:opacity-50"
          >
            {isSubmitting ? 'Надсилаємо…' : 'Надіслати'}
          </button>
        </div>
      </form>

      {comments.length === 0 ? (
        <div className="text-sm text-gray-500 text-center py-6 border-t">
          Ще немає коментарів. Будь першим.
        </div>
      ) : (
        <div className="space-y-3 border-t pt-4">
          {comments.map((comment) => {
            const isOwn = comment.user_id === currentUserId
            const authorName =
              comment.author?.full_name ?? comment.author?.email ?? 'Unknown'

            return (
              <div key={comment.id} className="group">
                <div className="flex justify-between items-baseline gap-2 mb-1">
                  <div className="flex items-baseline gap-2 min-w-0">
                    <span className="font-medium text-sm truncate">
                      {authorName}
                    </span>
                    <span className="text-xs text-gray-500 shrink-0">
                      {formatCommentTime(comment.created_at)}
                    </span>
                  </div>
                  {isOwn && (
                    <button
                      onClick={() => handleDelete(comment.id)}
                      disabled={deletingId === comment.id}
                      className="text-xs text-gray-400 hover:text-red-600 opacity-0 group-hover:opacity-100 transition-opacity disabled:opacity-50"
                      title="Видалити коментар"
                    >
                      {deletingId === comment.id ? '…' : 'видалити'}
                    </button>
                  )}
                </div>
                <div className="text-sm text-gray-700 whitespace-pre-wrap break-words">
                  {comment.body}
                </div>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}

function formatCommentTime(iso: string): string {
  const date = new Date(iso)
  const now = new Date()
  const diffMs = now.getTime() - date.getTime()
  const diffMin = Math.floor(diffMs / 60000)
  const diffHours = Math.floor(diffMin / 60)
  const diffDays = Math.floor(diffHours / 24)

  if (diffMin < 1) return 'щойно'
  if (diffMin < 60) return `${diffMin} хв тому`
  if (diffHours < 24) return `${diffHours} год тому`
  if (diffDays < 7) return `${diffDays} дн тому`

  return date.toLocaleDateString('uk-UA', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  })
}