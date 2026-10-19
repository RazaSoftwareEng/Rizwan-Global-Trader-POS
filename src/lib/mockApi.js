// Demo mode: same functions as supabaseApi.js, backed by browser storage.
// Lets the whole flow be tested before the database exists.
// Role rules here mirror the database policies (admin vs cashier).

import { customerRow } from './customerFields'
import { productRow, validateProduct } from './productFields'
import { authStorage, safe } from './supabase'
import { DOC_PREFIX } from './format'

const DB_KEY = 'rgt-mock-db-v6'
const SESSION_KEY = 'rgt-mock-session'
const delay = (ms = 180) => new Promise((r) => setTimeout(r, ms))
const uid = () => (crypto.randomUUID ? crypto.randomUUID() : `${Date.now()}-${Math.random().toString(16).slice(2)}`)
const round2 = (n) => Math.round(n * 100) / 100
const pad = (n) => String(n).padStart(2, '0')
const isoDate = (d) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`
// RGT-INV-2610-0045: company code, type, document year+month, running serial
// (same format as the SQL functions)
const docNo = (type, date, serial) =>
  `${DOC_PREFIX}-${type === 'invoice' ? 'INV' : 'QT'}-${date.slice(2, 4)}${date.slice(5, 7)}-${String(serial).padStart(4, '0')}`
const daysAgo = (n) => {
  const d = new Date()
  d.setDate(d.getDate() - n)
  return d
}

export const DEMO_ACCOUNTS = [
  { role: 'admin', label: 'Admin', email: 'demo@rizwanglobal.com', password: 'Demo@12345' },
  { role: 'cashier', label: 'Cashier', email: 'cashier@rizwanglobal.com', password: 'Cashier@123' },
]

// Small seeded PRNG so the demo data looks the same on every fresh start
function rng(seed) {
  return () => {
    seed = (seed * 1664525 + 1013904223) % 4294967296
    return seed / 4294967296
  }
}

function seed() {
  const rand = rng(42)
  const pick = (arr) => arr[Math.floor(rand() * arr.length)]
  const now = new Date().toISOString()
  const yearAgo = daysAgo(365).toISOString()

  const users = [
    { id: uid(), name: 'Rizwan Ahmed', email: DEMO_ACCOUNTS[0].email, password: DEMO_ACCOUNTS[0].password, role: 'admin', active: true, created_at: yearAgo },
    { id: uid(), name: 'Ali Hassan', email: DEMO_ACCOUNTS[1].email, password: DEMO_ACCOUNTS[1].password, role: 'cashier', active: true, created_at: yearAgo },
    { id: uid(), name: 'Sara Khan', email: 'sara@rizwanglobal.com', password: 'Sara@1234', role: 'cashier', active: false, created_at: daysAgo(120).toISOString() },
  ]
  const [admin, cashier] = users

  const company = {
    id: uid(),
    name: 'Rizwan Global Trader',
    address: 'Shop #1, Main Market, Lahore',
    phone: '+92 300 0000000',
    email: 'info@rizwanglobal.example',
    ntn: '0000000-0',
    strn: '00-00-0000-000-00',
    is_default: true,
    created_at: now,
  }

  const customers = [
    ['Ahmed Traders', 'Ahmed Raza', '+92 301 1111111', 'accounts@ahmedtraders.pk', 'Shop 12, Anarkali Bazaar', 'Lahore', '1234567-1', '03-01-1111-001-11'],
    ['Bilal Enterprises', 'Bilal Khan', '+92 302 2222222', null, 'Plot 45, Saddar', 'Karachi', '2345678-2', null],
    ['City Mart', 'Usman Ali', '+92 303 3333333', 'info@citymart.pk', 'Office 3, Blue Area', 'Islamabad', '3456789-3', '03-02-2222-002-22'],
    ['Faisal Wholesale', 'Faisal Mehmood', '+92 304 4444444', 'faisal@example.com', '22-B Liberty Market', 'Lahore', null, null],
    ['Green Valley Store', 'Imran Shah', '+92 305 5555555', null, 'University Road', 'Peshawar', '4567890-4', null],
    ['Hamza & Sons', 'Hamza Tariq', '+92 306 6666666', 'hamza@example.com', 'Near Clock Tower', 'Faisalabad', '5678901-5', '03-03-3333-003-33'],
    ['Iqbal General Store', 'Muhammad Iqbal', '+92 307 7777777', null, 'Main Bazaar, Cantt', 'Rawalpindi', null, null],
    ['Kashif Distributors', 'Kashif Nawaz', '+92 308 8888888', 'kashif@example.com', 'Hussain Agahi Road', 'Multan', '6789012-6', '03-04-4444-004-44'],
  ].map(([name, contact_person, phone, email, address, city, ntn, strn]) => ({
    id: uid(), name, contact_person, phone, email, address, city, ntn, strn, created_at: now,
  }))

  const products = [
    ['Basmati Rice 5kg', 'RICE-5', 'bag', 2450],
    ['Cooking Oil 5L', 'OIL-5', 'can', 2950],
    ['Sugar 1kg', 'SUG-1', 'kg', 155],
    ['Tea 950g', 'TEA-950', 'pack', 1650],
    ['Flour 10kg', 'ATA-10', 'bag', 1350],
    ['Ghee 1kg', 'GHEE-1', 'tin', 620],
    ['Red Lentils 1kg', 'DAL-1', 'kg', 340],
    ['Chickpeas 1kg', 'CHANA-1', 'kg', 290],
    ['Milk Powder 900g', 'MILK-900', 'pack', 1850],
    ['Salt 800g', 'SALT-800', 'pack', 65],
  ].map(([name, sku, unit, price]) => ({ id: uid(), name, sku, unit, price, stock: 50 + Math.floor(rand() * 200), description: null, created_at: now }))

  const db = {
    users,
    companies: [company],
    customers,
    products,
    invoices: [],
    invoice_items: [],
    quotations: [],
    quotation_items: [],
    seq: { invoice: 0, quotation: 0 },
  }

  const makeItems = (count, qtyMin, qtyMax) =>
    [...products]
      .sort(() => rand() - 0.5)
      .slice(0, count)
      .map((p, i) => {
        const qty = qtyMin + Math.floor(rand() * (qtyMax - qtyMin + 1))
        return { id: uid(), product_id: p.id, product_name: p.name, unit: p.unit, qty, unit_price: p.price, line_total: round2(qty * p.price), sort_order: i + 1 }
      })

  // ~45 invoices, one every ~8 days for a year, plus 2 today by the cashier
  const plan = [...Array.from({ length: 45 }, (_, k) => 44 - k).map((i) => i * 8), 0, 0]
  plan.forEach((ago, idx) => {
    const d = daysAgo(ago === 0 ? 0 : ago + Math.floor(rand() * 4))
    d.setHours(9 + (idx % 8), 15, 0, 0)
    const old = ago > 45
    const status = (old ? rand() < 0.9 : rand() < 0.5) ? 'paid' : 'unpaid'
    const id = uid()
    const items = makeItems(1 + Math.floor(rand() * 4), 1, 25).map((it) => ({ ...it, invoice_id: id }))
    const subtotal = round2(items.reduce((s, it) => s + it.line_total, 0))
    const discount = idx % 5 === 0 ? Math.round(subtotal * 0.05) : 0
    const tax_amount = round2(((subtotal - discount) * 18) / 100)
    db.seq.invoice += 1
    db.invoices.push({
      id,
      invoice_no: docNo('invoice', isoDate(d), db.seq.invoice),
      company_id: company.id,
      customer_id: pick(customers).id,
      invoice_date: isoDate(d),
      subtotal,
      discount,
      tax_percent: 18,
      tax_amount,
      total: round2(subtotal - discount + tax_amount),
      notes: null,
      status,
      quotation_id: null,
      created_by: ago === 0 || rand() < 0.7 ? cashier.id : admin.id,
      created_at: d.toISOString(),
    })
    db.invoice_items.push(...items)
  })

  // 7 open quotations over the last 3 weeks
  for (let i = 6; i >= 0; i--) {
    const d = daysAgo(i * 3)
    const valid = new Date(d)
    valid.setDate(valid.getDate() + 15)
    const id = uid()
    const items = makeItems(2 + Math.floor(rand() * 3), 5, 45).map((it) => ({ ...it, quotation_id: id }))
    const subtotal = round2(items.reduce((s, it) => s + it.line_total, 0))
    const tax_amount = round2(subtotal * 0.18)
    db.seq.quotation += 1
    db.quotations.push({
      id,
      quotation_no: docNo('quotation', isoDate(d), db.seq.quotation),
      company_id: company.id,
      customer_id: pick(customers).id,
      quotation_date: isoDate(d),
      valid_until: isoDate(valid),
      subtotal,
      discount: 0,
      tax_percent: 18,
      tax_amount,
      total: round2(subtotal + tax_amount),
      notes: 'Prices valid for 15 days. Delivery within 3 working days.',
      status: 'open',
      invoice_id: null,
      created_by: rand() < 0.6 ? cashier.id : admin.id,
      created_at: d.toISOString(),
    })
    db.quotation_items.push(...items)
  }

  return db
}

let cache = null
function load() {
  if (cache) return cache
  const raw = safe(() => localStorage.getItem(DB_KEY), null)
  if (raw) cache = safe(() => JSON.parse(raw), null)
  if (!cache) {
    cache = seed()
    save()
  }
  return cache
}
function save() {
  safe(() => localStorage.setItem(DB_KEY, JSON.stringify(cache)))
}

export function resetDemoData() {
  cache = seed()
  save()
}

const clone = (x) => JSON.parse(JSON.stringify(x))
const byName = (a, b) => a.name.localeCompare(b.name)
const byCreatedDesc = (a, b) => b.created_at.localeCompare(a.created_at)

// ---------- Auth ----------

const listeners = new Set()
const publicUser = ({ password: _p, ...u }) => u

function sessionUser() {
  const s = safe(() => JSON.parse(authStorage.getItem(SESSION_KEY)), null)
  const u = s && load().users.find((x) => x.id === s.userId)
  return u && u.active ? u : null
}

function requireUser() {
  const u = sessionUser()
  if (!u) throw new Error('Your session has ended. Please sign in again.')
  return u
}

function requireAdmin() {
  const u = requireUser()
  if (u.role !== 'admin') throw new Error('Only an administrator can do this.')
  return u
}

export const mockAuth = {
  getUser: () => {
    const u = sessionUser()
    return u ? publicUser(u) : null
  },
  signIn(email, password) {
    const u = load().users.find((x) => x.email.toLowerCase() === email.toLowerCase())
    if (!u || u.password !== password) return { error: { message: 'Invalid login credentials' } }
    if (!u.active) return { error: { message: 'This account is deactivated. Contact your administrator.' } }
    authStorage.setItem(SESSION_KEY, JSON.stringify({ userId: u.id }))
    listeners.forEach((fn) => fn(publicUser(u)))
    return { error: null }
  },
  signOut() {
    authStorage.removeItem(SESSION_KEY)
    listeners.forEach((fn) => fn(null))
  },
  onChange(fn) {
    listeners.add(fn)
    return () => listeners.delete(fn)
  },
}

// ---------- Users (admin only) ----------

const validEmail = (e) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(e)

function checkPassword(pw) {
  if (!pw || pw.length < 8) throw new Error('Password must be at least 8 characters.')
}

function activeAdmins(db) {
  return db.users.filter((u) => u.role === 'admin' && u.active)
}

export async function listUsers() {
  await delay()
  requireAdmin()
  return clone(load().users.map(publicUser)).sort((a, b) => a.created_at.localeCompare(b.created_at))
}

export async function createUser({ name, email, password, role }) {
  await delay(300)
  requireAdmin()
  const db = load()
  email = (email ?? '').trim().toLowerCase()
  if (!name?.trim()) throw new Error('Name is required.')
  if (!validEmail(email)) throw new Error('Enter a valid email address.')
  if (db.users.some((u) => u.email === email)) throw new Error('A user with this email already exists.')
  checkPassword(password)
  const u = { id: uid(), name: name.trim(), email, password, role: role === 'admin' ? 'admin' : 'cashier', active: true, created_at: new Date().toISOString() }
  db.users.push(u)
  save()
  return clone(publicUser(u))
}

export async function updateUser(id, changes) {
  await delay()
  const me = requireAdmin()
  const db = load()
  const u = db.users.find((x) => x.id === id)
  if (!u) throw new Error('User not found.')

  const next = { ...u, ...changes }
  if (id === me.id && (next.role !== 'admin' || !next.active)) {
    throw new Error('You cannot remove your own admin access or deactivate yourself.')
  }
  if (u.role === 'admin' && u.active && (next.role !== 'admin' || !next.active) && activeAdmins(db).length <= 1) {
    throw new Error('At least one active administrator is required.')
  }
  if (changes.name !== undefined && !changes.name.trim()) throw new Error('Name is required.')

  if (changes.name !== undefined) u.name = changes.name.trim()
  if (changes.role !== undefined) u.role = changes.role === 'admin' ? 'admin' : 'cashier'
  if (changes.active !== undefined) u.active = Boolean(changes.active)
  save()
  return clone(publicUser(u))
}

export async function setUserPassword(id, password) {
  await delay()
  requireAdmin()
  checkPassword(password)
  const u = load().users.find((x) => x.id === id)
  if (!u) throw new Error('User not found.')
  u.password = password
  save()
}

export async function deleteUser(id) {
  await delay()
  const me = requireAdmin()
  const db = load()
  const u = db.users.find((x) => x.id === id)
  if (!u) throw new Error('User not found.')
  if (id === me.id) throw new Error('You cannot delete your own account.')
  if (u.role === 'admin' && u.active && activeAdmins(db).length <= 1) {
    throw new Error('At least one active administrator is required.')
  }
  db.users = db.users.filter((x) => x.id !== id)
  // Keep their invoices; just forget who made them (same as ON DELETE SET NULL)
  for (const t of ['invoices', 'quotations']) db[t].forEach((r) => r.created_by === id && (r.created_by = null))
  save()
}

// ---------- Company ----------

export const DOC_TYPES = {
  invoice: { key: 'invoice', label: 'Invoice', plural: 'Invoices', table: 'invoices', items: 'invoice_items', no: 'invoice_no', date: 'invoice_date', fk: 'invoice_id', path: '/invoices' },
  quotation: { key: 'quotation', label: 'Quotation', plural: 'Quotations', table: 'quotations', items: 'quotation_items', no: 'quotation_no', date: 'quotation_date', fk: 'quotation_id', path: '/quotations' },
}

export async function getDefaultCompany() {
  await delay()
  requireUser()
  const db = load()
  return clone([...db.companies].sort((a, b) => Number(b.is_default) - Number(a.is_default))[0] ?? null)
}

export async function saveCompany({ id, name, address, phone, email, ntn, strn }) {
  await delay()
  requireAdmin()
  const db = load()
  const row = { name, address, phone, email, ntn, strn }
  let rec = db.companies.find((c) => c.id === id)
  if (rec) Object.assign(rec, row)
  else {
    rec = { id: uid(), ...row, is_default: true, created_at: new Date().toISOString() }
    db.companies.push(rec)
  }
  save()
  return clone(rec)
}

// ---------- Customers & products ----------

function upsert(list, id, row) {
  let rec = list.find((r) => r.id === id)
  if (rec) Object.assign(rec, row)
  else {
    rec = { id: uid(), ...row, created_at: new Date().toISOString() }
    list.push(rec)
  }
  save()
  return clone(rec)
}

export async function listCustomers() {
  await delay()
  requireUser()
  return clone(load().customers).sort(byName)
}

// Cashiers may add customers; only admins may edit them
export async function saveCustomer(form) {
  await delay()
  if (form.id) requireAdmin()
  else requireUser()
  return upsert(load().customers, form.id, customerRow(form))
}

export async function deleteCustomer(id) {
  await delay()
  requireAdmin()
  const db = load()
  if (db.invoices.some((r) => r.customer_id === id) || db.quotations.some((r) => r.customer_id === id)) {
    throw new Error('This record is used in invoices or quotations, so it cannot be deleted.')
  }
  db.customers = db.customers.filter((c) => c.id !== id)
  save()
}

export async function listProducts() {
  await delay()
  requireUser()
  return clone(load().products).sort(byName)
}

export async function saveProduct(form) {
  await delay()
  requireAdmin()
  const db = load()
  const problem = validateProduct(form, db.products)
  if (problem) throw new Error(problem)
  return upsert(db.products, form.id, productRow(form))
}

export async function importProducts(forms) {
  await delay(400)
  requireAdmin()
  const db = load()
  const added = []
  for (const f of forms) {
    const problem = validateProduct(f, [...db.products, ...added])
    if (problem) throw new Error(`${f.name}: ${problem}`)
    added.push({ id: uid(), ...productRow(f), created_at: new Date().toISOString() })
  }
  db.products.push(...added)
  save()
  return clone(added)
}

export async function deleteProduct(id) {
  await delay()
  requireAdmin()
  const db = load()
  if (db.invoice_items.some((r) => r.product_id === id) || db.quotation_items.some((r) => r.product_id === id)) {
    throw new Error('This record is used in invoices or quotations, so it cannot be deleted.')
  }
  db.products = db.products.filter((p) => p.id !== id)
  save()
}

// ---------- Invoices & quotations ----------

function decorate(db, row) {
  const c = db.customers.find((x) => x.id === row.customer_id)
  const u = db.users.find((x) => x.id === row.created_by)
  return { ...row, customers: c ? { name: c.name } : null, created_by_name: u?.name ?? null }
}

export async function listDocuments(type) {
  await delay()
  requireUser()
  const t = DOC_TYPES[type]
  const db = load()
  return clone([...db[t.table]].sort(byCreatedDesc).map((r) => ({ ...decorate(db, r), no: r[t.no], date: r[t.date] })))
}

export async function getDocument(type, id) {
  await delay()
  requireUser()
  const t = DOC_TYPES[type]
  const db = load()
  const doc = db[t.table].find((r) => r.id === id)
  if (!doc) throw new Error(`${t.label} not found`)
  const items = db[t.items].filter((i) => i[t.fk] === id).sort((a, b) => a.sort_order - b.sort_order)
  return clone({
    ...decorate(db, doc),
    companies: db.companies.find((c) => c.id === doc.company_id),
    customers: db.customers.find((c) => c.id === doc.customer_id),
    items,
    no: doc[t.no],
    date: doc[t.date],
  })
}

// Same validation and math as the create_invoice / create_quotation SQL functions
export async function createDocument(type, { companyId, customerId, items, date, validUntil, discount, taxPercent, notes }) {
  await delay(350)
  const me = requireUser()
  const t = DOC_TYPES[type]
  const db = load()
  const disc = Number(discount) || 0
  const taxp = Number(taxPercent) || 0

  if (!items.length) throw new Error('Add at least one product')
  if (items.some((i) => !(Number(i.qty) > 0) || !(Number(i.unit_price) >= 0))) {
    throw new Error('Every item needs qty > 0 and a price of 0 or more')
  }
  const lines = items.map((i, idx) => {
    const p = db.products.find((x) => x.id === i.product_id)
    if (!p) throw new Error('One or more products were not found')
    const qty = Number(i.qty)
    const unit_price = Number(i.unit_price)
    return { id: uid(), product_id: p.id, product_name: p.name, unit: p.unit, qty, unit_price, line_total: round2(qty * unit_price), sort_order: idx + 1 }
  })
  const subtotal = round2(lines.reduce((s, l) => s + l.line_total, 0))
  if (disc < 0 || disc > subtotal) throw new Error('Discount must be between 0 and the subtotal')
  if (taxp < 0 || taxp > 100) throw new Error('Tax % must be between 0 and 100')
  const tax_amount = round2(((subtotal - disc) * taxp) / 100)

  const id = uid()
  db.seq[type] += 1
  db[t.table].push({
    id,
    [t.no]: docNo(type, date, db.seq[type]),
    company_id: companyId,
    customer_id: customerId,
    [t.date]: date,
    subtotal,
    discount: disc,
    tax_percent: taxp,
    tax_amount,
    total: round2(subtotal - disc + tax_amount),
    notes: notes || null,
    created_by: me.id,
    created_at: new Date().toISOString(),
    ...(type === 'invoice'
      ? { status: 'unpaid', quotation_id: null }
      : { status: 'open', valid_until: validUntil || null, invoice_id: null }),
  })
  db[t.items].push(...lines.map((l) => ({ ...l, [t.fk]: id })))
  save()
  return id
}

export async function setInvoiceStatus(id, status) {
  await delay()
  requireAdmin()
  const inv = load().invoices.find((r) => r.id === id)
  if (inv) inv.status = status
  save()
}

export async function convertQuotation(id) {
  await delay(350)
  const me = requireUser()
  const db = load()
  const q = db.quotations.find((r) => r.id === id)
  if (!q) throw new Error('Quotation not found')
  if (q.status === 'converted') throw new Error('This quotation is already converted to an invoice')

  const invId = uid()
  db.seq.invoice += 1
  db.invoices.push({
    id: invId,
    invoice_no: docNo('invoice', isoDate(new Date()), db.seq.invoice),
    company_id: q.company_id,
    customer_id: q.customer_id,
    invoice_date: isoDate(new Date()),
    subtotal: q.subtotal,
    discount: q.discount,
    tax_percent: q.tax_percent,
    tax_amount: q.tax_amount,
    total: q.total,
    notes: q.notes,
    status: 'unpaid',
    quotation_id: q.id,
    created_by: me.id,
    created_at: new Date().toISOString(),
  })
  db.invoice_items.push(
    ...db.quotation_items
      .filter((i) => i.quotation_id === q.id)
      .map(({ quotation_id: _q, ...i }) => ({ ...i, id: uid(), invoice_id: invId })),
  )
  q.status = 'converted'
  q.invoice_id = invId
  save()
  return invId
}

// ---------- Dashboard ----------

export async function getDashboardData() {
  await delay()
  requireUser()
  const db = load()
  return clone({
    invoices: [...db.invoices].sort(byCreatedDesc).map((r) => decorate(db, r)),
    items: db.invoice_items.map(({ product_name, qty, line_total }) => ({ product_name, qty, line_total })),
    quotations: db.quotations.map(({ id, total, status, created_by }) => ({ id, total, status, created_by })),
    customerCount: db.customers.length,
    productCount: db.products.length,
  })
}
