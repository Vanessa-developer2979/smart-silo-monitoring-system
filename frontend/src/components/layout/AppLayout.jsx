import { useState } from 'react'
import { NavLink, Outlet } from 'react-router-dom'
import { Activity, Bell, Boxes, ChartNoAxesCombined, CircleUserRound, LayoutDashboard, Leaf, MapPin, Menu, Settings, Sprout, Users, X } from 'lucide-react'
import { useAuth } from '../../hooks/useAuth.js'

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
  const { user, logout } = useAuth()
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
        <header className="topbar"><button className="icon-button menu-button" aria-label="Open menu" onClick={() => setOpen(true)}><Menu size={21} /></button><div className="top-actions"><button className="icon-button notification-button" aria-label="Notifications"><Bell size={19} /><b /></button><button type="button" className="icon-button profile-button" aria-label="Sign out" title={`Sign out ${user?.full_name || ''}`} onClick={logout}><CircleUserRound size={21} /></button></div></header>
        <div className="page-content"><Outlet /></div>
      </main>
    </div>
  )
}
