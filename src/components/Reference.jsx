import { useState } from 'react'
import { PORTS, EVENT_IDS, LOGON_TYPES, FRAMEWORKS, COMMANDS } from '../data/reference.js'

const TABS = [
  ['frameworks', 'Frameworks'],
  ['ports', 'Ports'],
  ['events', 'Windows Event IDs'],
  ['commands', 'Commands'],
]

export default function Reference() {
  const [tab, setTab] = useState('frameworks')
  const [q, setQ] = useState('')
  const has = (...fields) => !q || fields.join(' ').toLowerCase().includes(q.toLowerCase())

  return (
    <section>
      <h1>Reference</h1>
      <p className="lede">The tables you keep looking up while reading logs and answering scenario questions.</p>
      <div className="toolbar">
        <div className="segmented" role="tablist">
          {TABS.map(([k, label]) => (
            <button key={k} role="tab" aria-selected={tab === k} className={tab === k ? 'active' : ''} onClick={() => { setTab(k); setQ('') }}>{label}</button>
          ))}
        </div>
        {tab !== 'frameworks' && (
          <input type="search" className="grow" placeholder="Filter…" value={q} onChange={(e) => setQ(e.target.value)} aria-label="Filter table" />
        )}
      </div>

      {tab === 'frameworks' && (
        <div className="grid two">
          {FRAMEWORKS.map((f) => (
            <div key={f.name} className="card framework">
              <h2>{f.name}</h2>
              {f.summary && <p className="muted">{f.summary}</p>}
              {f.kind === 'steps' ? (
                <ol className="steps">{f.items.map(([a, b]) => <li key={a}><strong>{a}</strong>{b && <span> {b}</span>}</li>)}</ol>
              ) : (
                <dl className="pairs">{f.items.map(([a, b]) => <div key={a}><dt>{a}</dt><dd>{b}</dd></div>)}</dl>
              )}
            </div>
          ))}
        </div>
      )}

      {tab === 'ports' && (
        <div className="card table-wrap">
          <table className="table">
            <thead><tr><th>Port</th><th>Protocol</th><th>Service</th><th>Why an analyst cares</th></tr></thead>
            <tbody>
              {PORTS.filter((p) => has(p.port, p.service, p.note, p.proto)).map((p) => (
                <tr key={p.port}><td><code>{p.port}</code></td><td>{p.proto}</td><td>{p.service}</td><td className="muted">{p.note}</td></tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {tab === 'events' && (
        <>
          <div className="card table-wrap">
            <table className="table">
              <thead><tr><th>ID</th><th>Log</th><th>Meaning</th><th>Notes</th></tr></thead>
              <tbody>
                {EVENT_IDS.filter((e) => has(e.id, e.log, e.meaning, e.note)).map((e) => (
                  <tr key={e.id}><td><code>{e.id}</code></td><td>{e.log}</td><td>{e.meaning}</td><td className="muted">{e.note}</td></tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="card">
            <h3>Logon types (in 4624 / 4625)</h3>
            <dl className="pairs compact">{LOGON_TYPES.map(([n, t]) => <div key={n}><dt><code>{n}</code></dt><dd>{t}</dd></div>)}</dl>
          </div>
        </>
      )}

      {tab === 'commands' && COMMANDS.map((c) => {
        const rows = c.rows.filter(([cmd, what]) => has(c.tool, cmd, what))
        if (!rows.length) return null
        return (
          <div key={c.tool} className="card table-wrap">
            <h2>{c.tool}</h2>
            <table className="table cmd-table">
              <tbody>{rows.map(([cmd, what]) => <tr key={cmd}><td><code>{cmd}</code></td><td>{what}</td></tr>)}</tbody>
            </table>
          </div>
        )
      })}
    </section>
  )
}
