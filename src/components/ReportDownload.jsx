// "Download report" for the dashboard period: Excel (CSV) or a printable PDF.
import { useEffect, useMemo, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { ChevronDown, Download, FileSpreadsheet, Printer } from 'lucide-react'
import { formatDate, money } from '../lib/format'
import { inRange } from '../lib/periods'

const round2 = (n) => Math.round(n * 100) / 100

function buildReport({ invoices, quotations, customers }, range) {
  const inv = invoices.filter((i) => inRange(i.invoice_date, range)).sort((a, b) => a.invoice_date.localeCompare(b.invoice_date))
  const qts = quotations.filter((q) => inRange(q.quotation_date, range))
  const sum = (rows, f) => round2(rows.reduce((s, r) => s + Number(r[f] ?? 0), 0))
  const paid = inv.filter((i) => i.status === 'paid')
  const unpaid = inv.filter((i) => i.status !== 'paid')

  const byCustomer = customers
    .map((c) => {
      const ci = inv.filter((i) => i.customer_id === c.id)
      return {
        name: c.name,
        invoices: ci.length,
        quotations: qts.filter((q) => q.customer_id === c.id).length,
        paid: sum(ci.filter((i) => i.status === 'paid'), 'total'),
        unpaid: sum(ci.filter((i) => i.status !== 'paid'), 'total'),
        total: sum(ci, 'total'),
      }
    })
    .filter((r) => r.invoices || r.quotations)
    .sort((a, b) => b.total - a.total)

  return {
    invoices: inv,
    byCustomer,
    totals: {
      invoices: inv.length,
      total: sum(inv, 'total'),
      paid: sum(paid, 'total'),
      unpaid: sum(unpaid, 'total'),
      gst: sum(inv, 'tax_amount'),
      quotations: qts.length,
      quotationValue: sum(qts, 'total'),
    },
  }
}

const csvCell = (v) => {
  const s = String(v ?? '')
  return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s
}

function downloadCsv(report, { company, range, periodLabel }) {
  const t = report.totals
  const rows = [
    [`${company?.name ?? 'Sales'} — Sales report`],
    ['Period', periodLabel],
    ['Generated', new Date().toLocaleString('en-GB')],
    [],
    ['SUMMARY'],
    ['Invoices', t.invoices],
    ['Total invoiced (Rs)', t.total],
    ['Paid (Rs)', t.paid],
    ['Unpaid (Rs)', t.unpaid],
    ['GST (Rs)', t.gst],
    ['Quotations', t.quotations],
    ['Quotation value (Rs)', t.quotationValue],
    [],
    ['BY CUSTOMER'],
    ['Customer', 'Invoices', 'Quotations', 'Paid (Rs)', 'Unpaid (Rs)', 'Total (Rs)'],
    ...report.byCustomer.map((c) => [c.name, c.invoices, c.quotations, c.paid, c.unpaid, c.total]),
    [],
    ['INVOICES'],
    ['Invoice #', 'Date', 'Customer', 'Status', 'Subtotal (Rs)', 'Discount (Rs)', 'GST (Rs)', 'Total (Rs)'],
    ...report.invoices.map((i) => [
      i.invoice_no,
      i.invoice_date,
      i.customers?.name,
      i.status === 'paid' ? 'Paid' : 'Unpaid',
      Number(i.subtotal ?? 0),
      Number(i.discount ?? 0),
      Number(i.tax_amount ?? 0),
      Number(i.total),
    ]),
  ]
  const csv = rows.map((r) => r.map(csvCell).join(',')).join('\r\n')
  const url = URL.createObjectURL(new Blob(['﻿' + csv], { type: 'text/csv;charset=utf-8' }))
  const a = document.createElement('a')
  a.href = url
  a.download = `sales-report_${range.from}_to_${range.to}.csv`
  a.click()
  URL.revokeObjectURL(url)
}

function PrintableReport({ report, company, periodLabel }) {
  const t = report.totals
  return (
    <div className="report-print">
      <header className="rp-head">
        <div>
          <h1>{company?.name ?? 'Sales report'}</h1>
          <div className="rp-muted">{[company?.address, company?.phone, company?.ntn && `NTN: ${company.ntn}`].filter(Boolean).join(' · ')}</div>
        </div>
        <div className="rp-title">
          <div className="rp-kind">Sales report</div>
          <div>{periodLabel}</div>
          <div className="rp-muted">Generated {new Date().toLocaleString('en-GB')}</div>
        </div>
      </header>

      <section className="rp-stats">
        <div>
          <span>Invoices</span>
          <b>{t.invoices}</b>
        </div>
        <div>
          <span>Total invoiced</span>
          <b>{money(t.total)}</b>
        </div>
        <div>
          <span>Paid</span>
          <b>{money(t.paid)}</b>
        </div>
        <div>
          <span>Unpaid</span>
          <b>{money(t.unpaid)}</b>
        </div>
        <div>
          <span>GST</span>
          <b>{money(t.gst)}</b>
        </div>
        <div>
          <span>Quotations</span>
          <b>
            {t.quotations} · {money(t.quotationValue)}
          </b>
        </div>
      </section>

      <h2>By customer</h2>
      <table className="rp-table">
        <thead>
          <tr>
            <th>Customer</th>
            <th className="num">Invoices</th>
            <th className="num">Quotations</th>
            <th className="num">Paid</th>
            <th className="num">Unpaid</th>
            <th className="num">Total</th>
          </tr>
        </thead>
        <tbody>
          {report.byCustomer.length === 0 && (
            <tr>
              <td colSpan={6}>No activity in this period.</td>
            </tr>
          )}
          {report.byCustomer.map((c) => (
            <tr key={c.name}>
              <td>{c.name}</td>
              <td className="num">{c.invoices}</td>
              <td className="num">{c.quotations}</td>
              <td className="num">{money(c.paid)}</td>
              <td className="num">{money(c.unpaid)}</td>
              <td className="num">
                <b>{money(c.total)}</b>
              </td>
            </tr>
          ))}
        </tbody>
      </table>

      <h2>Invoices</h2>
      <table className="rp-table">
        <thead>
          <tr>
            <th>Invoice #</th>
            <th>Date</th>
            <th>Customer</th>
            <th>Status</th>
            <th className="num">Subtotal</th>
            <th className="num">Discount</th>
            <th className="num">GST</th>
            <th className="num">Total</th>
          </tr>
        </thead>
        <tbody>
          {report.invoices.length === 0 && (
            <tr>
              <td colSpan={8}>No invoices in this period.</td>
            </tr>
          )}
          {report.invoices.map((i) => (
            <tr key={i.id}>
              <td>{i.invoice_no}</td>
              <td>{formatDate(i.invoice_date)}</td>
              <td>{i.customers?.name}</td>
              <td>{i.status === 'paid' ? 'Paid' : 'Unpaid'}</td>
              <td className="num">{money(i.subtotal)}</td>
              <td className="num">{money(i.discount)}</td>
              <td className="num">{money(i.tax_amount)}</td>
              <td className="num">
                <b>{money(i.total)}</b>
              </td>
            </tr>
          ))}
        </tbody>
        {report.invoices.length > 0 && (
          <tfoot>
            <tr>
              <td colSpan={7}>Total</td>
              <td className="num">
                <b>{money(t.total)}</b>
              </td>
            </tr>
          </tfoot>
        )}
      </table>
    </div>
  )
}

export default function ReportDownload({ data, company, range, periodLabel, disabled }) {
  const [open, setOpen] = useState(false)
  const [printing, setPrinting] = useState(false)
  const boxRef = useRef(null)
  const report = useMemo(() => (data ? buildReport(data, range) : null), [data, range])

  // Close the menu on outside click
  useEffect(() => {
    if (!open) return
    const close = (e) => !boxRef.current?.contains(e.target) && setOpen(false)
    document.addEventListener('mousedown', close)
    return () => document.removeEventListener('mousedown', close)
  }, [open])

  // Print only the report (the app is hidden while printing)
  useEffect(() => {
    if (!printing) return
    document.body.classList.add('printing-report')
    const done = () => {
      document.body.classList.remove('printing-report')
      setPrinting(false)
    }
    window.addEventListener('afterprint', done, { once: true })
    const t = setTimeout(() => window.print(), 50)
    return () => {
      clearTimeout(t)
      window.removeEventListener('afterprint', done)
      document.body.classList.remove('printing-report')
    }
  }, [printing])

  return (
    <div className="report-dl" ref={boxRef}>
      <button className="btn btn-secondary" onClick={() => setOpen((o) => !o)} disabled={disabled || !report} aria-expanded={open}>
        <Download size={16} /> Download report <ChevronDown size={15} />
      </button>
      {open && (
        <div className="report-menu" role="menu">
          <div className="report-menu-head">{periodLabel}</div>
          <button
            role="menuitem"
            onClick={() => {
              downloadCsv(report, { company, range, periodLabel })
              setOpen(false)
            }}
          >
            <FileSpreadsheet size={16} />
            <span className="cell-stack">
              <span className="strong">Excel (CSV)</span>
              <span className="text-muted">Summary, customers and every invoice</span>
            </span>
          </button>
          <button
            role="menuitem"
            onClick={() => {
              setOpen(false)
              setPrinting(true)
            }}
          >
            <Printer size={16} />
            <span className="cell-stack">
              <span className="strong">PDF / Print</span>
              <span className="text-muted">Choose “Save as PDF” in the print window</span>
            </span>
          </button>
        </div>
      )}
      {printing && createPortal(<PrintableReport report={report} company={company} periodLabel={periodLabel} />, document.body)}
    </div>
  )
}
