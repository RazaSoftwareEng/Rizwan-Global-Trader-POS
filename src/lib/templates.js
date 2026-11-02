// Invoice / quotation designs and accent colours (chosen on the Templates page,
// stored on the company so every user prints the same design).

export const TEMPLATES = [
  { id: 'classic', name: 'Classic', text: 'Clean header with a strong rule. Timeless and easy to read.' },
  { id: 'modern', name: 'Modern', text: 'Colour band header and a highlighted total.' },
  { id: 'minimal', name: 'Minimal', text: 'Plenty of white space and light lines.' },
  { id: 'corporate', name: 'Corporate', text: 'Boxed details, bordered table, amount in words, signatures.' },
  { id: 'executive', name: 'Executive', text: 'Full-height colour sidebar with company and client details.' },
  { id: 'elegant', name: 'Elegant', text: 'Centred letterhead, summary strip with amount due, signature.' },
]

export const ACCENTS = [
  { name: 'Blue', value: '#1c5cab' },
  { name: 'Navy', value: '#1e3a5f' },
  { name: 'Teal', value: '#0f766e' },
  { name: 'Green', value: '#15803d' },
  { name: 'Maroon', value: '#9f1239' },
  { name: 'Purple', value: '#5b21b6' },
  { name: 'Orange', value: '#c2410c' },
  { name: 'Charcoal', value: '#1f2937' },
]

export const DEFAULT_TEMPLATE = 'classic'
export const DEFAULT_ACCENT = ACCENTS[0].value

// ---------- Amount in words (Pakistani system: thousand, lakh, crore) ----------

const ONES = ['', 'One', 'Two', 'Three', 'Four', 'Five', 'Six', 'Seven', 'Eight', 'Nine', 'Ten', 'Eleven', 'Twelve',
  'Thirteen', 'Fourteen', 'Fifteen', 'Sixteen', 'Seventeen', 'Eighteen', 'Nineteen']
const TENS = ['', '', 'Twenty', 'Thirty', 'Forty', 'Fifty', 'Sixty', 'Seventy', 'Eighty', 'Ninety']

const twoDigits = (n) => (n < 20 ? ONES[n] : `${TENS[Math.floor(n / 10)]}${n % 10 ? ` ${ONES[n % 10]}` : ''}`)
const threeDigits = (n) =>
  [Math.floor(n / 100) ? `${ONES[Math.floor(n / 100)]} Hundred` : '', n % 100 ? twoDigits(n % 100) : ''].filter(Boolean).join(' ')

function intWords(n) {
  if (n === 0) return 'Zero'
  const parts = []
  const crore = Math.floor(n / 1e7)
  const lakh = Math.floor((n % 1e7) / 1e5)
  const thousand = Math.floor((n % 1e5) / 1e3)
  const rest = n % 1e3
  if (crore) parts.push(`${intWords(crore)} Crore`)
  if (lakh) parts.push(`${twoDigits(lakh)} Lakh`)
  if (thousand) parts.push(`${twoDigits(thousand)} Thousand`)
  if (rest) parts.push(threeDigits(rest))
  return parts.join(' ')
}

// 122300.5 -> "Rupees One Lakh Twenty Two Thousand Three Hundred and Fifty Paisa Only"
export function amountInWords(amount) {
  const total = Math.round((Number(amount) || 0) * 100)
  const rupees = Math.floor(total / 100)
  const paisa = total % 100
  return `Rupees ${intWords(rupees)}${paisa ? ` and ${twoDigits(paisa)} Paisa` : ''} Only`
}
