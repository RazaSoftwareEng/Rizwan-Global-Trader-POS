// A select you can type into to filter. Shows 4 options at a time; only list values can be chosen.
import { useEffect, useLayoutEffect, useRef, useState } from 'react'
import { Check, ChevronDown, Search } from 'lucide-react'

export default function SearchSelect({ value, options, onChange, invalid, placeholder = 'Search…' }) {
  const [open, setOpen] = useState(false)
  const [q, setQ] = useState('')
  const [active, setActive] = useState(0)
  const listRef = useRef(null)
  const boxRef = useRef(null)
  const [pos, setPos] = useState(null)

  // The menu floats above everything (fixed) so modals can't clip it; opens upward when there's no room below
  useLayoutEffect(() => {
    if (!open) return
    const place = () => {
      const r = boxRef.current.getBoundingClientRect()
      const below = window.innerHeight - r.bottom
      setPos(
        below < 180 && r.top > below
          ? { left: r.left, width: r.width, bottom: window.innerHeight - r.top + 4 }
          : { left: r.left, width: r.width, top: r.bottom + 4 },
      )
    }
    place()
    window.addEventListener('resize', place)
    window.addEventListener('scroll', place, true)
    return () => {
      window.removeEventListener('resize', place)
      window.removeEventListener('scroll', place, true)
    }
  }, [open])

  const needle = q.trim().toLowerCase()
  const matches = options.filter((o) => !needle || o.toLowerCase().includes(needle))

  // Keep the highlighted option in view while using the arrow keys
  useEffect(() => {
    listRef.current?.children[active]?.scrollIntoView({ block: 'nearest' })
  }, [active, open])

  function openList() {
    setQ('')
    setActive(Math.max(0, options.indexOf(value)))
    setOpen(true)
  }

  function choose(o) {
    onChange(o)
    setOpen(false)
    setQ('')
  }

  function onKeyDown(e) {
    if (!open && (e.key === 'ArrowDown' || e.key === 'Enter')) {
      e.preventDefault()
      openList()
      return
    }
    if (e.key === 'ArrowDown') {
      e.preventDefault()
      setActive((a) => Math.min(a + 1, matches.length - 1))
    } else if (e.key === 'ArrowUp') {
      e.preventDefault()
      setActive((a) => Math.max(a - 1, 0))
    } else if (e.key === 'Enter') {
      e.preventDefault()
      if (matches[active]) choose(matches[active])
    } else if (e.key === 'Escape' && open) {
      e.stopPropagation() // close the list, not the modal
      setOpen(false)
    }
  }

  return (
    <div className={`ss ${open ? 'ss-open' : ''}`}>
      <div className="input-icon" ref={boxRef}>
        {open && <Search size={16} />}
        <input
          className={`input ss-input ${invalid ? 'invalid' : ''} ${open ? 'ss-searching' : ''}`}
          value={open ? q : value ?? ''}
          placeholder={open ? placeholder : ''}
          onChange={(e) => {
            setQ(e.target.value)
            setActive(0)
            setOpen(true)
          }}
          onFocus={openList}
          onClick={() => !open && openList()}
          onBlur={() => setTimeout(() => setOpen(false), 120)}
          onKeyDown={onKeyDown}
          role="combobox"
          aria-expanded={open}
          autoComplete="off"
        />
        <ChevronDown size={16} className="ss-chevron" />
      </div>
      {open && (
        <div className="ss-menu" ref={listRef} role="listbox" style={pos ?? { visibility: 'hidden' }}>
          {matches.length === 0 ? (
            <div className="ss-empty">No match for “{q}”</div>
          ) : (
            matches.map((o, i) => (
              <div
                key={o}
                role="option"
                aria-selected={o === value}
                className={`ss-option ${i === active ? 'active' : ''} ${o === value ? 'selected' : ''}`}
                onMouseDown={(e) => {
                  e.preventDefault()
                  choose(o)
                }}
                onMouseEnter={() => setActive(i)}
              >
                {o}
                {o === value && <Check size={15} />}
              </div>
            ))
          )}
        </div>
      )}
    </div>
  )
}
