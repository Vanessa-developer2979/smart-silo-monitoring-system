import { useEffect, useState } from 'react'
import { Link, NavLink, Outlet } from 'react-router-dom'
import { Activity, Bell, Boxes, ChartNoAxesCombined, CircleUserRound, LayoutDashboard, Leaf, MapPin, Menu, Settings, Sprout, Users, X } from 'lucide-react'
import { useAuth } from '../../hooks/useAuth.js'
import { alertService } from '../../services/api.js'

const navigation = [
  { label: 'Overview', path: '/', icon: LayoutDashboard },
  { label: 'Silo management', path: '/silos', icon: Boxes },
  { label: 'Live monitoring', path: '/monitoring', icon: Activity },
  { label: 'Alerts', path: '/alerts', icon: Bell },
  { label: 'Reports', path: '/reports', icon: ChartNoAxesCombined },
]
const adminNavigation = [
  { label: 'User management', path: '/users', icon: Users },
  { label: 'Settings', path: '/settings', icon: Settings },
]

export function AppLayout() {
  const [open, setOpen] = useState(false)
  const [logoutPromptOpen, setLogoutPromptOpen] = useState(false)
  const [notificationsOpen, setNotificationsOpen] = useState(false)
  const [notifications, setNotifications] = useState([])
  const [notificationError, setNotificationError] = useState('')
  const [notificationLoading, setNotificationLoading] = useState(true)
  const { user, logout } = useAuth()
  const userId = user?.id
  const activeNotifications = notifications.filter((item) => !item.acknowledged && !item.resolved)

  useEffect(() => {
    if (!userId) return undefined
    let active = true
    const refresh = async () => {
      try {
        const items = await alertService.list()
        if (active) {
          setNotifications(items)
          setNotificationError('')
        }
      } catch (error) {
        if (active) setNotificationError(error.response?.data?.detail || 'Could not load alerts. Check the service connection.')
      } finally {
        if (active) setNotificationLoading(false)
      }
    }
    refresh()
    const interval = window.setInterval(() => {
      if (document.visibilityState === 'visible') refresh()
    }, 20000)
    const refreshWhenVisible = () => {
      if (document.visibilityState === 'visible') refresh()
    }
    document.addEventListener('visibilitychange', refreshWhenVisible)
    return () => {
      active = false
      window.clearInterval(interval)
      document.removeEventListener('visibilitychange', refreshWhenVisible)
    }
  }, [userId])

  useEffect(() => {
    if (!logoutPromptOpen) return undefined
    const handleKeyDown = (event) => {
      if (event.key === 'Escape') setLogoutPromptOpen(false)
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [logoutPromptOpen])

  const links = (items) => items.map(({ label, path, icon: Icon, count }) => (
    <NavLink key={path} to={path} end={path === '/'} onClick={() => setOpen(false)} className={({ isActive }) => `nav-link${isActive ? ' active' : ''}`}>
      <Icon size={18} strokeWidth={1.8} /><span>{label}</span>{count && <span className="nav-count">{count}</span>}
    </NavLink>
  ))

  return (
    <div className="app-shell">
      {open && <button className="mobile-scrim" aria-label="Close navigation" onClick={() => setOpen(false)} />}
      <aside className={`sidebar${open ? ' sidebar-open' : ''}`}>
        <div className="brand"><div className="brand-icon"><Leaf size={21} /></div><div><strong>Smart Silo Monitoring System</strong><small>MALAWI GRAIN MONITORING</small></div><button className="icon-button sidebar-close" onClick={() => setOpen(false)} aria-label="Close menu"><X size={19} /></button></div>
        <div className="region-card"><span className="region-icon"><MapPin size={17} /></span><div><small>ACTIVE REGION</small><strong>Lilongwe District</strong><span>Central Region, Malawi</span></div></div>
        <div className="nav-section">MONITORING</div>
        <nav aria-label="Monitoring navigation">{links(navigation)}</nav>
        {user?.role === 'administrator' && <><div className="nav-section admin-section">ADMINISTRATION</div><nav aria-label="Administration navigation">{links(adminNavigation)}</nav></>}
        <div className="sidebar-footer"><span><Sprout size={17} /></span><div><strong>Grain storage operations</strong><small>Malawi monitoring workspace</small></div></div>
      </aside>
      <main className="main-area">
        <header className="topbar"><button className="icon-button menu-button" aria-label="Open menu" onClick={() => setOpen(true)}><Menu size={21} /></button><div className="top-actions">
          <div className="notification-area">
            <button type="button" className="icon-button notification-button" aria-label={`Notifications${activeNotifications.length ? `, ${activeNotifications.length} unread` : ''}`} aria-expanded={notificationsOpen} aria-controls="notification-popover" onClick={() => setNotificationsOpen((value) => !value)}><Bell size={19} />{activeNotifications.length > 0 && <span className="notification-count">{activeNotifications.length > 99 ? '99+' : activeNotifications.length}</span>}</button>
            {notificationsOpen && <section className="notification-popover" id="notification-popover" aria-label="Notifications">
              <div className="notification-heading"><div><h2>Notifications</h2><p>{activeNotifications.length} active alerts</p></div><button type="button" className="icon-button" aria-label="Close notifications" onClick={() => setNotificationsOpen(false)}><X size={17} /></button></div>
              {notificationError ? <p className="notification-empty" role="alert">{notificationError}</p> : notificationLoading ? <p className="notification-empty" role="status">Loading alerts…</p> : activeNotifications.length ? <div className="notification-list">{activeNotifications.slice(0, 8).map((item) => <Link className={`notification-item ${item.severity}`} key={item.id} to="/alerts" onClick={() => setNotificationsOpen(false)}><span className={`alert-symbol ${item.severity}`}>{item.severity === 'critical' ? '!' : item.severity === 'warning' ? '↑' : 'i'}</span><span><strong>{item.silo_name || `Silo ${item.silo_id}`}</strong><span>{item.message}</span><small>{new Date(item.created_at).toLocaleString('en-MW', { timeZone: 'Africa/Blantyre' })}</small></span></Link>)}</div> : <p className="notification-empty">No active alerts. New alerts will appear here automatically.</p>}
              <Link className="notification-all-link" to="/alerts" onClick={() => setNotificationsOpen(false)}>View all alerts</Link>
            </section>}
          </div>
          <button type="button" className="icon-button profile-button" aria-label="Account options" title={`Account options for ${user?.full_name || 'your account'}`} onClick={() => setLogoutPromptOpen(true)}><CircleUserRound size={21} /></button>
        </div></header>
        <div className="page-content"><Outlet /></div>
      </main>
      {logoutPromptOpen && <div className="dialog-backdrop"><section className="confirmation-dialog" role="dialog" aria-modal="true" aria-labelledby="logout-dialog-title" aria-describedby="logout-dialog-description"><h2 id="logout-dialog-title">Sign out?</h2><p id="logout-dialog-description">Are you sure you want to sign out of your account?</p><div className="dialog-actions"><button type="button" className="button button-secondary" autoFocus onClick={() => setLogoutPromptOpen(false)}>Stay signed in</button><button type="button" className="button button-primary" onClick={logout}>Sign out</button></div></section></div>}
    </div>
  )
}
