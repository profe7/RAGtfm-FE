import { useState } from 'react'
import { login, register } from '../../api'

interface AuthScreenProps {
  onAuth: (token: string) => void
}

export function AuthScreen({ onAuth }: AuthScreenProps) {
  const [mode, setMode] = useState<'login' | 'register'>('login')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [message, setMessage] = useState('')

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    setError('')
    try {
      if (mode === 'register') {
        await register(email, password)
        setMode('login')
        setMessage('Account created — sign in now.')
        return
      }
      const data = await login(email, password)
      onAuth(data.access_token)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Something went wrong')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="auth-root">
      <div className="auth-card">
        <div className="auth-brand">
          <div className="auth-logo">R</div>
          <p className="auth-tagline">Too lazy to read the manual?</p>
          <h1 className="auth-title">RAGtfm</h1>
        </div>

        <div className="auth-tabs">
          <button
            type="button"
            className={mode === 'login' ? 'auth-tab active' : 'auth-tab'}
            aria-pressed={mode === 'login'}
            onClick={() => setMode('login')}
          >Login</button>
          <button
            type="button"
            className={mode === 'register' ? 'auth-tab active' : 'auth-tab'}
            aria-pressed={mode === 'register'}
            onClick={() => setMode('register')}
          >Register</button>
        </div>

        {message && <p className="auth-message">{message}</p>}

        <form className="auth-form" onSubmit={handleSubmit}>
          <div className="field">
            <label htmlFor="email">Email</label>
            <input
              id="email"
              type="email"
              autoComplete="email"
              value={email}
              onChange={e => setEmail(e.target.value)}
              placeholder="you@example.com"
              required
            />
          </div>
          <div className="field">
            <label htmlFor="password">Password</label>
            <input
              id="password"
              type="password"
              autoComplete={mode === 'login' ? 'current-password' : 'new-password'}
              value={password}
              onChange={e => setPassword(e.target.value)}
              placeholder="••••••••"
              required
            />
          </div>

          {error && <p className="auth-error">{error}</p>}
          <button className="btn btn--primary btn--full" type="submit" disabled={loading}>
            {loading ? 'Working…' : mode === 'login' ? 'Sign in' : 'Create account'}
          </button>
        </form>
      </div>
    </div>
  )
}
