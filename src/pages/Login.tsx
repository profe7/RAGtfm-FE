import { Navigate } from 'react-router-dom'
import { useAuth } from '../features/auth/useAuth'
import { AuthScreen } from '../features/auth/AuthScreen'

export function Login() {
  const { token, setToken } = useAuth()

  if (token) {
    return <Navigate to="/" replace />
  }

  return <AuthScreen onAuth={setToken} />
}
