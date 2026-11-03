// Choose a customer's invoice template. Each template belongs to one customer only,
// so templates used by other customers are shown but can't be picked.
import { useMemo } from 'react'
import { Check, Lock } from 'lucide-react'
import { DEFAULT_ACCENT, TEMPLATES } from '../lib/templates'
import { sampleDoc } from '../lib/sampleDoc'
import DocumentPaper from './DocumentPaper'
import ScaledPaper from './ScaledPaper'

export default function TemplatePicker({ value, onChange, customers = [], selfId, accent = DEFAULT_ACCENT, invalid }) {
  const takenBy = useMemo(
    () => Object.fromEntries(customers.filter((c) => c.id !== selfId && c.doc_template).map((c) => [c.doc_template, c.name])),
    [customers, selfId],
  )
  const sample = useMemo(() => sampleDoc('invoice'), [])
  const used = Object.keys(takenBy).length
  const available = TEMPLATES.length - used
  const selected = TEMPLATES.find((t) => t.id === value)

  return (
    <div className={`tp ${invalid ? 'tp-invalid' : ''}`}>
      <div className="tp-summary">
        <span className={`status ${selected ? 'status-info' : 'status-neutral'}`}>
          <Check size={13} /> Selected: {selected ? selected.name : 'none'}
        </span>
        <span className="status status-neutral">
          <Lock size={13} /> {used} of {TEMPLATES.length} used
        </span>
        <span className={`status ${available ? 'status-good' : 'status-critical'}`}>{available} available</span>
      </div>

      {available === 0 && (
        <p className="tp-full">All {TEMPLATES.length} templates are assigned. An admin can free one by changing another customer’s template.</p>
      )}

      <div className="tp-grid">
        {TEMPLATES.map((t) => {
          const owner = takenBy[t.id]
          const isSelected = value === t.id
          return (
            <button
              key={t.id}
              type="button"
              className={`tp-card ${isSelected ? 'selected' : ''} ${owner ? 'taken' : ''}`}
              disabled={Boolean(owner)}
              onClick={() => onChange(t.id)}
              aria-pressed={isSelected}
              title={owner ? `Used by ${owner}` : t.text}
            >
              <ScaledPaper crop className="tp-thumb">
                <DocumentPaper type="invoice" doc={sample} template={t.id} accent={accent} fixed />
              </ScaledPaper>
              <span className="tp-name">{t.name}</span>
              <span className={`tp-state ${isSelected ? 'is-selected' : owner ? 'is-taken' : 'is-free'}`}>
                {isSelected ? 'Selected' : owner ? `Used by ${owner}` : 'Available'}
              </span>
            </button>
          )
        })}
      </div>
    </div>
  )
}
