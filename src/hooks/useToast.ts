import { useCallback, useEffect, useRef, useState } from 'react'

const TOAST_DURATION_MS = 3500

export function useToast() {
  const [message, setMessage] = useState('')
  const [error, setError] = useState('')
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  const showToast = useCallback((msg: string, isError = false) => {
    if (timerRef.current) clearTimeout(timerRef.current)

    if (isError) {
      setError(msg)
      setMessage('')
    } else {
      setMessage(msg)
      setError('')
    }

    timerRef.current = setTimeout(() => {
      setMessage('')
      setError('')
      timerRef.current = null
    }, TOAST_DURATION_MS)
  }, [])

  useEffect(() => () => {
    if (timerRef.current) clearTimeout(timerRef.current)
  }, [])

  return { message, error, showToast }
}
