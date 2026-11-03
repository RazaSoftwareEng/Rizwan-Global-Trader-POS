import { useEffect, useMemo, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { BarChart3, CalendarDays, FileText, Plus, ReceiptText, Search, Sparkles, UserPlus, Users, Wallet } from 'lucide-react'
import { getDashboardData, getDefaultCompany, listCustomers } from '../lib/api'
import ReportDownload from '../components/ReportDownload'
import { formatDate, initials, money, today } from '../lib/format'
import { inRange, usePeriodParams } from '../lib/periods'
import PeriodFilter from '../components/PeriodFilter'
import { EmptyState, ErrorBanner, Loading, PageHeader, StatusBadge } from '../components/ui'
import { useAuth } from '../auth/AuthProvider'

function greeting() {
  const h = new Date().getHours()
  return h < 12 ? 'Good morning' : h < 17 ? 'Good afternoon' : 'Good evening'
}

const firstName = (user) => (user?.name || user?.email?.split('@')[0] || '').split(' ')[0]

export default function Dashboard() {
  const { isAdmin } = useAuth()
  return isAdmin ? <AdminDashboard /> : <CashierDashboard />
}

// ---------- Admin: one card per customer company ----------

function AdminDashboard() {
  const { user } = useAuth()
  const navigate = useNavigate()
  const { period, range, setPeriod, setRange, query, valid } = usePeriodParams()
  const [data, setData] = useState(null)
  const [error, setError] = useState('')
  const [q, setQ] = useState('')

  useEffect(() => {
    Promise.all([getDashboardData(), listCustomers(), getDefaultCompany()])
      .then(([d, customers, company]) => setData({ invoices: d.invoices, quotations: d.quotations, customers, company }))
      .catch((e) => setError(e.message))
  }, [])

  // Invoices / quotations per customer within the period
  const cards = useMemo(() => {
    if (!data) return []
    const stats = new Map(data.customers.map((c) => [c.id, { customer: c, invoices: 0, quotations: 0, total: 0 }]))
    if (valid) {
      for (const inv of data.invoices) {
        const s = stats.get(inv.customer_id)
        if (s && inRange(inv.invoice_date, range)) {
          s.invoices += 1
          s.total += Number(inv.total)
        }
      }
      for (const qt of data.quotations) {
        const s = stats.get(qt.customer_id)
        if (s && inRange(qt.quotation_date, range)) s.quotations += 1
      }
    }
    return [...stats.values()].sort(
      (a, b) => b.invoices + b.quotations - (a.invoices + a.quotations) || b.total - a.total || a.customer.name.localeCompare(b.customer.name),
    )
  }, [data, range, valid])

  const needle = q.trim().toLowerCase()
  const shown = cards.filter((c) => !needle || [c.customer.name, c.customer.city, c.customer.contact_person].some((v) => v?.toLowerCase().includes(needle)))
  const sum = cards.reduce((s, c) => ({ invoices: s.invoices + c.invoices, quotations: s.quotations + c.quotations, total: s.total + c.total }), {
    invoices: 0,
    quotations: 0,
    total: 0,
  })
  const periodLabel = range.from === range.to ? formatDate(range.from) : `${formatDate(range.from)} – ${formatDate(range.to)}`

  return (
    <>
      <section className="hero">
        <svg className="hero-art" viewBox="0 0 800 220" preserveAspectRatio="xMaxYMid slice" aria-hidden="true">
          <circle cx="720" cy="-10" r="150" fill="rgba(200,150,62,0.16)" />
          <circle cx="780" cy="200" r="110" fill="rgba(255,255,255,0.05)" />
          <circle cx="520" cy="240" r="90" fill="rgba(255,255,255,0.04)" />
          <path d="M0 190 C 160 150, 320 230, 480 180 S 760 150, 800 170 L 800 220 L 0 220 Z" fill="rgba(255,255,255,0.04)" />
        </svg>
        <div className="hero-text">
          <span className="hero-eyebrow">
            <Sparkles size={13} /> {periodLabel}
          </span>
          <h1>
            {greeting()}, {firstName(user)}
          </h1>
          <p>Here’s how your customers are doing. Open a company to create an invoice.</p>
          <div className="hero-actions">
            <Link to="/invoices/new" className="btn btn-gold">
              <Plus size={16} /> New invoice
            </Link>
            <Link to="/quotations/new" className="btn btn-glass">
              <FileText size={16} /> New quotation
            </Link>
          </div>
        </div>
        <div className="hero-stats">
          <div className="hero-stat">
            <span className="hero-stat-icon">
              <ReceiptText size={16} />
            </span>
            <b>{data ? sum.invoices : '—'}</b>
            <span>Invoices</span>
          </div>
          <div className="hero-stat">
            <span className="hero-stat-icon">
              <FileText size={16} />
            </span>
            <b>{data ? sum.quotations : '—'}</b>
            <span>Quotations</span>
          </div>
          <div className="hero-stat">
            <span className="hero-stat-icon">
              <Wallet size={16} />
            </span>
            <b title={money(sum.total)}>{data ? money(sum.total) : '—'}</b>
            <span>Invoiced</span>
          </div>
        </div>
      </section>

      <PeriodFilter period={period} range={range} setPeriod={setPeriod} setRange={setRange}>
        <div className="input-icon filter-search">
          <Search size={16} />
          <input className="input" placeholder="Search company" value={q} onChange={(e) => setQ(e.target.value)} />
        </div>
        <ReportDownload data={data} company={data?.company} range={range} periodLabel={periodLabel} disabled={!valid} />
        <Link to={`/reports${query ? `?${query}` : ''}`} className="btn btn-primary">
          <BarChart3 size={16} /> View reports
        </Link>
      </PeriodFilter>

      <ErrorBanner message={!valid ? 'Choose a start date that is on or before the end date.' : error} />
      {!data && !error && <Loading />}

      {data && (
        <>
          {shown.length === 0 ? (
            <div className="card">
              <EmptyState
                icon={Users}
                title={cards.length ? 'No matching company' : 'No customers yet'}
                text={cards.length ? 'Try another name.' : 'Add customers to see them here.'}
              />
            </div>
          ) : (
            <div className="company-grid">
              {shown.map(({ customer: c, invoices, quotations, total }) => (
                <button
                  key={c.id}
                  className={`card company-card ${invoices + quotations ? '' : 'is-idle'}`}
                  onClick={() => navigate(`/customers/${c.id}${query ? `?${query}` : ''}`)}
                >
                  <div className="company-card-head">
                    <span className="avatar avatar-soft">{initials(c.name)}</span>
                    <span className="cell-stack">
                      <span className="company-card-name">{c.name}</span>
                      <span className="text-muted">{[c.contact_person, c.city].filter(Boolean).join(' · ') || '—'}</span>
                    </span>
                  </div>
                  <div className="company-card-stats">
                    <div>
                      <span className="stat-ico stat-ico-inv">
                        <ReceiptText size={15} />
                      </span>
                      <span className="cell-stack">
                        <span className="company-card-num">{invoices}</span>
                        <span className="company-card-label">Invoice{invoices === 1 ? '' : 's'}</span>
                      </span>
                    </div>
                    <div>
                      <span className="stat-ico stat-ico-qt">
                        <FileText size={15} />
                      </span>
                      <span className="cell-stack">
                        <span className="company-card-num">{quotations}</span>
                        <span className="company-card-label">Quotation{quotations === 1 ? '' : 's'}</span>
                      </span>
                    </div>
                  </div>
                  <div className="company-card-share">
                    <div className="share-text">
                      <span>Invoiced</span>
                      <b>{money(total)}</b>
                    </div>
                    <div className="share-track" title={`${sum.total ? Math.round((total / sum.total) * 100) : 0}% of sales in this period`}>
                      <span style={{ width: `${sum.total ? Math.max(2, (total / sum.total) * 100) : 0}%` }} />
                    </div>
                    <div className="share-text">
                      <span>Share of period sales</span>
                      <span>{sum.total ? Math.round((total / sum.total) * 100) : 0}%</span>
                    </div>
                  </div>
                </button>
              ))}
            </div>
          )}
        </>
      )}
    </>
  )
}

function Kpi({ icon: Icon, label, value, foot }) {
  return (
    <div className="card kpi">
      <div className="kpi-top">
        <span className="kpi-label">{label}</span>
        <span className="kpi-icon">
          <Icon size={17} strokeWidth={1.9} />
        </span>
      </div>
      <div className="kpi-value">{value}</div>
      <div className="kpi-foot">{foot}</div>
    </div>
  )
}

// ---------- Cashier: only their own numbers ----------

function CashierDashboard() {
  const { user } = useAuth()
  const navigate = useNavigate()
  const [data, setData] = useState(null)
  const [error, setError] = useState('')

  useEffect(() => {
    getDashboardData().then(setData).catch((e) => setError(e.message))
  }, [])

  const stats = useMemo(() => {
    if (!data) return null
    const day = today()
    const month = day.slice(0, 7)
    const mine = data.invoices.filter((i) => i.created_by === user.id)
    const sum = (rows) => rows.reduce((s, r) => s + Number(r.total), 0)
    const todayRows = mine.filter((i) => i.invoice_date === day)
    const monthRows = mine.filter((i) => i.invoice_date.startsWith(month))
    const myQuotes = data.quotations.filter((q) => q.created_by === user.id && q.status === 'open')
    return {
      today: sum(todayRows),
      todayCount: todayRows.length,
      month: sum(monthRows),
      monthCount: monthRows.length,
      quoteCount: myQuotes.length,
      quoteValue: sum(myQuotes),
      customerCount: data.customerCount,
      recent: mine.slice(0, 8),
    }
  }, [data, user.id])

  return (
    <>
      <PageHeader
        title={`${greeting()}, ${firstName(user)}`}
        subtitle="Your sales at a glance."
        actions={
          <>
            <Link to="/quotations/new" className="btn btn-secondary">
              <FileText size={16} /> New quotation
            </Link>
            <Link to="/invoices/new" className="btn btn-primary">
              <Plus size={16} /> New invoice
            </Link>
          </>
        }
      />

      <ErrorBanner message={error} />
      {!stats && !error && <Loading />}

      {stats && (
        <div className="dash">
          <div className="kpi-grid">
            <Kpi
              icon={ReceiptText}
              label="My sales today"
              value={money(stats.today)}
              foot={<span className="text-muted">{stats.todayCount} invoice{stats.todayCount === 1 ? '' : 's'} today</span>}
            />
            <Kpi
              icon={CalendarDays}
              label="My sales this month"
              value={money(stats.month)}
              foot={<span className="text-muted">{stats.monthCount} invoice{stats.monthCount === 1 ? '' : 's'}</span>}
            />
            <Kpi
              icon={FileText}
              label="My open quotations"
              value={stats.quoteCount}
              foot={<span className="text-muted">{money(stats.quoteValue)} in pipeline</span>}
            />
            <Kpi
              icon={Users}
              label="Customers"
              value={stats.customerCount}
              foot={<span className="text-muted">Companies on file</span>}
            />
          </div>

          <div className="dash-row">
            <div className="card card-flush">
              <div className="card-head">
                <div>
                  <h3>My recent invoices</h3>
                  <p className="text-secondary">Invoices you created</p>
                </div>
                <Link to="/invoices" className="btn btn-ghost btn-sm">
                  View all
                </Link>
              </div>
              {stats.recent.length === 0 ? (
                <EmptyState
                  icon={ReceiptText}
                  title="No invoices yet"
                  text="Invoices you create will appear here."
                  action={
                    <Link to="/invoices/new" className="btn btn-primary btn-sm">
                      <Plus size={15} /> Create invoice
                    </Link>
                  }
                />
              ) : (
                <table className="table">
                  <thead>
                    <tr>
                      <th>Invoice</th>
                      <th>Customer</th>
                      <th>Date</th>
                      <th>Status</th>
                      <th className="num">Amount</th>
                    </tr>
                  </thead>
                  <tbody>
                    {stats.recent.map((inv) => (
                      <tr key={inv.id} className="row-link" onClick={() => navigate(`/invoices/${inv.id}`)}>
                        <td className="strong">{inv.invoice_no}</td>
                        <td>{inv.customers?.name}</td>
                        <td className="text-secondary">{formatDate(inv.invoice_date)}</td>
                        <td>
                          <StatusBadge status={inv.status} />
                        </td>
                        <td className="num strong">{money(inv.total)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>

            <div className="card">
              <div className="card-head card-head-tight">
                <div>
                  <h3>Quick actions</h3>
                  <p className="text-secondary">Start something new</p>
                </div>
              </div>
              <div className="quick-actions">
                <QuickAction to="/invoices/new" icon={ReceiptText} title="New invoice" text="Bill a customer" />
                <QuickAction to="/quotations/new" icon={FileText} title="New quotation" text="Send a price offer" />
                <QuickAction to="/customers" icon={UserPlus} title="Add customer" text="Register a new company" />
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  )
}

function QuickAction({ to, icon: Icon, title, text }) {
  return (
    <Link to={to} className="quick-action">
      <span className="kpi-icon">
        <Icon size={17} strokeWidth={1.9} />
      </span>
      <span className="cell-stack">
        <span className="strong">{title}</span>
        <span className="text-muted">{text}</span>
      </span>
    </Link>
  )
}
