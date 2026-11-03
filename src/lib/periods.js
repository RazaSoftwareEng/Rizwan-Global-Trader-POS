// Date-period filter (This month / This year / Date range),
// kept in the URL so Back returns to the same view.
import { useSearchParams } from 'react-router-dom'
import { today } from './format'

const pad = (n) => String(n).padStart(2, '0')
const ymd = (d) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`

export const PERIODS = [
  { value: 'month', label: 'This month' },
  { value: 'year', label: 'This year' },
  { value: 'custom', label: 'Date range' },
]

export function rangeFor(period) {
  const now = new Date()
  switch (period) {
    case 'year':
      return { from: `${now.getFullYear()}-01-01`, to: today() }
    default: // month
      return { from: ymd(new Date(now.getFullYear(), now.getMonth(), 1)), to: today() }
  }
}

export function usePeriodParams() {
  const [params, setParams] = useSearchParams()
  const period = PERIODS.some((p) => p.value === params.get('period')) ? params.get('period') : 'month'
  const range =
    period === 'custom' ? { from: params.get('from') || today(), to: params.get('to') || today() } : rangeFor(period)

  const setPeriod = (p) =>
    setParams(p === 'custom' ? { period: p, from: range.from, to: range.to } : { period: p }, { replace: true })
  const setRange = (r) => setParams({ period: 'custom', from: r.from, to: r.to }, { replace: true })

  return { period, range, setPeriod, setRange, query: params.toString(), valid: range.from <= range.to }
}

export const inRange = (date, { from, to }) => date >= from && date <= to
