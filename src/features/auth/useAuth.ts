import { useState, useCallback } from 'react'

export function useAuth() {
  const [token, setTokenState] = useState(() => localStorage.getItem('ragtfm_token') ?? '')

  const setToken = useCallback((newToken: string) => {
    if (newToken) {
      localStorage.setItem('ragtfm_token', newToken)
    } else {
      localStorage.removeItem('ragtfm_token')
    }
    setTokenState(newToken)
  }, [])

  const logout = useCallback(() => {
    setToken('')
  }, [setToken])

  return { token, setToken, logout }
}
