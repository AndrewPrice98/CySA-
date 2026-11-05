import { DOMAINS, OBJECTIVES } from '../data/objectives.js'
import { matches } from '../progress.js'

// Renders **bold** and `code` inside note text
export function Rich({ text }) {
  const parts = text.split(/(\*\*[^*]+\*\*|`[^`]+`)/g)
  return parts.map((p, i) => {
    if (p.startsWith('**') && p.endsWith('**')) return <strong key={i}>{p.slice(2, -2)}</strong>
    if (p.startsWith('`') && p.endsWith('`')) return <code key={i}>{p.slice(1, -1)}</code>
    return p
  })
}

// Dropdown for 'all' | domain | objective, with item counts
export function ScopeSelect({ value, onChange, items, label = 'Topic' }) {
  const count = (f) => items.filter((x) => matches(f, x.objective)).length
  return (
    <label className="field">
      <span>{label}</span>
      <select value={value} onChange={(e) => onChange(e.target.value)}>
        <option value="all">All domains ({items.length})</option>
        {DOMAINS.map((d) => (
          <optgroup key={d.id} label={`Domain ${d.num}: ${d.title}`}>
            <option value={d.id}>All of domain {d.num} ({count(d.id)})</option>
            {OBJECTIVES.filter((o) => o.domain === d.id).map((o) => (
              <option key={o.id} value={o.id}>{o.id} {o.title} ({count(o.id)})</option>
            ))}
          </optgroup>
        ))}
      </select>
    </label>
  )
}

export function scopeLabel(f) {
  if (!f || f === 'all') return 'all domains'
  const d = DOMAINS.find((x) => x.id === f)
  if (d) return `Domain ${d.num}: ${d.title}`
  const o = OBJECTIVES.find((x) => x.id === f)
  return o ? `${o.id} ${o.title}` : f
}

export function Meter({ value, tone }) {
  return (
    <div className={`meter ${tone ?? ''}`} role="presentation">
      <span style={{ width: `${Math.max(0, Math.min(1, value ?? 0)) * 100}%` }} />
    </div>
  )
}
