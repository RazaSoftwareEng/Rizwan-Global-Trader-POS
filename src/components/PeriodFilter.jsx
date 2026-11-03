import { PERIODS } from '../lib/periods'
import { today } from '../lib/format'

// Period buttons + date inputs for "Date range"; extra controls (search) go in children.
export default function PeriodFilter({ period, range, setPeriod, setRange, children }) {
  return (
    <div className="card filter-bar">
      <div className="segmented">
        {PERIODS.map((p) => (
          <button key={p.value} className={period === p.value ? 'active' : ''} onClick={() => setPeriod(p.value)}>
            {p.label}
          </button>
        ))}
      </div>
      {period === 'custom' && (
        <div className="date-range">
          <input type="date" className="input" value={range.from} max={today()} onChange={(e) => setRange({ ...range, from: e.target.value })} />
          <span className="text-muted">to</span>
          <input type="date" className="input" value={range.to} max={today()} onChange={(e) => setRange({ ...range, to: e.target.value })} />
        </div>
      )}
      {children}
    </div>
  )
}
