import { useState } from 'react'
import { Navigate, useLocation, useNavigate } from 'react-router-dom'
import { Check, Eye, EyeOff, FileText, Lock, Mail, ReceiptText, TrendingUp } from 'lucide-react'
import { useAuth } from '../auth/AuthProvider'
import { USE_MOCK, getRemember, getRememberedEmail, setRemember, setRememberedEmail } from '../lib/supabase'
import { DEMO_ACCOUNTS } from '../lib/mockApi'
import { ErrorBanner } from '../components/ui'

export default function Login() {
  const { user, loading, signIn } = useAuth()
  const navigate = useNavigate()
  const location = useLocation()
  const [email, setEmail] = useState(getRememberedEmail)
  const [password, setPassword] = useState('')
  const [show, setShow] = useState(false)
  const [remember, setRememberState] = useState(getRemember)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')

  const from = location.state?.from?.pathname || '/'
  if (!loading && user) return <Navigate to={from} replace />

  async function handleSubmit(e) {
    e.preventDefault()
    setBusy(true)
    setError('')
    // Must be set before sign-in so the session is written to the right storage
    setRemember(remember)
    const { error } = await signIn(email.trim(), password)
    if (error) {
      setError(error.message === 'Invalid login credentials' ? 'Incorrect email or password.' : error.message)
      setBusy(false)
      return
    }
    setRememberedEmail(remember ? email.trim() : '')
    navigate(from, { replace: true })
  }

  return (
    <div className="login">
      <section className="login-aside">
        <div className="login-brand">
          <div className="logo-mark logo-mark-lg">RG</div>
          <div>
            <div className="brand-name">Rizwan Global Trader</div>
            <div className="brand-sub">Billing &amp; Sales</div>
          </div>
        </div>

        <div className="login-pitch">
          <h2>Quotations to invoices, in one place.</h2>
          <p>Create professional quotations, convert them to invoices in a click, and keep track of every rupee owed.</p>
          <ul>
            <li>
              <FileText size={18} /> Quotations with validity dates
            </li>
            <li>
              <ReceiptText size={18} /> Printable invoices with tax and discount
            </li>
            <li>
              <TrendingUp size={18} /> Live sales and outstanding dashboard
            </li>
          </ul>
        </div>

        <div className="login-foot">© {new Date().getFullYear()} Rizwan Global Trader</div>
      </section>

      <section className="login-main">
        <form className="login-card" onSubmit={handleSubmit}>
          <h1>Welcome back</h1>
          <p className="text-secondary">Sign in to your account to continue.</p>

          <ErrorBanner message={error} />

          <label className="field">
            <span className="field-label">Email</span>
            <div className="input-icon">
              <Mail size={16} />
              <input
                className="input"
                type="email"
                autoComplete="email"
                autoFocus
                required
                placeholder="you@company.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
              />
            </div>
          </label>

          <label className="field">
            <span className="field-label">Password</span>
            <div className="input-icon">
              <Lock size={16} />
              <input
                className="input"
                type={show ? 'text' : 'password'}
                autoComplete="current-password"
                required
                placeholder="••••••••"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
              />
              <button
                type="button"
                className="input-suffix"
                onClick={() => setShow((s) => !s)}
                aria-label={show ? 'Hide password' : 'Show password'}
              >
                {show ? <EyeOff size={16} /> : <Eye size={16} />}
              </button>
            </div>
          </label>

          <label className="checkbox">
            <input type="checkbox" checked={remember} onChange={(e) => setRememberState(e.target.checked)} />
            <span className="checkbox-box" aria-hidden="true">
              <Check size={12} strokeWidth={3.2} />
            </span>
            <span>Remember me</span>
          </label>

          <button className="btn btn-primary btn-block btn-lg" disabled={busy}>
            {busy ? 'Signing in…' : 'Sign in'}
          </button>

          {USE_MOCK ? (
            <div className="demo-box">
              <div className="strong">Demo accounts</div>
              <div className="demo-accounts">
                {DEMO_ACCOUNTS.map((a) => (
                  <div key={a.role} className="demo-account">
                    <div>
                      <div className="strong">{a.label}</div>
                      <div className="text-secondary">
                        {a.email} · {a.password}
                      </div>
                    </div>
                    <button
                      type="button"
                      className="btn btn-secondary btn-sm"
                      onClick={() => {
                        setEmail(a.email)
                        setPassword(a.password)
                      }}
                    >
                      Use
                    </button>
                  </div>
                ))}
              </div>
            </div>
          ) : (
            <p className="login-note">Accounts are created by your administrator.</p>
          )}
        </form>
      </section>
    </div>
  )
}
