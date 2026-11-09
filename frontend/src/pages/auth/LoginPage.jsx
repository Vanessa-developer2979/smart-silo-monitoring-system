import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { ArrowRight, Eye, EyeOff } from 'lucide-react'
import api from '../../services/api.js'
import { useAuth } from '../../hooks/useAuth.js'
import '../../auth.css'

function getErrorMessage(error, fallback) {
  if (!error.response) {
    return 'Could not reach the Smart Silo API. Check the backend service and VITE_API_URL.'
  }

  if (error.response.status >= 500) {
    return 'The Smart Silo API could not complete the request. Check the backend service logs and try again.'
  }

  const detail = error.response?.data?.detail

  if (typeof detail === 'string') return detail

  if (Array.isArray(detail)) {
    const messages = detail
      .map((item) => item.msg)
      .filter((message) => typeof message === 'string')

    if (messages.length) return messages.join(' ')
  }

  return fallback
}

export function LoginPage() {
  const [showPassword, setShowPassword] = useState(false)
  const [credentials, setCredentials] = useState({
    email: '',
    password: '',
  })
  const [message, setMessage] = useState('')
  const [busy, setBusy] = useState(false)

  const { setSession } = useAuth()
  const navigate = useNavigate()

  const submitLogin = async (event) => {
    event.preventDefault()
    setBusy(true)
    setMessage('')

    try {
      const { data } = await api.post('/auth/login', credentials)

      setSession(data.access_token, data.user)
      navigate('/', { replace: true })
    } catch (error) {
      setMessage(
        getErrorMessage(
          error,
          'Unable to log in. Check your details and try again.'
        )
      )
    } finally {
      setBusy(false)
    }
  }

  return (
    <main className="login-page">
      <div className="login-brand">
        <img
          className="login-logo"
          src="/smart-silo-mark.svg"
          alt=""
        />
        <span>
          <strong>Smart Silo Monitoring System</strong>
          <small>Safe Grain, Food Security</small>
        </span>
      </div>

      <section
        className="login-showcase"
        aria-label="Smart grain storage monitoring"
      >
        <div className="login-showcase-copy">
          <span>SMART GRAIN STORAGE</span>
          <h2>Protect every harvest.</h2>
          <p>
            Clear storage insights for safer grain and stronger food security.
          </p>
        </div>

        <img
          className="login-illustration"
          src="/maize-silo-illustration.svg"
          alt="Illustration of maize cobs growing beside a grain silo"
        />
      </section>

      <section className="login-card">
        <span className="eyebrow">MALAWI GRAIN MONITORING</span>

        <h1>Welcome</h1>
        <p className="login-copy">Log in to your Smart Silo</p>

        {message && (
          <div className="login-message" role="alert">
            {message}
          </div>
        )}

        <form className="login-form" onSubmit={submitLogin}>
          <label className="form-label" htmlFor="login-email">
            Email address
          </label>

          <input
            id="login-email"
            type="email"
            autoComplete="username"
            required
            value={credentials.email}
            onChange={(event) =>
              setCredentials({
                ...credentials,
                email: event.target.value,
              })
            }
            placeholder="operator@smartsilo.mw"
          />

          <label className="form-label" htmlFor="login-password">
            Password
          </label>

          <div className="password-input-wrap">
            <input
              id="login-password"
              type={showPassword ? 'text' : 'password'}
              autoComplete="current-password"
              required
              value={credentials.password}
              onChange={(event) =>
                setCredentials({
                  ...credentials,
                  password: event.target.value,
                })
              }
              placeholder="Enter your password"
            />

            <button
              className="password-visibility-toggle"
              type="button"
              aria-label={showPassword ? 'Hide password' : 'Show password'}
              aria-controls="login-password"
              aria-pressed={showPassword}
              onClick={() => setShowPassword((visible) => !visible)}
            >
              {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
            </button>
          </div>

          <button
            className="button button-primary login-button"
            disabled={busy}
          >
            {busy ? 'Signing in…' : 'Log In'}
            <ArrowRight size={17} />
          </button>
        </form>
      </section>

      <p className="login-caption">
        Storage insights for Malawi’s agricultural communities.
      </p>
    </main>
  )
}
