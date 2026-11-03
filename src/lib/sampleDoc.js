// Example invoice / quotation used for template previews and thumbnails.
import { GST_PERCENT, addDays, today } from './format'

const round2 = (n) => Math.round(n * 100) / 100

export function sampleDoc(type, company = { name: 'Rizwan Global Trader' }, preparedBy = null) {
  const items = [
    ['Basmati Rice 5kg', 'bag', 20, 2450],
    ['Cooking Oil 5L', 'can', 10, 2950],
    ['Sugar 1kg', 'kg', 50, 155],
    ['Tea 950g', 'pack', 12, 1650],
  ].map(([product_name, unit, qty, unit_price], i) => ({ id: i, product_name, unit, qty, unit_price, line_total: qty * unit_price }))
  const subtotal = items.reduce((s, i) => s + i.line_total, 0)
  const discount = 1000
  const tax_amount = round2(((subtotal - discount) * GST_PERCENT) / 100)
  const month = today().slice(2, 4) + today().slice(5, 7)
  return {
    companies: company,
    customers: {
      name: 'Ahmed Traders',
      contact_person: 'Ahmed Raza',
      address: 'Shop 12, Anarkali Bazaar',
      city: 'Lahore',
      phone: '+92 301 1111111',
      ntn: '1234567-1',
    },
    items,
    no: type === 'invoice' ? `RGT-INV-${month}-0001` : `RGT-QT-${month}-0001`,
    date: today(),
    valid_until: type === 'quotation' ? addDays(15) : null,
    status: type === 'invoice' ? 'unpaid' : 'open',
    subtotal,
    discount,
    tax_percent: GST_PERCENT,
    tax_amount,
    total: round2(subtotal - discount + tax_amount),
    notes: 'Payment due within 15 days. Goods once sold will not be taken back.',
    created_by_name: preparedBy,
  }
}
