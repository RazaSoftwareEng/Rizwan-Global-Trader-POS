// Daily bills & expenses: categories, payment methods, form fields.
import { today } from './format'

export const EXPENSE_CATEGORIES = [
  'Purchasing',
  'Transport & Delivery',
  'Salaries & Wages',
  'Rent',
  'Utility Bills',
  'Fuel',
  'Repairs & Maintenance',
  'Office Supplies',
  'Food & Refreshments',
  'Bank Charges',
  'Taxes & Fees',
  'Other',
]

export const PAYMENT_METHODS = ['Cash', 'Bank Transfer', 'Cheque', 'JazzCash / Easypaisa', 'Card']

export const EXPENSE_FIELDS = [
  { key: 'expense_date', label: 'Date', type: 'date', required: true },
  { key: 'amount', label: 'Amount (Rs)', type: 'number', required: true, autoFocus: true },
  { key: 'category', label: 'Category', required: true, options: EXPENSE_CATEGORIES },
  { key: 'payment_method', label: 'Paid by', required: true, options: PAYMENT_METHODS },
  { key: 'reason', label: 'Reason / details', required: true, full: true, placeholder: 'e.g. Rickshaw fare for delivery to City Mart' },
  { key: 'paid_to', label: 'Paid to', placeholder: 'Person or company' },
  { key: 'reference', label: 'Bill / receipt no.', placeholder: 'Optional' },
]

export const emptyExpense = () => ({
  expense_date: today(),
  amount: '',
  category: EXPENSE_CATEGORIES[0],
  payment_method: PAYMENT_METHODS[0],
  reason: '',
  paid_to: '',
  reference: '',
})

export const expenseRow = (f) => ({
  expense_date: f.expense_date,
  amount: Number(String(f.amount ?? '').replace(/,/g, '')) || 0,
  category: f.category,
  payment_method: f.payment_method,
  reason: String(f.reason ?? '').trim(),
  paid_to: String(f.paid_to ?? '').trim() || null,
  reference: String(f.reference ?? '').trim() || null,
})

export function validateExpense(f) {
  const amount = Number(String(f.amount ?? '').replace(/,/g, ''))
  if (!Number.isFinite(amount) || amount <= 0) return 'Amount must be more than 0.'
  if (f.expense_date > today()) return 'Date cannot be in the future.'
  return ''
}
