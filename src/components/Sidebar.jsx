import { useState } from 'react'
import { SECTIONS, navigate } from '../App.jsx'
import { DOMAINS } from '../data/objectives.js'
import { useProgress, KEYS } from '../progress.js'
import { useStored } from '../hooks/useStored.js'

export default function Sidebar({ active }) {
  const [theme, setTheme] = useStored(KEYS.theme, 'system')
  const [open, setOpen] = useState(false)
  const { byDomain } = useProgress()
  const studied = DOMAINS.reduce((n, d) => n + byDomain[d.id].studied, 0)
  const total = DOMAINS.reduce((n, d) => n + byDomain[d.id].objectives, 0)

  const go = (id) => {
    setOpen(false)
    navigate(id)
  }

  return (
    <header className={`side ${open ? 'open' : ''}`}>
      <div className="side-top">
        <button className="brand" onClick={() => go('home')}>
          <span className="brand-mark" aria-hidden="true">
            <svg viewBox="0 0 24 24" width="22" height="22"><path d="M12 2 3 6v6c0 5 3.8 9.4 9 10 5.2-.6 9-5 9-10V6l-9-4Z" fill="none" stroke="currentColor" strokeWidth="2" strokeLinejoin="round" /><path d="m8.5 12 2.5 2.5 4.5-5" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" /></svg>
          </span>
          <span className="brand-name">CySA+ <b>Study</b></span>
        </button>
        <button className="menu-btn" aria-expanded={open} aria-controls="side-nav" onClick={() => setOpen(!open)}>
          {open ? 'Close' : 'Menu'}
        </button>
      </div>

      <nav id="side-nav" className="side-nav" aria-label="Sections">
        {SECTIONS.map((s) => (
          <button key={s.id} className={active === s.id ? 'active' : ''} aria-current={active === s.id ? 'page' : undefined} onClick={() => go(s.id)}>
            {s.label}
          </button>
        ))}
      </nav>

      <div className="side-foot">
        <div className="side-progress">
          <span>{studied} of {total} objectives studied</span>
          <div className="meter"><span style={{ width: `${(studied / total) * 100}%` }} /></div>
        </div>
        <div className="segmented" role="group" aria-label="Theme">
          {[['light', 'Light'], ['dark', 'Dark'], ['system', 'Auto']].map(([k, label]) => (
            <button key={k} className={theme === k ? 'active' : ''} aria-pressed={theme === k} onClick={() => setTheme(k)}>{label}</button>
          ))}
        </div>
      </div>
    </header>
  )
}
