import { Fragment } from 'react'
import { MessageSquarePlus } from 'lucide-react'
import type { CommentEntry } from '../../types/professor'

interface CommentMarginProps {
  comments: CommentEntry[]
  onAddComment: () => void
  onReply: (comment: CommentEntry) => void
  onJump: (comment: CommentEntry) => void
}

const formatDate = (iso: string): string =>
  new Date(iso).toLocaleString([], {
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit'
  })

function CommentCard({
  comment,
  reply,
  depth = 0,
  onReply,
  onJump
}: {
  comment: CommentEntry
  reply?: boolean
  depth?: number
  onReply: (comment: CommentEntry) => void
  onJump: (comment: CommentEntry) => void
}): React.ReactElement {
  return (
    <article
      className={`comment-card ${reply ? 'comment-card-reply' : ''}`}
      style={reply ? { marginLeft: Math.min(depth, 3) * 14 } : undefined}
      tabIndex={0}
      role="button"
      onClick={() => onJump(comment)}
      onKeyDown={(event) => {
        if (event.key === 'Enter' || event.key === ' ') {
          event.preventDefault()
          onJump(comment)
        }
      }}
    >
      <header className="comment-card-head">
        <span className="comment-line">Line {comment.anchorLine ?? '—'}</span>
        <span
          className={`comment-author ${comment.authorRole === 'professor' ? 'is-professor' : 'is-student'}`}
        >
          {comment.authorRole === 'professor' ? 'Professor' : comment.authorName || 'Student'}
        </span>
        <span className="comment-time">{formatDate(comment.createdAt)}</span>
      </header>
      <p className="comment-body">{comment.body}</p>
      <button
        className="comment-reply"
        onClick={(event) => {
          event.stopPropagation()
          onReply(comment)
        }}
      >
        Reply
      </button>
    </article>
  )
}

export default function CommentMargin({
  comments,
  onAddComment,
  onReply,
  onJump
}: CommentMarginProps): React.ReactElement {
  const roots = comments.filter((comment) => comment.parentId === null)
  const childrenOf = (parentId: string): CommentEntry[] =>
    comments.filter((comment) => comment.parentId === parentId)

  const renderThread = (comment: CommentEntry, depth: number): React.ReactElement => (
    <Fragment key={comment.id}>
      <CommentCard
        comment={comment}
        reply={depth > 0}
        depth={depth}
        onReply={onReply}
        onJump={onJump}
      />
      {childrenOf(comment.id).map((child) => renderThread(child, depth + 1))}
    </Fragment>
  )

  return (
    <section className="comment-margin">
      <header className="panel-head">
        <h3>Comments</h3>
        <div className="comment-head-actions">
          <span className="panel-meta">{comments.length}</span>
          <button className="icon-text-btn" onClick={onAddComment}>
            <MessageSquarePlus size={12} /> Comment
          </button>
        </div>
      </header>

      {comments.length === 0 && (
        <div className="comment-empty">
          No comments yet. Click a line number in the editor, or use <strong>Comment</strong> above
          to anchor one to the current line.
        </div>
      )}

      <div className="comment-list">{roots.map((root) => renderThread(root, 0))}</div>
    </section>
  )
}
