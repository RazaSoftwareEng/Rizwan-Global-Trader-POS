const moneyFmt = new Intl.NumberFormat('en-PK', {
  style: 'currency',
  currency: 'PKR',
  minimumFractionDigits: 2,
})

const compactFmt = new Intl.NumberFormat('en-PK', { notation: 'compact', maximumFractionDigits: 1 })

export const money = (n) => moneyFmt.format(Number(n) || 0)
export const compactMoney = (n) => `Rs ${compactFmt.format(Number(n) || 0)}`

// 'T00:00' makes a YYYY-MM-DD string parse as local time, not UTC
export const formatDate = (d) =>
  d ? new Date(`${d}T00:00`).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' }) : ''

const pad = (n) => String(n).padStart(2, '0')
const toISODate = (d) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`

// Local date as YYYY-MM-DD (toISOString would give the UTC date)
export const today = () => toISODate(new Date())

export const addDays = (days) => {
  const d = new Date()
  d.setDate(d.getDate() + days)
  return toISODate(d)
}

export const initials = (text = '') =>
  text
    .replace(/@.*/, '')
    .split(/[\s._-]+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((w) => w[0].toUpperCase())
    .join('') || '?'

// Company code at the start of every document number, e.g. RGT-INV-2610-0045
export const DOC_PREFIX = 'RGT'

export const ROLE_LABELS = { admin: 'Administrator', cashier: 'Cashier' }

// Fixed GST rate applied to every quotation and invoice
export const GST_PERCENT = 18

const round2 = (n) => Math.round(n * 100) / 100

// Preview only - the database recalculates these when saving.
export function computeTotals(items, discount, taxPercent) {
  const subtotal = round2(items.reduce((s, i) => s + round2((Number(i.qty) || 0) * (Number(i.unit_price) || 0)), 0))
  const disc = Number(discount) || 0
  const taxable = subtotal - disc
  const tax = round2((taxable * (Number(taxPercent) || 0)) / 100)
  return { subtotal, discount: disc, tax, total: round2(taxable + tax) }
}
