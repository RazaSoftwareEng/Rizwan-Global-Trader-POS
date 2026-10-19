import { createClient } from '@supabase/supabase-js'

const url = import.meta.env.VITE_SUPABASE_URL
// New projects use a publishable key; older ones an anon key. Either works.
const key = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY || import.meta.env.VITE_SUPABASE_ANON_KEY

// "Remember me": session lives in localStorage (survives closing the browser)
// when on, sessionStorage (cleared when the browser closes) when off.
const REMEMBER_KEY = 'rgt-remember'
const EMAIL_KEY = 'rgt-email'

export const safe = (fn, fallback) => {
  try {
    return fn()
  } catch {
    return fallback
  }
}

export const getRemember = () => safe(() => localStorage.getItem(REMEMBER_KEY) !== '0', true)
export const setRemember = (on) => safe(() => localStorage.setItem(REMEMBER_KEY, on ? '1' : '0'))
export const getRememberedEmail = () => safe(() => localStorage.getItem(EMAIL_KEY) ?? '', '')
export const setRememberedEmail = (email) =>
  safe(() => (email ? localStorage.setItem(EMAIL_KEY, email) : localStorage.removeItem(EMAIL_KEY)))

export const authStorage = {
  getItem: (k) => safe(() => (getRemember() ? localStorage : sessionStorage).getItem(k), null),
  setItem: (k, v) => safe(() => (getRemember() ? localStorage : sessionStorage).setItem(k, v)),
  removeItem: (k) =>
    safe(() => {
      localStorage.removeItem(k)
      sessionStorage.removeItem(k)
    }),
}

// Demo mode: no database needed, data and login live in the browser
export const USE_MOCK = import.meta.env.VITE_USE_MOCK === 'true'

export const isConfigured = USE_MOCK || Boolean(url && key)
export const supabase = url && key ? createClient(url, key, { auth: { storage: authStorage } }) : null
