export function Toast({ message, error }: { message: string; error: string }) {
  const visible = Boolean(message || error)
  return (
    <div
      className={`toast${error ? ' toast--error' : ''}${visible ? ' toast--visible' : ''}`}
      role="status"
      aria-live="polite"
    >
      {error || message}
    </div>
  )
}
