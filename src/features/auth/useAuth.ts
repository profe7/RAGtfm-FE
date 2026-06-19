import { useCallback, useSyncExternalStore } from 'react'
import { logout as logoutApi } from '../../api'
import { getToken, setToken as storeSetToken, subscribe } from './authStore'

export function useAuth() {
  const token = useSyncExternalStore(subscribe, getToken, getToken)

  const setToken = useCallback((next: string) => {
    storeSetToken(next)
  }, [])

  const logout = useCallback(() => {
    const current = getToken()
    storeSetToken('')
    if (current) {
      logoutApi(current).catch(() => {})
    }
  }, [])

  return { token, setToken, logout }
}
