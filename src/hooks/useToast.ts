import { useState, useCallback } from 'react'

export function useToast() {
  const [message, setMessage] = useState('')
  const [error, setError] = useState('')

  const showToast = useCallback((msg: string, isError = false) => {
    if (isError) {
      setError(msg)
      setMessage('')
    } else {
      setMessage(msg)
      setError('')
    }
    setTimeout(() => {
      setMessage('')
      setError('')
    }, 3500)
  }, [])

  return { message, error, showToast }
}
