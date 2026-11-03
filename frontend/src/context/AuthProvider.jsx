import { useEffect, useMemo, useState } from 'react'
import api from '../services/api.js'
import { AuthContext } from './AuthContext.js'

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null)
  const [loading, setLoading] = useState(() => Boolean(sessionStorage.getItem('accessToken')))

  useEffect(() => {
    const handleExpiredSession = () => setUser(null)
    window.addEventListener('auth:expired', handleExpiredSession)
    const token = sessionStorage.getItem('accessToken')
    if (!token) {
      return () => window.removeEventListener('auth:expired', handleExpiredSession)
    }
    api.get('/auth/me')
      .then(({ data }) => setUser(data))
      .catch(() => sessionStorage.removeItem('accessToken'))
      .finally(() => setLoading(false))
    return () => window.removeEventListener('auth:expired', handleExpiredSession)
  }, [])

  const value = useMemo(() => ({
    user,
    loading,
    setSession: (token, authenticatedUser) => {
      sessionStorage.setItem('accessToken', token)
      setUser(authenticatedUser)
    },
    logout: () => {
      sessionStorage.removeItem('accessToken')
      setUser(null)
    },
  }), [user, loading])

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}
