// All reports for a period: summary, monthly sales vs expenses, customers, unpaid, expenses, invoices.
import { useEffect, useMemo, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import { AlertTriangle, ArrowLeft, Banknote, CheckCircle2, Clock, Percent, ReceiptText, TrendingUp, Wallet } from 'lucide-react'
import { getDashboardData, getDefaultCompany, listCustomers, listExpenses } from '../lib/api'
import { compactMoney, formatDate, money, today } from '../lib/format'
import { inRange, usePeriodParams } from '../lib/periods'
import { ErrorBanner, Loading, StatusBadge } from '../components/ui'
import PeriodFilter from '../components/PeriodFilter'
import ReportDownload from '../components/ReportDownload'

// Validated categorical slots 1 and 2 (see dataviz palette)
const SALES = '#2a78d6'
const EXPENSES = '#eb6834'

const round2 = (n) => Math.round(n * 100) / 100
const sumBy = (rows, f) => round2(rows.reduce((s, r) => s + Number(r[f] ?? 0), 0))
const daysBetween = (a, b) => Math.round((new Date(`${b}T00:00`) - new Date(`${a}T00:00`)) / 86400000)

function monthsIn({ from, to }) {
  const out = []
  const d = new Date(`${from.slice(0, 7)}-01T00:00`)
  const end = to.slice(0, 7)
  while (true) {
    const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
    out.push({ key, label: d.toLocaleDateString('en-GB', { month: 'short', year: '2-digit' }), sales: 0, expenses: 0 })
    if (key >= end || out.length > 36) break
    d.setMonth(d.getMonth() + 1)
  }
  return out
}

export default function Reports() {
  const navigate = useNavigate()
  const { period, range, setPeriod, setRange, valid } = usePeriodParams()
  const [base, setBase] = useState(null)
  const [expenses, setExpenses] = useState(null)
  const [error, setError] = useState('')

  useEffect(() => {
    Promise.all([getDashboardData(), listCustomers(), getDefaultCompany()])
      .then(([d, customers, company]) => setBase({ invoices: d.invoices, quotations: d.quotations, customers, company }))
      .catch((e) => setError(e.message))
  }, [])

  useEffect(() => {
    if (!valid) return
    setExpenses(null)
    listExpenses(range)
      .then(setExpenses)
      .catch(() => setExpenses([]))
  }, [range.from, range.to, valid]) // eslint-disable-line react-hooks/exhaustive-deps

  const r = useMemo(() => {
    if (!base || !expenses || !valid) return null
    const inv = base.invoices.filter((i) => inRange(i.invoice_date, range)).sort((a, b) => b.invoice_date.localeCompare(a.invoice_date))
    const paid = inv.filter((i) => i.status === 'paid')
    const unpaid = inv.filter((i) => i.status !== 'paid').map((i) => ({ ...i, age: daysBetween(i.invoice_date, today()) })).sort((a, b) => b.age - a.age)
    const sales = sumBy(inv, 'total')
    const spent = sumBy(expenses, 'amount')

    const months = monthsIn(range)
    const byKey = Object.fromEntries(months.map((m) => [m.key, m]))
    inv.forEach((i) => byKey[i.invoice_date.slice(0, 7)] && (byKey[i.invoice_date.slice(0, 7)].sales += Number(i.total)))
    expenses.forEach((e) => byKey[e.expense_date.slice(0, 7)] && (byKey[e.expense_date.slice(0, 7)].expenses += Number(e.amount)))

    const byCustomer = base.customers
      .map((c) => {
        const ci = inv.filter((i) => i.customer_id === c.id)
        return {
          id: c.id,
          name: c.name,
          invoices: ci.length,
          paid: sumBy(ci.filter((i) => i.status === 'paid'), 'total'),
          unpaid: sumBy(ci.filter((i) => i.status !== 'paid'), 'total'),
          total: sumBy(ci, 'total'),
        }
      })
      .filter((c) => c.invoices)
      .sort((a, b) => b.total - a.total)

    const cats = {}
    expenses.forEach((e) => (cats[e.category] = (cats[e.category] ?? 0) + Number(e.amount)))
    const byCategory = Object.entries(cats)
      .map(([name, amount]) => ({ name, amount: round2(amount) }))
      .sort((a, b) => b.amount - a.amount)

    return {
      inv,
      unpaid,
      months,
      byCustomer,
      byCategory,
      k: {
        sales,
        count: inv.length,
        paid: sumBy(paid, 'total'),
        unpaid: sumBy(unpaid, 'total'),
        gst: sumBy(inv, 'tax_amount'),
        spent,
        net: round2(sales - spent),
        overdue: unpaid.filter((i) => i.age > 30).length,
      },
    }
  }, [base, expenses, range, valid])

  const periodLabel = range.from === range.to ? formatDate(range.from) : `${formatDate(range.from)} – ${formatDate(range.to)}`
  const catMax = r?.byCategory[0]?.amount || 1

  return (
    <>
      <div className="page-header">
        <div>
          <Link to="/" className="back-link">
            <ArrowLeft size={15} /> Dashboard
          </Link>
          <h1>Reports</h1>
          <p className="text-secondary">Sales, payments, customers and expenses for {periodLabel}.</p>
        </div>
      </div>

      <PeriodFilter period={period} range={range} setPeriod={setPeriod} setRange={setRange}>
        <span className="filter-spacer" />
        <ReportDownload data={base} company={base?.company} range={range} periodLabel={periodLabel} disabled={!valid} />
      </PeriodFilter>

      <ErrorBanner message={!valid ? 'Choose a start date that is on or before the end date.' : error} />
      {!r && !error && valid && <Loading />}

      {r && (
        <div className="reports">
          <div className="rk-grid">
            <Kpi icon={ReceiptText} tone="navy" label="Total sales" value={money(r.k.sales)} foot={`${r.k.count} invoice${r.k.count === 1 ? '' : 's'}`} />
            <Kpi icon={CheckCircle2} tone="good" label="Paid" value={money(r.k.paid)} foot={`${r.k.sales ? Math.round((r.k.paid / r.k.sales) * 100) : 0}% collected`} />
            <Kpi icon={Clock} tone="warn" label="Unpaid (outstanding)" value={money(r.k.unpaid)} foot={`${r.unpaid.length} invoice${r.unpaid.length === 1 ? '' : 's'} · ${r.k.overdue} over 30 days`} />
            <Kpi icon={Percent} tone="navy" label="GST collected" value={money(r.k.gst)} foot="18% on taxable sales" />
            <Kpi icon={Wallet} tone="gold" label="Expenses" value={money(r.k.spent)} foot={`${expenses.length} entr${expenses.length === 1 ? 'y' : 'ies'}`} />
            <Kpi icon={TrendingUp} tone={r.k.net >= 0 ? 'good' : 'bad'} label="Sales − expenses" value={money(r.k.net)} foot="Before cost of goods" />
          </div>

          <div className="card chart-card">
            <div className="card-head">
              <div>
                <h3>Sales vs expenses by month</h3>
                <p className="text-secondary">{periodLabel}</p>
              </div>
              <div className="legend">
                <span>
                  <i style={{ background: SALES }} /> Sales
                </span>
                <span>
                  <i style={{ background: EXPENSES }} /> Expenses
                </span>
              </div>
            </div>
            <div className="chart-box">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={r.months} margin={{ top: 8, right: 8, left: 0, bottom: 0 }} barGap={2}>
                  <CartesianGrid vertical={false} stroke="var(--grid)" />
                  <XAxis dataKey="label" tickLine={false} axisLine={{ stroke: 'var(--border)' }} tick={{ fill: 'var(--text-muted)', fontSize: 11 }} />
                  <YAxis tickFormatter={compactMoney} tickLine={false} axisLine={false} width={64} tick={{ fill: 'var(--text-muted)', fontSize: 11 }} />
                  <Tooltip
                    cursor={{ fill: 'rgba(31, 59, 110, 0.06)' }}
                    content={({ active, payload, label }) =>
                      active && payload?.length ? (
                        <div className="chart-tip">
                          <div className="chart-tip-title">{label}</div>
                          {payload.map((p) => (
                            <div key={p.dataKey} className="chart-tip-row">
                              <span className="swatch" style={{ background: p.color }} />
                              <span>{p.dataKey === 'sales' ? 'Sales' : 'Expenses'}</span>
                              <span className="strong" style={{ marginLeft: 'auto' }}>
                                {money(p.value)}
                              </span>
                            </div>
                          ))}
                        </div>
                      ) : null
                    }
                  />
                  <Bar dataKey="sales" fill={SALES} radius={[4, 4, 0, 0]} maxBarSize={22} />
                  <Bar dataKey="expenses" fill={EXPENSES} radius={[4, 4, 0, 0]} maxBarSize={22} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>

          <div className="rp-row">
            <div className="card card-flush">
              <div className="card-head">
                <div>
                  <h3>By customer</h3>
                  <p className="text-secondary">{r.byCustomer.length} customers billed</p>
                </div>
              </div>
              {r.byCustomer.length === 0 ? (
                <p className="text-muted recent-empty">No invoices in this period.</p>
              ) : (
                <table className="table">
                  <thead>
                    <tr>
                      <th>Customer</th>
                      <th className="num">Invoices</th>
                      <th className="num">Paid</th>
                      <th className="num">Unpaid</th>
                      <th className="num">Total</th>
                    </tr>
                  </thead>
                  <tbody>
                    {r.byCustomer.map((c) => (
                      <tr key={c.id} className="row-link" onClick={() => navigate(`/customers/${c.id}?period=${period}`)}>
                        <td className="strong">{c.name}</td>
                        <td className="num">{c.invoices}</td>
                        <td className="num">{money(c.paid)}</td>
                        <td className={`num ${c.unpaid ? 'text-warn' : 'text-muted'}`}>{money(c.unpaid)}</td>
                        <td className="num strong">{money(c.total)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>

            <div className="card">
              <div className="card-head card-head-tight">
                <div>
                  <h3>Expenses by category</h3>
                  <p className="text-secondary">{money(r.k.spent)} total</p>
                </div>
              </div>
              {r.byCategory.length === 0 ? (
                <p className="text-muted rank-empty">No expenses in this period.</p>
              ) : (
                <ul className="rank">
                  {r.byCategory.map((c) => (
                    <li key={c.name}>
                      <div className="rank-line">
                        <span className="rank-name">{c.name}</span>
                        <span className="rank-value">
                          {money(c.amount)} · {Math.round((c.amount / r.k.spent) * 100)}%
                        </span>
                      </div>
                      <div className="rank-track">
                        <div className="rank-fill" style={{ width: `${(c.amount / catMax) * 100}%`, background: EXPENSES }} />
                      </div>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </div>

          <div className="card card-flush">
            <div className="card-head">
              <div>
                <h3>
                  <AlertTriangle size={15} className="text-warn" /> Unpaid invoices
                </h3>
                <p className="text-secondary">
                  {r.unpaid.length} pending · {money(r.k.unpaid)} — oldest first
                </p>
              </div>
            </div>
            {r.unpaid.length === 0 ? (
              <p className="text-muted recent-empty">Everything in this period is paid. 🎉</p>
            ) : (
              <table className="table">
                <thead>
                  <tr>
                    <th>Invoice #</th>
                    <th>Customer</th>
                    <th>Date</th>
                    <th>Pending for</th>
                    <th className="num">Amount</th>
                  </tr>
                </thead>
                <tbody>
                  {r.unpaid.map((i) => (
                    <tr key={i.id} className="row-link" onClick={() => navigate(`/invoices/${i.id}`)}>
                      <td className="strong">{i.invoice_no}</td>
                      <td>{i.customers?.name}</td>
                      <td className="text-secondary">{formatDate(i.invoice_date)}</td>
                      <td>
                        <span className={`age ${i.age > 60 ? 'age-bad' : i.age > 30 ? 'age-warn' : ''}`}>
                          {i.age} day{i.age === 1 ? '' : 's'}
                        </span>
                      </td>
                      <td className="num strong">{money(i.total)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>

          <div className="card card-flush">
            <div className="card-head">
              <div>
                <h3>
                  <Banknote size={15} /> All invoices
                </h3>
                <p className="text-secondary">
                  {r.inv.length} · {money(r.k.sales)}
                </p>
              </div>
            </div>
            {r.inv.length === 0 ? (
              <p className="text-muted recent-empty">No invoices in this period.</p>
            ) : (
              <table className="table">
                <thead>
                  <tr>
                    <th>Invoice #</th>
                    <th>Date</th>
                    <th>Customer</th>
                    <th>Status</th>
                    <th className="num">Subtotal</th>
                    <th className="num">GST</th>
                    <th className="num">Total</th>
                  </tr>
                </thead>
                <tbody>
                  {r.inv.map((i) => (
                    <tr key={i.id} className="row-link" onClick={() => navigate(`/invoices/${i.id}`)}>
                      <td className="strong">{i.invoice_no}</td>
                      <td className="text-secondary">{formatDate(i.invoice_date)}</td>
                      <td>{i.customers?.name}</td>
                      <td>
                        <StatusBadge status={i.status} />
                      </td>
                      <td className="num">{money(i.subtotal)}</td>
                      <td className="num">{money(i.tax_amount)}</td>
                      <td className="num strong">{money(i.total)}</td>
                    </tr>
                  ))}
                </tbody>
                <tfoot>
                  <tr>
                    <td colSpan={6} className="strong">
                      Total
                    </td>
                    <td className="num strong">{money(r.k.sales)}</td>
                  </tr>
                </tfoot>
              </table>
            )}
          </div>
        </div>
      )}
    </>
  )
}

function Kpi({ icon: Icon, tone, label, value, foot }) {
  return (
    <div className="card rk">
      <span className={`rk-icon rk-${tone}`}>
        <Icon size={17} />
      </span>
      <span className="rk-label">{label}</span>
      <span className="rk-value" title={value}>
        {value}
      </span>
      <span className="rk-foot">{foot}</span>
    </div>
  )
}
