import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { ArrowRight, Eye, EyeOff, UserPlus } from 'lucide-react'
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
        {/*<---- <h1>{createAccount ? 'Create Account' : 'Welcome'}</h1>
        <p className="login-copy">{createAccount ? 'Create an operator account to access your silo dashboard.' : 'Log in to your Smart Silo'}</p> ---- >*/}

        {message && <div className="login-message" role="alert">{message}</div>}

        <div className="login-switch">
          <span>{createAccount ? 'Already have an account?' : 'New to the system?'}</span>
          <button type="button" onClick={() => { setMessage(''); setCreateAccount((value) => !value) }}>{createAccount ? 'Log In' : 'Create Account'}</button>
        </div>
      </section>
      <p className="login-caption">Storage insights for Malawi’s agricultural communities.</p>
    </main>
  )
}
