import { useEffect, useState } from 'react'
import { navigate } from '../App.jsx'
import { LABS } from '../data/labs/index.js'
import { DOMAINS, objectiveById } from '../data/objectives.js'
import { useStored } from '../hooks/useStored.js'
import { KEYS, pct } from '../progress.js'
import LabRunner, { gradeLab } from './labs/LabRunner.jsx'

const domainsOf = (lab) => [...new Set(lab.objectives.map((o) => objectiveById(o)?.domain))]

export default function Labs({ params }) {
  const lab = params.lab && LABS.find((l) => l.id === params.lab)
  return lab ? <LabPage lab={lab} /> : <LabList />
}

function LabList() {
  const [results] = useStored(KEYS.labs, {})
  const [domain, setDomain] = useState('all')
  const list = LABS.filter((l) => domain === 'all' || domainsOf(l).includes(domain))
  const done = LABS.filter((l) => (results[l.id]?.best ?? 0) >= 0.85).length

  return (
    <section>
      <h1>PBQ labs</h1>
      <p className="lede">
        Hands-on performance-based questions like the ones that open the real exam. Dig through logs in a live terminal,
        click the evidence, configure rules, order response steps and classify findings. Scoring gives partial credit
        per item. {done} of {LABS.length} passed at 85%+.
      </p>
      <div className="toolbar">
        <div className="segmented" role="group" aria-label="Filter by domain">
          <button className={domain === 'all' ? 'active' : ''} aria-pressed={domain === 'all'} onClick={() => setDomain('all')}>All ({LABS.length})</button>
          {DOMAINS.map((d) => {
            const n = LABS.filter((l) => domainsOf(l).includes(d.id)).length
            return <button key={d.id} className={domain === d.id ? 'active' : ''} aria-pressed={domain === d.id} onClick={() => setDomain(d.id)}>D{d.num} ({n})</button>
          })}
        </div>
      </div>
      <div className="lab-grid">
        {list.map((l) => {
          const r = results[l.id]
          return (
            <button key={l.id} className="lab-card" onClick={() => navigate('labs', { lab: l.id })}>
              <span className="lab-card-top">
                <span className="tags">{l.objectives.map((o) => <span key={o} className="tag">{o}</span>)}</span>
                {r && <span className={`lab-best ${r.best >= 0.85 ? 'pass' : ''}`}>{pct(r.best)}</span>}
              </span>
              <strong className="lab-title">{l.title}</strong>
              <span className="lab-desc">{l.scenario.length > 150 ? `${l.scenario.slice(0, 147)}…` : l.scenario}</span>
              <span className="lab-meta">
                {l.files && <span className="term-badge">&gt;_ terminal</span>}
                <span>{l.tasks.length} tasks</span>
                <span>~{l.minutes} min</span>
                <span>{l.difficulty}</span>
              </span>
            </button>
          )
        })}
      </div>
    </section>
  )
}

function LabPage({ lab }) {
  const [answers, setAnswers] = useStored(`cysa.lab.${lab.id}`, {})
  const [results, setResults] = useStored(KEYS.labs, {})
  const [checked, setChecked] = useState(null)
  const [reveal, setReveal] = useState(false)
  const [started] = useState(Date.now())
  const [now, setNow] = useState(Date.now())
  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 1000)
    return () => clearInterval(t)
  }, [])

  const idx = LABS.indexOf(lab)
  const next = LABS[idx + 1]
  const answeredCount = lab.tasks.filter((t) => answers[t.id] !== undefined && answers[t.id] !== '' && !(Array.isArray(answers[t.id]) && !answers[t.id].length)).length

  function check() {
    const g = gradeLab(lab, answers)
    setChecked(g)
    const prev = results[lab.id]
    setResults({ ...results, [lab.id]: { best: Math.max(prev?.best ?? 0, g.total), last: g.total, at: Date.now() } })
    requestAnimationFrame(() => document.querySelector('.lab-result')?.scrollIntoView({ behavior: 'smooth', block: 'nearest' }))
  }
  function reset() {
    setAnswers({})
    setChecked(null)
    setReveal(false)
  }
  const edit = (a) => {
    setAnswers(a)
    if (checked) setChecked(null)
  }

  const secs = Math.floor((now - started) / 1000)
  const toolbar = (
    <div className="lab-toolbar">
      <span className="fine">{answeredCount}/{lab.tasks.length} answered · {Math.floor(secs / 60)}:{String(secs % 60).padStart(2, '0')} (target ~{lab.minutes} min)</span>
      <span className="spacer" />
      <button className="btn" onClick={check}>Check answers</button>
      <button className="btn ghost" onClick={() => setReveal(!reveal)}>{reveal ? 'Hide solution' : 'Show solution'}</button>
      <button className="btn ghost" onClick={reset}>Reset</button>
    </div>
  )

  return (
    <section>
      <button className="back" onClick={() => navigate('labs')}>← All labs</button>
      <h1>{lab.title}</h1>
      <LabRunner lab={lab} answers={answers} setAnswers={edit} checked={checked} reveal={reveal} toolbar={toolbar} />
      {checked && (
        <div className={`card lab-result ${checked.total >= 0.85 ? 'pass' : ''}`}>
          <p className="big-num">{pct(checked.total)}<small> on this attempt · best {pct(Math.max(results[lab.id]?.best ?? 0, checked.total))}</small></p>
          <p className="muted">{checked.total >= 0.85 ? 'Passed. Try it again in a few days without hints to make it stick.' : 'Read the explanations under each task (marked in red or amber), fix them, and check again.'}</p>
          <div className="row wrap">
            {next && <button className="btn" onClick={() => navigate('labs', { lab: next.id })}>Next lab: {next.title}</button>}
            <button className="btn ghost" onClick={reset}>Start this lab over</button>
          </div>
        </div>
      )}
    </section>
  )
}
