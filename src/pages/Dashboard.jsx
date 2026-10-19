import { useEffect, useMemo, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import { ArrowDownRight, ArrowUpRight, CalendarDays, FileText, Plus, ReceiptText, UserPlus, Users, Wallet } from 'lucide-react'
import { getDashboardData } from '../lib/api'
import { compactMoney, formatDate, money, today } from '../lib/format'
import { EmptyState, ErrorBanner, Loading, PageHeader, StatusBadge } from '../components/ui'
import { useAuth } from '../auth/AuthProvider'

const SERIES = '#2a78d6' // categorical slot 1 (validated reference palette)

const monthKey = (d) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`

function greeting() {
  const h = new Date().getHours()
  return h < 12 ? 'Good morning' : h < 17 ? 'Good afternoon' : 'Good evening'
}

function buildStats({ invoices, items, quotations, customerCount, productCount }) {
  const now = new Date()
  const thisMonth = monthKey(now)
  const lastMonth = monthKey(new Date(now.getFullYear(), now.getMonth() - 1, 1))

  // Last 12 months, oldest first
  const months = Array.from({ length: 12 }, (_, i) => {
    const d = new Date(now.getFullYear(), now.getMonth() - 11 + i, 1)
    return {
      key: monthKey(d),
      label: d.toLocaleDateString('en-GB', { month: 'short' }),
      full: d.toLocaleDateString('en-GB', { month: 'long', year: 'numeric' }),
      total: 0,
      count: 0,
    }
  })
  const byMonth = Object.fromEntries(months.map((m) => [m.key, m]))

  let mtd = 0
  let lastMtd = 0
  let outstanding = 0
  let unpaidCount = 0
  const customerTotals = {}
  const staffTotals = {}

  for (const inv of invoices) {
    const total = Number(inv.total)
    const key = inv.invoice_date.slice(0, 7)
    if (byMonth[key]) {
      byMonth[key].total += total
      byMonth[key].count += 1
    }
    if (key === thisMonth) mtd += total
    if (key === lastMonth) lastMtd += total
    if (inv.status === 'unpaid') {
      outstanding += total
      unpaidCount += 1
    }
    const name = inv.customers?.name ?? 'Unknown'
    customerTotals[name] = (customerTotals[name] ?? 0) + total
    const staff = inv.created_by_name ?? 'Former user'
    staffTotals[staff] = (staffTotals[staff] ?? 0) + total
  }

  const productTotals = {}
  for (const it of items) productTotals[it.product_name] = (productTotals[it.product_name] ?? 0) + Number(it.line_total)

  const top = (obj) =>
    Object.entries(obj)
      .map(([name, total]) => ({ name, total }))
      .sort((a, b) => b.total - a.total)
      .slice(0, 5)

  const openQuotes = quotations.filter((q) => q.status === 'open')

  return {
    mtd,
    change: lastMtd > 0 ? ((mtd - lastMtd) / lastMtd) * 100 : null,
    outstanding,
    unpaidCount,
    openQuoteCount: openQuotes.length,
    openQuoteValue: openQuotes.reduce((s, q) => s + Number(q.total), 0),
    customerCount,
    productCount,
    invoiceCount: invoices.length,
    months,
    yearTotal: months.reduce((s, m) => s + m.total, 0),
    topProducts: top(productTotals),
    topCustomers: top(customerTotals),
    staff: top(staffTotals),
    recent: invoices.slice(0, 6),
  }
}

export default function Dashboard() {
  const { isAdmin } = useAuth()
  return isAdmin ? <AdminDashboard /> : <CashierDashboard />
}

const firstName = (user) => (user?.name || user?.email?.split('@')[0] || '').split(' ')[0]

function AdminDashboard() {
  const { user } = useAuth()
  const navigate = useNavigate()
  const [data, setData] = useState(null)
  const [error, setError] = useState('')

  useEffect(() => {
    getDashboardData().then(setData).catch((e) => setError(e.message))
  }, [])

  const stats = useMemo(() => (data ? buildStats(data) : null), [data])
  const name = firstName(user)

  return (
    <>
      <PageHeader
        title={`${greeting()}${name ? `, ${name}` : ''}`}
        subtitle="Here's how your business is doing."
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
              label="Sales this month"
              value={money(stats.mtd)}
              foot={
                stats.change === null ? (
                  <span className="text-muted">No sales last month to compare</span>
                ) : (
                  <span className={`delta ${stats.change >= 0 ? 'up' : 'down'}`}>
                    {stats.change >= 0 ? <ArrowUpRight size={14} /> : <ArrowDownRight size={14} />}
                    {Math.abs(stats.change).toFixed(1)}% <span className="text-muted">vs last month</span>
                  </span>
                )
              }
            />
            <Kpi
              icon={Wallet}
              label="Outstanding"
              value={money(stats.outstanding)}
              foot={<span className="text-muted">{stats.unpaidCount} unpaid invoice{stats.unpaidCount === 1 ? '' : 's'}</span>}
            />
            <Kpi
              icon={FileText}
              label="Open quotations"
              value={stats.openQuoteCount}
              foot={<span className="text-muted">{money(stats.openQuoteValue)} in pipeline</span>}
            />
            <Kpi
              icon={Users}
              label="Customers"
              value={stats.customerCount}
              foot={<span className="text-muted">{stats.productCount} products in catalog</span>}
            />
          </div>

          <div className="dash-row">
            <SalesChart months={stats.months} yearTotal={stats.yearTotal} />
            <RankCard title="Top products" subtitle="By invoiced amount" rows={stats.topProducts} empty="No products sold yet" />
          </div>

          <div className="dash-row">
            <div className="card card-flush">
              <div className="card-head">
                <div>
                  <h3>Recent invoices</h3>
                  <p className="text-secondary">{stats.invoiceCount} total</p>
                </div>
                <Link to="/invoices" className="btn btn-ghost btn-sm">
                  View all
                </Link>
              </div>
              {stats.recent.length === 0 ? (
                <EmptyState
                  icon={ReceiptText}
                  title="No invoices yet"
                  text="Your latest invoices will appear here."
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
                      <th>By</th>
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
                        <td className="text-secondary">{inv.created_by_name ?? '—'}</td>
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
            <div className="dash-stack">
              <RankCard title="Top customers" subtitle="By invoiced amount" rows={stats.topCustomers} empty="No customers billed yet" />
              <RankCard title="Sales by staff" subtitle="Invoices created by each user" rows={stats.staff} empty="No sales yet" />
            </div>
          </div>
        </div>
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

function ChartTooltip({ active, payload }) {
  if (!active || !payload?.length) return null
  const m = payload[0].payload
  return (
    <div className="chart-tip">
      <div className="chart-tip-title">{m.full}</div>
      <div className="chart-tip-row">
        <span className="swatch" style={{ background: SERIES }} />
        <span className="strong">{money(m.total)}</span>
      </div>
      <div className="text-muted">
        {m.count} invoice{m.count === 1 ? '' : 's'}
      </div>
    </div>
  )
}

function SalesChart({ months, yearTotal }) {
  const [view, setView] = useState('chart')

  return (
    <div className="card chart-card">
      <div className="card-head">
        <div>
          <h3>Sales, last 12 months</h3>
          <p className="text-secondary">{money(yearTotal)} invoiced</p>
        </div>
        <div className="segmented" role="tablist">
          <button className={view === 'chart' ? 'active' : ''} onClick={() => setView('chart')}>
            Chart
          </button>
          <button className={view === 'table' ? 'active' : ''} onClick={() => setView('table')}>
            Table
          </button>
        </div>
      </div>

      {view === 'chart' ? (
        <div className="chart-box">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={months} margin={{ top: 8, right: 4, left: 0, bottom: 0 }}>
              <CartesianGrid vertical={false} stroke="var(--grid)" />
              <XAxis dataKey="label" tickLine={false} axisLine={{ stroke: 'var(--border)' }} tick={{ fill: 'var(--text-muted)', fontSize: 12 }} />
              <YAxis
                tickFormatter={compactMoney}
                tickLine={false}
                axisLine={false}
                width={64}
                tick={{ fill: 'var(--text-muted)', fontSize: 12 }}
              />
              <Tooltip content={<ChartTooltip />} cursor={{ fill: 'rgba(42, 120, 214, 0.07)' }} />
              <Bar dataKey="total" fill={SERIES} radius={[4, 4, 0, 0]} maxBarSize={24} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      ) : (
        <div className="chart-box chart-table">
          <table className="table table-compact">
            <thead>
              <tr>
                <th>Month</th>
                <th className="num">Invoices</th>
                <th className="num">Sales</th>
              </tr>
            </thead>
            <tbody>
              {[...months].reverse().map((m) => (
                <tr key={m.key}>
                  <td>{m.full}</td>
                  <td className="num">{m.count}</td>
                  <td className="num">{money(m.total)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}

function RankCard({ title, subtitle, rows, empty }) {
  const max = rows[0]?.total || 1
  return (
    <div className="card">
      <div className="card-head card-head-tight">
        <div>
          <h3>{title}</h3>
          <p className="text-secondary">{subtitle}</p>
        </div>
      </div>
      {rows.length === 0 ? (
        <p className="text-muted rank-empty">{empty}</p>
      ) : (
        <ul className="rank">
          {rows.map((r) => (
            <li key={r.name}>
              <div className="rank-line">
                <span className="rank-name" title={r.name}>
                  {r.name}
                </span>
                <span className="rank-value">{money(r.total)}</span>
              </div>
              <div className="rank-track">
                <div className="rank-fill" style={{ width: `${(r.total / max) * 100}%`, background: SERIES }} />
              </div>
            </li>
          ))}
        </ul>
      )}
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
