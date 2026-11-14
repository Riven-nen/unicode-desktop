import type { CommentEntry } from '../../types/professor'

interface CommentMarginProps {
  comments: CommentEntry[]
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
  onReply,
  onJump
}: {
  comment: CommentEntry
  reply?: boolean
  onReply: (comment: CommentEntry) => void
  onJump: (comment: CommentEntry) => void
}): React.ReactElement {
  return (
    <article
      className={`comment-card ${reply ? 'comment-card-reply' : ''}`}
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
        <span className="comment-author">Professor</span>
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
  onReply,
  onJump
}: CommentMarginProps): React.ReactElement {
  const roots = comments.filter((comment) => comment.parentId === null)
  const repliesFor = (parentId: string): CommentEntry[] =>
    comments.filter((comment) => comment.parentId === parentId)

  return (
    <section className="comment-margin">
      <header className="panel-head">
        <h3>Comments</h3>
        <span className="panel-meta">{comments.length}</span>
      </header>

      {comments.length === 0 && (
        <div className="comment-empty">
          Click a line number in the editor to leave a comment on that line.
        </div>
      )}

      <div className="comment-list">
        {roots.map((root) => (
          <div className="comment-thread" key={root.id}>
            <CommentCard comment={root} onReply={onReply} onJump={onJump} />
            {repliesFor(root.id).map((reply) => (
              <CommentCard key={reply.id} comment={reply} reply onReply={onReply} onJump={onJump} />
            ))}
          </div>
        ))}
      </div>
    </section>
  )
}
