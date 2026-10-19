import { useEffect, useState } from 'react'
import { CheckCircle2, LogOut, RotateCcw } from 'lucide-react'
import { getDefaultCompany, saveCompany } from '../lib/api'
import { resetDemoData } from '../lib/mockApi'
import { USE_MOCK } from '../lib/supabase'
import { initials } from '../lib/format'
import { useAuth } from '../auth/AuthProvider'
import { ErrorBanner, Field, Loading, PageHeader } from '../components/ui'

const EMPTY = { name: '', address: '', phone: '', email: '', ntn: '', strn: '' }

export default function Settings() {
  const { user, signOut } = useAuth()
  const [form, setForm] = useState(null)
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)
  const [saved, setSaved] = useState(false)

  useEffect(() => {
    getDefaultCompany()
      .then((c) => setForm(c ?? EMPTY))
      .catch((e) => setError(e.message))
  }, [])

  const set = (k) => (e) => {
    setSaved(false)
    setForm((f) => ({ ...f, [k]: e.target.value }))
  }

  async function handleSave(e) {
    e.preventDefault()
    setBusy(true)
    setError('')
    try {
      setForm(await saveCompany(form))
      setSaved(true)
    } catch (err) {
      setError(err.message)
    }
    setBusy(false)
  }

  return (
    <>
      <PageHeader title="Settings" subtitle="Company profile and account." />
      <ErrorBanner message={error} />

      <div className="settings">
        <form className="card" onSubmit={handleSave}>
          <div className="card-head card-head-tight">
            <div>
              <h3>Company profile</h3>
              <p className="text-secondary">Shown on every quotation and invoice. Selected automatically.</p>
            </div>
          </div>

          {!form ? (
            <Loading />
          ) : (
            <>
              <div className="form-grid">
                <div className="span-2">
                  <Field label="Company name">
                    <input className="input" required value={form.name ?? ''} onChange={set('name')} />
                  </Field>
                </div>
                <Field label="Phone">
                  <input className="input" value={form.phone ?? ''} onChange={set('phone')} />
                </Field>
                <Field label="Email">
                  <input className="input" type="email" value={form.email ?? ''} onChange={set('email')} />
                </Field>
                <Field label="NTN / Tax number">
                  <input className="input" value={form.ntn ?? ''} onChange={set('ntn')} />
                </Field>
                <Field label="STRN / Sales tax reg. no.">
                  <input className="input" value={form.strn ?? ''} onChange={set('strn')} />
                </Field>
                <div className="span-2">
                  <Field label="Address">
                    <textarea className="input" rows={3} value={form.address ?? ''} onChange={set('address')} />
                  </Field>
                </div>
              </div>
              <div className="card-actions">
                {saved && (
                  <span className="saved-note">
                    <CheckCircle2 size={15} /> Saved
                  </span>
                )}
                <button className="btn btn-primary" disabled={busy || !form.name?.trim()}>
                  {busy ? 'Saving…' : 'Save changes'}
                </button>
              </div>
            </>
          )}
        </form>

        <div className="card">
          <div className="card-head card-head-tight">
            <div>
              <h3>Account</h3>
              <p className="text-secondary">You are signed in as</p>
            </div>
          </div>
          <div className="party">
            <div className="avatar">{initials(user?.email)}</div>
            <div>
              <div className="strong">{user?.email}</div>
              <div className="text-muted">Administrator</div>
            </div>
          </div>
          <div className="card-actions">
            <button className="btn btn-secondary" onClick={signOut}>
              <LogOut size={16} /> Sign out
            </button>
          </div>
        </div>

        {USE_MOCK && (
          <div className="card">
            <div className="card-head card-head-tight">
              <div>
                <h3>Demo mode</h3>
                <p className="text-secondary">
                  Data is stored in this browser only. Reset to start again with fresh sample data.
                </p>
              </div>
            </div>
            <button
              className="btn btn-danger-ghost"
              onClick={() => {
                if (!window.confirm('Reset all demo data? Your changes will be lost.')) return
                resetDemoData()
                window.location.assign('/')
              }}
            >
              <RotateCcw size={16} /> Reset demo data
            </button>
          </div>
        )}
      </div>
    </>
  )
}
