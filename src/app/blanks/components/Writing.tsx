export function Writing({ topic }: { topic: string }) {
  return (
    <section className="blanks-paper blanks-paper-sm" aria-busy="true" aria-live="polite">
      <p className="blanks-eyebrow">Writing</p>
      <h2 className="blanks-title">{topic ? topic : 'Something unexpected'}</h2>
      <div className="blanks-shimmer-lines" aria-hidden="true">
        <span className="blanks-shimmer" style={{ width: '92%' }} />
        <span className="blanks-shimmer" style={{ width: '78%' }} />
        <span className="blanks-shimmer" style={{ width: '85%' }} />
        <span className="blanks-shimmer" style={{ width: '40%' }} />
      </div>
      <p className="blanks-ink-soft text-sm">
        Writing the story. You will fill it in before you read it.
      </p>
    </section>
  )
}
