// Product fields, units, duplicate rules and CSV import helpers.

export const UNITS = [
  'pcs', 'box', 'carton', 'pack', 'dozen', 'set', 'pair',
  'kg', 'g', 'ton', 'litre', 'ml',
  'metre', 'ft', 'sq ft', 'roll',
  'bag', 'bottle', 'can', 'tin',
]

export const PRODUCT_FIELDS = [
  { key: 'name', label: 'Product name', required: true, autoFocus: true, full: true },
  { key: 'sku', label: 'SKU / Code', placeholder: 'e.g. RICE-5' },
  { key: 'unit', label: 'Unit', required: true, options: UNITS },
  { key: 'price', label: 'Price (Rs)', type: 'number', required: true },
  { key: 'stock', label: 'Stock', type: 'number', placeholder: '0' },
  { key: 'description', label: 'Description', textarea: true, full: true, placeholder: 'Size, brand, packing… (optional)' },
]

export const EMPTY_PRODUCT = { name: '', sku: '', unit: 'pcs', price: '', stock: '0', description: '' }

// Names and SKUs are compared ignoring case and surrounding spaces
export const normKey = (v) => String(v ?? '').trim().replace(/\s+/g, ' ').toLowerCase()

const toNumber = (v) => Number(String(v ?? '').replace(/,/g, '').trim())

// The row written to the database / demo store
export const productRow = (f) => ({
  name: String(f.name ?? '').trim().replace(/\s+/g, ' '),
  sku: String(f.sku ?? '').trim() || null,
  unit: f.unit || 'pcs',
  price: toNumber(f.price) || 0,
  stock: toNumber(f.stock) || 0,
  description: String(f.description ?? '').trim() || null,
})

// Returns an error message, or '' when the product is valid
export function validateProduct(f, existing = []) {
  const price = toNumber(f.price)
  const stock = String(f.stock ?? '').trim() === '' ? 0 : toNumber(f.stock)
  if (!Number.isFinite(price) || price < 0) return 'Price must be a number, 0 or more.'
  if (!Number.isFinite(stock) || stock < 0) return 'Stock must be a number, 0 or more.'

  const name = normKey(f.name)
  const sku = normKey(f.sku)
  const others = existing.filter((p) => p.id !== f.id)
  if (name && others.some((p) => normKey(p.name) === name)) return `A product named "${f.name.trim()}" already exists.`
  if (sku && others.some((p) => normKey(p.sku) === sku)) return `SKU "${f.sku.trim()}" is already used by another product.`
  return ''
}

// ---------- CSV ----------

export function parseCSV(text) {
  text = text.replace(/^﻿/, '')
  const rows = []
  let row = []
  let field = ''
  let quoted = false
  for (let i = 0; i < text.length; i++) {
    const c = text[i]
    if (quoted) {
      if (c === '"' && text[i + 1] === '"') {
        field += '"'
        i++
      } else if (c === '"') quoted = false
      else field += c
    } else if (c === '"') quoted = true
    else if (c === ',') {
      row.push(field)
      field = ''
    } else if (c === '\n' || c === '\r') {
      if (c === '\r' && text[i + 1] === '\n') i++
      row.push(field)
      rows.push(row)
      row = []
      field = ''
    } else field += c
  }
  if (field !== '' || row.length) {
    row.push(field)
    rows.push(row)
  }
  return rows.filter((r) => r.some((cell) => cell.trim() !== ''))
}

const HEADER_ALIASES = {
  name: ['name', 'product', 'product name', 'item', 'item name'],
  sku: ['sku', 'code', 'sku / code', 'sku/code', 'product code', 'item code'],
  unit: ['unit', 'uom'],
  price: ['price', 'rate', 'price (rs)', 'unit price', 'sale price'],
  stock: ['stock', 'qty', 'quantity', 'opening stock'],
  description: ['description', 'details', 'desc'],
}

const UNIT_ALIASES = { piece: 'pcs', pieces: 'pcs', pc: 'pcs', nos: 'pcs', liter: 'litre', liters: 'litre', l: 'litre', ltr: 'litre', kgs: 'kg', kilo: 'kg', gram: 'g', grams: 'g', meter: 'metre', meters: 'metre', m: 'metre', feet: 'ft', sqft: 'sq ft', doz: 'dozen' }

// "Litres", "KGS", "pieces" -> litre, kg, pcs
function matchUnit(raw) {
  const k = normKey(raw)
  return UNITS.find((u) => u === k) ?? UNIT_ALIASES[k] ?? UNITS.find((u) => `${u}s` === k || `${u}es` === k)
}

const TEMPLATE_ROWS = [
  ['name', 'sku', 'unit', 'price', 'stock', 'description'],
  ['Basmati Rice 5kg', 'RICE-5', 'bag', '2450', '100', 'Premium long grain'],
  ['Cooking Oil 5L', 'OIL-5', 'can', '2950', '40', ''],
]

const csvCell = (v) => (/[",\n]/.test(v) ? `"${v.replace(/"/g, '""')}"` : v)
export const TEMPLATE_CSV = TEMPLATE_ROWS.map((r) => r.map(csvCell).join(',')).join('\r\n')

// Turns CSV text into rows with per-row errors, checked against the catalog and the file itself
export function readImport(text, existing) {
  const [header, ...body] = parseCSV(text)
  if (!header) return { error: 'The file is empty.' }

  const cols = {}
  header.forEach((h, i) => {
    const k = normKey(h)
    for (const [field, aliases] of Object.entries(HEADER_ALIASES)) if (aliases.includes(k) && cols[field] === undefined) cols[field] = i
  })
  const missing = ['name', 'price'].filter((f) => cols[f] === undefined)
  if (missing.length) return { error: `Missing column${missing.length > 1 ? 's' : ''}: ${missing.join(', ')}. Download the template to see the format.` }

  const seenNames = new Set()
  const seenSkus = new Set()
  const rows = body.map((cells, i) => {
    const get = (f) => (cols[f] === undefined ? '' : String(cells[cols[f]] ?? '').trim())
    const unitRaw = get('unit')
    const unit = unitRaw ? matchUnit(unitRaw) : 'pcs'
    const form = { name: get('name'), sku: get('sku'), unit: unit ?? unitRaw, price: get('price'), stock: get('stock'), description: get('description') }

    const errors = []
    if (!form.name) errors.push('Name is missing')
    if (form.price === '') errors.push('Price is missing')
    if (!unit) errors.push(`Unknown unit "${unitRaw}"`)
    const problem = form.price !== '' && validateProduct(form, existing)
    if (problem) errors.push(problem)

    const n = normKey(form.name)
    const s = normKey(form.sku)
    if (n && seenNames.has(n)) errors.push('Same name appears earlier in the file')
    if (s && seenSkus.has(s)) errors.push('Same SKU appears earlier in the file')
    if (n) seenNames.add(n)
    if (s) seenSkus.add(s)

    return { line: i + 2, form, errors }
  })
  return { rows }
}
