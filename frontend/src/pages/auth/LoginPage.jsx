import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { ArrowRight, Eye, EyeOff, UserPlus } from 'lucide-react'
import api from '../../services/api.js'
import { useAuth } from '../../hooks/useAuth.js'
import '../../auth.css'

function getErrorMessage(error, fallback) {
  const detail = error.response?.data?.detail
  if (typeof detail === 'string') return detail
  if (Array.isArray(detail)) {
    const messages = detail.map((item) => item.msg).filter((message) => typeof message === 'string')
    if (messages.length) return messages.join(' ')
  }
  return fallback
}

export function LoginPage() {
  const [createAccount, setCreateAccount] = useState(false)
  const [showLoginPassword, setShowLoginPassword] = useState(false)
  const [showAccountPassword, setShowAccountPassword] = useState(false)
  const [credentials, setCredentials] = useState({ email: '', password: '' })
  const [account, setAccount] = useState({ full_name: '', email: '', password: '' })
  const [message, setMessage] = useState('')
  const [busy, setBusy] = useState(false)
  const { setSession } = useAuth()
  const navigate = useNavigate()

  const authenticate = async (endpoint, payload, fallback) => {
    setBusy(true)
    setMessage('')
    try {
      const { data } = await api.post(endpoint, payload)
      setSession(data.access_token, data.user)
      navigate('/', { replace: true })
    } catch (error) {
      setMessage(getErrorMessage(error, fallback))
    } finally {
      setBusy(false)
    }
  }

  const submitLogin = (event) => {
    event.preventDefault()
    authenticate('/auth/login', credentials, 'Unable to log in. Check your details and try again.')
  }

  const submitRegistration = (event) => {
    event.preventDefault()
    authenticate('/auth/register', account, 'Unable to create your account. Check your details and try again.')
  }

  return (
    <main className="login-page">
      <div className="login-brand">
        <img className="login-logo" src="/smart-silo-mark.svg" alt="" />
        <span><strong>Smart Silo Monitoring System</strong><small>Safe Grain, Food Security</small></span>
      </div>
      <section className="login-showcase" aria-label="Smart grain storage monitoring">
        <div className="login-showcase-copy"><span>SMART GRAIN STORAGE</span><h2>Protect every harvest.</h2><p>Clear storage insights for safer grain and stronger food security.</p></div>
        <img className="login-illustration" src="/maize-silo-illustration.svg" alt="Illustration of maize cobs growing beside a grain silo" />
      </section>
      <section className="login-card">
        <span className="eyebrow">MALAWI GRAIN MONITORING</span>
        <h1>{createAccount ? 'Create Account' : 'Welcome'}</h1>
        <p className="login-copy">{createAccount ? 'Create an operator account to access your silo dashboard.' : 'Log in to your Smart Silo'}</p>

        {message && <div className="login-message" role="alert">{message}</div>}

        {createAccount ? (
          <form className="login-form" onSubmit={submitRegistration}>
            <label className="form-label" htmlFor="account-name">Full name</label>
            <input id="account-name" autoComplete="name" required maxLength="150" value={account.full_name} onChange={(event) => setAccount({ ...account, full_name: event.target.value })} placeholder="Enter your full name" />
            <label className="form-label" htmlFor="account-email">Email address</label>
            <input id="account-email" type="email" autoComplete="email" required value={account.email} onChange={(event) => setAccount({ ...account, email: event.target.value })} placeholder="operator@smartsilo.mw" />
            <label className="form-label" htmlFor="account-password">Password</label>
            <div className="password-input-wrap">
              <input id="account-password" type={showAccountPassword ? 'text' : 'password'} autoComplete="new-password" required minLength="8" maxLength="128" value={account.password} onChange={(event) => setAccount({ ...account, password: event.target.value })} placeholder="At least 8 characters" />
              <button className="password-visibility-toggle" type="button" aria-label={showAccountPassword ? 'Hide password' : 'Show password'} aria-controls="account-password" aria-pressed={showAccountPassword} onClick={() => setShowAccountPassword((visible) => !visible)}>{showAccountPassword ? <EyeOff size={18} /> : <Eye size={18} />}</button>
            </div>
            <button className="button button-primary login-button" disabled={busy}>{busy ? 'Creating account…' : 'Create Account'} <UserPlus size={17} /></button>
          </form>
        ) : (
          <form className="login-form" onSubmit={submitLogin}>
            <label className="form-label" htmlFor="login-email">Email address</label>
            <input id="login-email" type="email" autoComplete="username" required value={credentials.email} onChange={(event) => setCredentials({ ...credentials, email: event.target.value })} placeholder="operator@smartsilo.mw" />
            <label className="form-label" htmlFor="login-password">Password</label>
            <div className="password-input-wrap">
              <input id="login-password" type={showLoginPassword ? 'text' : 'password'} autoComplete="current-password" required value={credentials.password} onChange={(event) => setCredentials({ ...credentials, password: event.target.value })} placeholder="Enter your password" />
              <button className="password-visibility-toggle" type="button" aria-label={showLoginPassword ? 'Hide password' : 'Show password'} aria-controls="login-password" aria-pressed={showLoginPassword} onClick={() => setShowLoginPassword((visible) => !visible)}>{showLoginPassword ? <EyeOff size={18} /> : <Eye size={18} />}</button>
            </div>
            <button className="button button-primary login-button" disabled={busy}>{busy ? 'Signing in…' : 'Log In'} <ArrowRight size={17} /></button>
          </form>
        )}

        <div className="login-switch">
          <span>{createAccount ? 'Already have an account?' : 'New to the system?'}</span>
          <button type="button" onClick={() => { setMessage(''); setCreateAccount((value) => !value) }}>{createAccount ? 'Log In' : 'Create Account'}</button>
        </div>
      </section>
      <p className="login-caption">Storage insights for Malawi’s agricultural communities.</p>
    </main>
  )
}
