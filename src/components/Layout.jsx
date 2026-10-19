import { useEffect, useState } from 'react'
import { NavLink, Outlet, useLocation } from 'react-router-dom'
import {
  FileText,
  LayoutDashboard,
  LogOut,
  Menu,
  Package,
  ReceiptText,
  Settings as SettingsIcon,
  ShieldCheck,
  Users,
  X,
} from 'lucide-react'
import { useAuth } from '../auth/AuthProvider'
import { ROLE_LABELS, initials } from '../lib/format'

const NAV = [
  { section: 'Overview', links: [{ to: '/', label: 'Dashboard', icon: LayoutDashboard, end: true }] },
  {
    section: 'Sales',
    links: [
      { to: '/quotations', label: 'Quotations', icon: FileText },
      { to: '/invoices', label: 'Invoices', icon: ReceiptText },
    ],
  },
  {
    section: 'Manage',
    links: [
      { to: '/customers', label: 'Customers', icon: Users },
      { to: '/catalog', label: 'Catalog', icon: Package, adminOnly: true },
    ],
  },
  {
    section: 'Administration',
    links: [
      { to: '/users', label: 'Users', icon: ShieldCheck, adminOnly: true },
      { to: '/settings', label: 'Settings', icon: SettingsIcon, adminOnly: true },
    ],
  },
]

export default function Layout() {
  const { user, isAdmin, signOut } = useAuth()
  const nav = NAV.map((g) => ({ ...g, links: g.links.filter((l) => isAdmin || !l.adminOnly) })).filter((g) => g.links.length)
  const [open, setOpen] = useState(false)
  const location = useLocation()

  // Close the mobile drawer after navigating
  useEffect(() => setOpen(false), [location.pathname])

  return (
    <div className="shell">
      <aside className={`sidebar no-print ${open ? 'open' : ''}`}>
        <div className="sidebar-brand">
          <div className="logo-mark">RG</div>
          <div>
            <div className="brand-name">Rizwan Global</div>
            <div className="brand-sub">Trader</div>
          </div>
          <button className="icon-btn sidebar-close" onClick={() => setOpen(false)} aria-label="Close menu">
            <X size={18} />
          </button>
        </div>

        <nav className="sidebar-nav">
          {nav.map((group) => (
            <div key={group.section} className="nav-group">
              <div className="nav-section">{group.section}</div>
              {group.links.map(({ to, label, icon: Icon, end }) => (
                <NavLink key={to} to={to} end={end} className="nav-link">
                  <Icon size={18} strokeWidth={1.8} />
                  <span>{label}</span>
                </NavLink>
              ))}
            </div>
          ))}
        </nav>

        <div className="sidebar-user">
          <div className="avatar">{initials(user?.name || user?.email)}</div>
          <div className="user-meta">
            <div className="user-email" title={user?.email}>
              {user?.name || user?.email}
            </div>
            <div className="user-role">{ROLE_LABELS[user?.role] ?? user?.role}</div>
          </div>
          <button className="icon-btn" onClick={signOut} title="Sign out" aria-label="Sign out">
            <LogOut size={17} />
          </button>
        </div>
      </aside>

      {open && <div className="scrim no-print" onClick={() => setOpen(false)} />}

      <div className="main">
        <header className="topbar no-print">
          <button className="icon-btn menu-btn" onClick={() => setOpen(true)} aria-label="Open menu">
            <Menu size={20} />
          </button>
          <div className="topbar-date">
            {new Date().toLocaleDateString('en-GB', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}
          </div>
          <span className={`role-pill role-${user?.role}`}>{ROLE_LABELS[user?.role]}</span>
          <div className="avatar avatar-sm" title={user?.email}>{initials(user?.name || user?.email)}</div>
        </header>
        <main className="content">
          <Outlet />
        </main>
      </div>
    </div>
  )
}
