import { supabase } from './supabase'
import { customerRow } from './customerFields'
import { productRow } from './productFields'

function unwrap({ data, error }) {
  if (error) {
    if (error.code === '23505') {
      if (/sku/i.test(error.message)) throw new Error('This SKU is already used by another product.')
      if (/products_name/i.test(error.message)) throw new Error('A product with this name already exists.')
      throw new Error('This record already exists.')
    }
    if (error.code === '23503') throw new Error('This record is used in invoices or quotations, so it cannot be deleted.')
    throw new Error(error.message)
  }
  return data
}

// Invoices and quotations share one UI; this maps the differences.
export const DOC_TYPES = {
  invoice: {
    key: 'invoice',
    label: 'Invoice',
    plural: 'Invoices',
    table: 'invoices',
    items: 'invoice_items',
    no: 'invoice_no',
    date: 'invoice_date',
    path: '/invoices',
  },
  quotation: {
    key: 'quotation',
    label: 'Quotation',
    plural: 'Quotations',
    table: 'quotations',
    items: 'quotation_items',
    no: 'quotation_no',
    date: 'quotation_date',
    path: '/quotations',
  },
}

// ---------- Company ----------

// Default company first; falls back to the oldest one.
export async function getDefaultCompany() {
  return unwrap(
    await supabase
      .from('companies')
      .select('*')
      .order('is_default', { ascending: false })
      .order('created_at', { ascending: true })
      .limit(1)
      .maybeSingle(),
  )
}

export async function saveCompany({ id, name, address, phone, email, ntn, strn }) {
  const row = { name, address, phone, email, ntn, strn }
  if (id) return unwrap(await supabase.from('companies').update(row).eq('id', id).select().single())
  return unwrap(await supabase.from('companies').insert({ ...row, is_default: true }).select().single())
}

// ---------- Customers & products ----------

export async function listCustomers() {
  return unwrap(await supabase.from('customers').select('*').order('name'))
}

export async function saveCustomer(form) {
  const row = customerRow(form)
  const id = form.id
  if (id) return unwrap(await supabase.from('customers').update(row).eq('id', id).select().single())
  return unwrap(await supabase.from('customers').insert(row).select().single())
}

export async function deleteCustomer(id) {
  return unwrap(await supabase.from('customers').delete().eq('id', id))
}

export async function listProducts() {
  return unwrap(await supabase.from('products').select('*').order('name'))
}

export async function saveProduct(form) {
  const row = productRow(form)
  const id = form.id
  if (id) return unwrap(await supabase.from('products').update(row).eq('id', id).select().single())
  return unwrap(await supabase.from('products').insert(row).select().single())
}

// Inserts all rows in one statement: either every product is added or none
export async function importProducts(forms) {
  return unwrap(await supabase.from('products').insert(forms.map(productRow)).select())
}

export async function deleteProduct(id) {
  return unwrap(await supabase.from('products').delete().eq('id', id))
}

// ---------- Invoices & quotations ----------

export async function listDocuments(type) {
  const t = DOC_TYPES[type]
  const rows = unwrap(
    await supabase
      .from(t.table)
      .select(`id, ${t.no}, ${t.date}, total, status, created_by, customers(name), creator:profiles(name)`)
      .order('created_at', { ascending: false }),
  )
  return rows.map((r) => ({ ...r, no: r[t.no], date: r[t.date], created_by_name: r.creator?.name ?? null }))
}

export async function getDocument(type, id) {
  const t = DOC_TYPES[type]
  const doc = unwrap(
    await supabase
      .from(t.table)
      .select(`*, companies(*), customers(*), ${t.items}(*), creator:profiles(name)`)
      .eq('id', id)
      .order('sort_order', { referencedTable: t.items })
      .single(),
  )
  return { ...doc, no: doc[t.no], date: doc[t.date], items: doc[t.items], created_by_name: doc.creator?.name ?? null }
}

// Returns the new document id.
export async function createDocument(type, { companyId, customerId, items, date, validUntil, discount, taxPercent, notes }) {
  const common = {
    p_company_id: companyId,
    p_customer_id: customerId,
    p_items: items.map((i) => ({ product_id: i.product_id, qty: Number(i.qty), unit_price: Number(i.unit_price) })),
    p_discount: Number(discount) || 0,
    p_tax_percent: Number(taxPercent) || 0,
    p_notes: notes || null,
  }
  if (type === 'invoice') {
    return unwrap(await supabase.rpc('create_invoice', { ...common, p_invoice_date: date }))
  }
  return unwrap(
    await supabase.rpc('create_quotation', { ...common, p_quotation_date: date, p_valid_until: validUntil || null }),
  )
}

export async function setInvoiceStatus(id, status) {
  return unwrap(await supabase.from('invoices').update({ status }).eq('id', id))
}

// Returns the new invoice id.
export async function convertQuotation(id) {
  return unwrap(await supabase.rpc('convert_quotation_to_invoice', { p_quotation_id: id }))
}

// ---------- Dashboard ----------
// Aggregated in the browser - fine for testing volumes; move to SQL views when data grows.

export async function getDashboardData() {
  const [invoices, items, quotations, customers, products] = await Promise.all([
    supabase.from('invoices').select('id, invoice_no, invoice_date, total, status, customer_id, created_by, created_at, customers(name), creator:profiles(name)').order('created_at', { ascending: false }),
    supabase.from('invoice_items').select('product_name, qty, line_total'),
    supabase.from('quotations').select('id, total, status, created_by'),
    supabase.from('customers').select('id', { count: 'exact', head: true }),
    supabase.from('products').select('id', { count: 'exact', head: true }),
  ])
  unwrap(customers)
  unwrap(products)
  return {
    invoices: unwrap(invoices).map((r) => ({ ...r, created_by_name: r.creator?.name ?? null })),
    items: unwrap(items),
    quotations: unwrap(quotations),
    customerCount: customers.count ?? 0,
    productCount: products.count ?? 0,
  }
}

// ---------- Users (admin only) ----------
// Reading uses the profiles table; changes go through the `admin-users` Edge Function,
// because creating users and setting passwords needs the service role key (server only).

export async function getProfile(userId) {
  return unwrap(await supabase.from('profiles').select('name, role, active').eq('id', userId).maybeSingle())
}

export async function listUsers() {
  return unwrap(await supabase.from('profiles').select('*').order('created_at'))
}

async function adminUsers(body) {
  const { data, error } = await supabase.functions.invoke('admin-users', { body })
  if (error) {
    const detail = await error.context?.json?.().catch(() => null)
    throw new Error(detail?.error || error.message)
  }
  return data
}

export const createUser = (user) => adminUsers({ action: 'create', ...user })
export const updateUser = (id, changes) => adminUsers({ action: 'update', id, ...changes })
export const setUserPassword = (id, password) => adminUsers({ action: 'password', id, password })
export const deleteUser = (id) => adminUsers({ action: 'delete', id })
