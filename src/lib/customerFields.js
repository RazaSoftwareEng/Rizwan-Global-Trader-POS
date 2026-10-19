// Customers are companies: these are the fields, and which ones are mandatory.
export const CUSTOMER_FIELDS = [
  { key: 'name', label: 'Company name', required: true, autoFocus: true, full: true },
  { key: 'contact_person', label: 'Contact person', required: true },
  { key: 'phone', label: 'Phone', required: true, type: 'tel', placeholder: '+92 3xx xxxxxxx' },
  { key: 'email', label: 'Email', type: 'email', placeholder: 'accounts@company.com' },
  { key: 'city', label: 'City', required: true },
  { key: 'ntn', label: 'NTN', placeholder: '1234567-8' },
  { key: 'strn', label: 'STRN', placeholder: 'Sales tax registration no.' },
  { key: 'address', label: 'Address', required: true, textarea: true, full: true },
]

const clean = (v) => (typeof v === 'string' ? v.trim() : v) || null

// The row written to the database / demo store
export const customerRow = (f) => Object.fromEntries(CUSTOMER_FIELDS.map(({ key }) => [key, clean(f[key])]))

export const EMPTY_CUSTOMER = Object.fromEntries(CUSTOMER_FIELDS.map(({ key }) => [key, '']))
