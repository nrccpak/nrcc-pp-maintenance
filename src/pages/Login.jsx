import { useState } from 'react'
import { useAuth } from '../lib/AuthContext'

export default function Login() {
  const { signIn } = useAuth()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [submitting, setSubmitting] = useState(false)

  async function handleSubmit(e) {
    e.preventDefault()
    setError('')
    setSubmitting(true)
    const { error } = await signIn(email, password)
    setSubmitting(false)
    if (error) setError(error.message)
  }

  return (
    <div className="min-h-screen bg-panel-bg flex items-center justify-center px-4">
      <div className="w-full max-w-sm">
        <div className="text-center mb-8">
          <h1 className="font-mono text-xl text-ink-hi tracking-wide">NRCC POWER PLANT</h1>
          <p className="text-ink-mid text-sm mt-1">Operations Dashboard</p>
        </div>

        <form
          onSubmit={handleSubmit}
          className="bg-panel-surface border border-panel-line rounded-lg p-6 space-y-4"
        >
          <div>
            <label className="block text-xs font-mono text-ink-mid mb-1.5">EMAIL</label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              autoFocus
              className="w-full bg-panel-raised border border-panel-line2 rounded px-3 py-2 text-ink-hi text-sm focus:outline-none focus:border-st-run"
            />
          </div>

          <div>
            <label className="block text-xs font-mono text-ink-mid mb-1.5">PASSWORD</label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              className="w-full bg-panel-raised border border-panel-line2 rounded px-3 py-2 text-ink-hi text-sm focus:outline-none focus:border-st-run"
            />
          </div>

          {error && (
            <p className="text-st-over text-xs font-mono border border-st-over/30 bg-st-over/10 rounded px-3 py-2">
              {error}
            </p>
          )}

          <button
            type="submit"
            disabled={submitting}
            className="w-full bg-st-run/90 hover:bg-st-run text-white font-medium text-sm rounded py-2 transition-colors disabled:opacity-50"
          >
            {submitting ? 'Signing in…' : 'Sign in'}
          </button>
        </form>

        <p className="text-center text-ink-lo text-xs mt-6">Shared login — contact plant ops for access</p>
      </div>
    </div>
  )
}
