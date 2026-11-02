import { useEffect, useMemo, useState } from 'react'
import { CalendarDays, Download, Plus, Receipt, Search, Tag, Wallet } from 'lucide-react'
import { listExpenses } from '../lib/api'
import { EXPENSE_CATEGORIES } from '../lib/expenseFields'
import { addDays, formatDate, money, today } from '../lib/format'
import { useAuth } from '../auth/AuthProvider'
import { EmptyState, ErrorBanner, Loading, PageHeader } from '../components/ui'
import { ExpenseModal } from '../components/RecordModals'

const SERIES = '#2a78d6' // categorical slot 1, same as dashboard bars

const pad = (n) => String(n).padStart(2, '0')
const ymd = (d) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`

function rangeFor(preset) {
  const now = new Date()
  switch (preset) {
    case 'today':
      return { from: today(), to: today() }
    case 'week':
      return { from: addDays(-6), to: today() }
    case 'last-month':
      return {
        from: ymd(new Date(now.getFullYear(), now.getMonth() - 1, 1)),
        to: ymd(new Date(now.getFullYear(), now.getMonth(), 0)),
      }
    default: // month
      return { from: ymd(new Date(now.getFullYear(), now.getMonth(), 1)), to: today() }
  }
}

const PRESETS = [
  { value: 'today', label: 'Today' },
  { value: 'week', label: 'Last 7 days' },
  { value: 'month', label: 'This month' },
  { value: 'last-month', label: 'Last month' },
  { value: 'custom', label: 'Custom' },
]

const csvCell = (v) => {
  const s = String(v ?? '')
  return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s
}

function exportCsv(rows, from, to) {
  const header = ['Date', 'Category', 'Reason', 'Paid to', 'Paid by', 'Bill no.', 'Amount', 'Entered by']
  const lines = rows.map((e) => [e.expense_date, e.category, e.reason, e.paid_to, e.payment_method, e.reference, Number(e.amount), e.created_by_name])
  const csv = [header, ...lines].map((r) => r.map(csvCell).join(',')).join('\r\n')
  const url = URL.createObjectURL(new Blob(['﻿' + csv], { type: 'text/csv;charset=utf-8' }))
  const a = document.createElement('a')
  a.href = url
  a.download = `expenses_${from}_to_${to}.csv`
  a.click()
  URL.revokeObjectURL(url)
}

export default function Expenses() {
  const { isAdmin } = useAuth()
  const [preset, setPreset] = useState('month')
  const [range, setRange] = useState(rangeFor('month'))
  const [category, setCategory] = useState('all')
  const [q, setQ] = useState('')
  const [rows, setRows] = useState(null)
  const [error, setError] = useState('')
  const [editing, setEditing] = useState(null) // null | {} (new) | expense

  useEffect(() => {
    if (!range.from || !range.to || range.from > range.to) return
    let alive = true
    setRows(null)
    setError('')
    listExpenses(range)
      .then((r) => alive && setRows(r))
      .catch((e) => alive && setError(e.message))
    return () => {
      alive = false
    }
  }, [range])

  const choosePreset = (p) => {
    setPreset(p)
    if (p !== 'custom') setRange(rangeFor(p))
  }

  const filtered = useMemo(() => {
    const needle = q.trim().toLowerCase()
    return (rows ?? []).filter(
      (e) =>
        (category === 'all' || e.category === category) &&
        (!needle || [e.reason, e.paid_to, e.reference, e.category].some((v) => v?.toLowerCase().includes(needle))),
    )
  }, [rows, category, q])

  const stats = useMemo(() => {
    const total = filtered.reduce((s, e) => s + Number(e.amount), 0)
    const todayTotal = filtered.filter((e) => e.expense_date === today()).reduce((s, e) => s + Number(e.amount), 0)
    const byCat = {}
    for (const e of filtered) byCat[e.category] = (byCat[e.category] ?? 0) + Number(e.amount)
    const cats = Object.entries(byCat)
      .map(([name, amount]) => ({ name, amount }))
      .sort((a, b) => b.amount - a.amount)
    const days = new Set(filtered.map((e) => e.expense_date)).size
    return { total, todayTotal, cats, count: filtered.length, avgPerDay: days ? total / days : 0 }
  }, [filtered])

  // Group entries by day for the list, newest day first
  const groups = useMemo(() => {
    const map = new Map()
    for (const e of filtered) {
      if (!map.has(e.expense_date)) map.set(e.expense_date, { date: e.expense_date, total: 0, items: [] })
      const g = map.get(e.expense_date)
      g.items.push(e)
      g.total += Number(e.amount)
    }
    return [...map.values()]
  }, [filtered])

  const upsert = (e) => {
    setRows((prev) => {
      const inRange = e.expense_date >= range.from && e.expense_date <= range.to
      const rest = (prev ?? []).filter((r) => r.id !== e.id)
      const next = inRange ? [e, ...rest] : rest
      return next.sort((a, b) => b.expense_date.localeCompare(a.expense_date) || (b.created_at ?? '').localeCompare(a.created_at ?? ''))
    })
  }

  const badRange = range.from > range.to
  const max = stats.cats[0]?.amount || 1

  return (
    <>
      <PageHeader
        title="Expenses"
        subtitle={isAdmin ? 'Daily bills and spending, by reason.' : 'Record daily spending. You see the entries you added.'}
        actions={
          <>
            <button className="btn btn-secondary" onClick={() => exportCsv(filtered, range.from, range.to)} disabled={!filtered.length}>
              <Download size={16} /> Export
            </button>
            <button className="btn btn-primary" onClick={() => setEditing({})}>
              <Plus size={16} /> Add expense
            </button>
          </>
        }
      />

      <div className="card filter-bar">
        <div className="segmented">
          {PRESETS.map((p) => (
            <button key={p.value} className={preset === p.value ? 'active' : ''} onClick={() => choosePreset(p.value)}>
              {p.label}
            </button>
          ))}
        </div>
        {preset === 'custom' && (
          <div className="date-range">
            <input type="date" className="input" value={range.from} max={today()} onChange={(e) => setRange((r) => ({ ...r, from: e.target.value }))} />
            <span className="text-muted">to</span>
            <input type="date" className="input" value={range.to} max={today()} onChange={(e) => setRange((r) => ({ ...r, to: e.target.value }))} />
          </div>
        )}
        <select className="input filter-select" value={category} onChange={(e) => setCategory(e.target.value)}>
          <option value="all">All categories</option>
          {EXPENSE_CATEGORIES.map((c) => (
            <option key={c} value={c}>
              {c}
            </option>
          ))}
        </select>
        <div className="input-icon filter-search">
          <Search size={16} />
          <input className="input" placeholder="Search reason, paid to, bill no." value={q} onChange={(e) => setQ(e.target.value)} />
        </div>
      </div>

      <ErrorBanner message={badRange ? 'The start date must be before the end date.' : error} />

      {!rows && !error && !badRange && <Loading />}

      {rows && (
        <div className="dash">
          <div className="kpi-grid">
            <Kpi icon={Wallet} label="Total spent" value={money(stats.total)} foot={`${formatDate(range.from)} – ${formatDate(range.to)}`} />
            <Kpi icon={CalendarDays} label="Spent today" value={money(stats.todayTotal)} foot="Within current filters" />
            <Kpi icon={Receipt} label="Entries" value={stats.count} foot={`Avg ${money(stats.avgPerDay)} per day`} />
            <Kpi icon={Tag} label="Biggest category" value={stats.cats[0]?.name ?? '—'} foot={stats.cats[0] ? money(stats.cats[0].amount) : 'No spending'} small />
          </div>

          <div className="dash-row">
            <div className="card card-flush">
              <div className="card-head">
                <div>
                  <h3>Daily expenses</h3>
                  <p className="text-secondary">{groups.length} day{groups.length === 1 ? '' : 's'} with spending</p>
                </div>
              </div>

              {filtered.length === 0 ? (
                <EmptyState
                  icon={Wallet}
                  title={rows.length ? 'No matches' : 'No expenses in this period'}
                  text={rows.length ? 'Try another category or search.' : 'Add today’s bills and spending to start tracking.'}
                  action={
                    !rows.length && (
                      <button className="btn btn-primary btn-sm" onClick={() => setEditing({})}>
                        <Plus size={15} /> Add expense
                      </button>
                    )
                  }
                />
              ) : (
                <table className="table expense-table">
                  <thead>
                    <tr>
                      <th>Reason</th>
                      <th>Category</th>
                      <th>Paid to</th>
                      <th>Paid by</th>
                      {isAdmin && <th>Entered by</th>}
                      <th className="num">Amount</th>
                    </tr>
                  </thead>
                  {groups.map((g) => (
                    <tbody key={g.date}>
                      <tr className="day-row">
                        <td colSpan={isAdmin ? 5 : 4}>
                          <span className="strong">{formatDate(g.date)}</span>
                          {g.date === today() && <span className="tag">Today</span>}
                          <span className="text-muted"> · {g.items.length} entr{g.items.length === 1 ? 'y' : 'ies'}</span>
                        </td>
                        <td className="num strong">{money(g.total)}</td>
                      </tr>
                      {g.items.map((e) => (
                        <tr key={e.id} className={isAdmin ? 'row-link' : ''} onClick={isAdmin ? () => setEditing(e) : undefined}>
                          <td>
                            <div className="cell-stack">
                              <span className="strong">{e.reason}</span>
                              {e.reference && <span className="text-muted">Bill # {e.reference}</span>}
                            </div>
                          </td>
                          <td>
                            <span className="cat-pill">{e.category}</span>
                          </td>
                          <td className="text-secondary">{e.paid_to || '—'}</td>
                          <td className="text-secondary">{e.payment_method}</td>
                          {isAdmin && <td className="text-secondary">{e.created_by_name ?? '—'}</td>}
                          <td className="num strong">{money(e.amount)}</td>
                        </tr>
                      ))}
                    </tbody>
                  ))}
                  <tfoot>
                    <tr>
                      <td colSpan={isAdmin ? 5 : 4} className="strong">
                        Total
                      </td>
                      <td className="num strong">{money(stats.total)}</td>
                    </tr>
                  </tfoot>
                </table>
              )}
            </div>

            <div className="card">
              <div className="card-head card-head-tight">
                <div>
                  <h3>By category</h3>
                  <p className="text-secondary">Where the money went</p>
                </div>
              </div>
              {stats.cats.length === 0 ? (
                <p className="text-muted rank-empty">No spending in this period</p>
              ) : (
                <ul className="rank">
                  {stats.cats.map((c) => (
                    <li key={c.name}>
                      <div className="rank-line">
                        <span className="rank-name">{c.name}</span>
                        <span className="rank-value">
                          {money(c.amount)} · {Math.round((c.amount / stats.total) * 100)}%
                        </span>
                      </div>
                      <div className="rank-track">
                        <div className="rank-fill" style={{ width: `${(c.amount / max) * 100}%`, background: SERIES }} />
                      </div>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </div>
        </div>
      )}

      {editing && (
        <ExpenseModal
          expense={editing.id ? editing : null}
          canDelete={isAdmin}
          onClose={() => setEditing(null)}
          onSaved={(e) => {
            upsert(e)
            setEditing(null)
          }}
          onDeleted={(id) => {
            setRows((prev) => prev.filter((r) => r.id !== id))
            setEditing(null)
          }}
        />
      )}
    </>
  )
}

function Kpi({ icon: Icon, label, value, foot, small }) {
  return (
    <div className="card kpi">
      <div className="kpi-top">
        <span className="kpi-label">{label}</span>
        <span className="kpi-icon">
          <Icon size={17} strokeWidth={1.9} />
        </span>
      </div>
      <div className={`kpi-value ${small ? 'kpi-value-sm' : ''}`}>{value}</div>
      <div className="kpi-foot text-muted">{foot}</div>
    </div>
  )
}
