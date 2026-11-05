import { navigate } from '../App.jsx'
import { DOMAINS, OBJECTIVES, objectiveById, domainById } from '../data/objectives.js'
import { NOTES } from '../data/notes.js'
import { useProgress, pct } from '../progress.js'
import { Rich } from './common.jsx'

export default function Guide({ params }) {
  const objective = params.o && objectiveById(params.o)
  return objective ? <ObjectivePage o={objective} /> : <Overview focus={params.d} />
}

function Overview({ focus }) {
  const { byObjective, toggleStudied } = useProgress()
  return (
    <section>
      <h1>Study guide</h1>
      <p className="lede">Every CS0-004 objective with original notes. Read one, mark it studied, then test yourself on it.</p>
      {DOMAINS.filter((d) => !focus || d.id === focus).map((d) => (
        <div key={d.id} className="domain-block">
          <h2 className="section-head">
            <span className="domain-num">{d.num}</span> {d.title} <span className="weight">{d.weight}%</span>
          </h2>
          <ul className="obj-list">
            {OBJECTIVES.filter((o) => o.domain === d.id).map((o) => {
              const s = byObjective[o.id]
              return (
                <li key={o.id} className={s.studied ? 'done' : ''}>
                  <input type="checkbox" checked={s.studied} onChange={() => toggleStudied(o.id)} aria-label={`Mark ${o.id} studied`} />
                  <button className="obj-link" onClick={() => navigate('guide', { o: o.id })}>
                    <span className="obj-id">{o.id}</span>
                    <span className="obj-title">{o.title}</span>
                  </button>
                  <span className="obj-meta">
                    {s.answered ? <>{pct(s.acc)} of {s.answered} right</> : <>{s.total} questions</>}
                  </span>
                </li>
              )
            })}
          </ul>
        </div>
      ))}
      {focus && <button className="btn ghost" onClick={() => navigate('guide')}>Show all domains</button>}
    </section>
  )
}

function ObjectivePage({ o }) {
  const { byObjective, toggleStudied } = useProgress()
  const s = byObjective[o.id]
  const d = domainById(o.domain)
  const idx = OBJECTIVES.indexOf(o)
  const prev = OBJECTIVES[idx - 1]
  const next = OBJECTIVES[idx + 1]
  const notes = NOTES[o.id] ?? []

  return (
    <section className="objective">
      <button className="back" onClick={() => navigate('guide', { d: d.id })}>← Domain {d.num}: {d.title}</button>
      <p className="kicker">Objective {o.id}</p>
      <h1>{o.title}</h1>

      <div className="card topics">
        <h3>What the exam covers</h3>
        {o.scope && <p className="muted">CompTIA's scope: {o.scope}</p>}
        <ul>{o.topics.map((t) => <li key={t}>{t}</li>)}</ul>
      </div>

      {notes.map((sec) => (
        <article key={sec.heading} className="note">
          <h2>{sec.heading}</h2>
          <ul>{sec.points.map((p, i) => <li key={i}><Rich text={p} /></li>)}</ul>
          {sec.tip && <p className="tip"><strong>Exam tip</strong> <Rich text={sec.tip} /></p>}
        </article>
      ))}

      <div className="card action-bar">
        <label className="check big">
          <input type="checkbox" checked={s.studied} onChange={() => toggleStudied(o.id)} />
          I've studied {o.id}
        </label>
        <div className="row wrap">
          <button className="btn" onClick={() => navigate('practice', { f: o.id })}>Practice {s.total} questions</button>
          <button className="btn ghost" onClick={() => navigate('cards', { f: o.id })}>Flashcards ({s.terms})</button>
        </div>
      </div>

      <div className="pager">
        {prev ? <button className="btn ghost" onClick={() => navigate('guide', { o: prev.id })}>← {prev.id}</button> : <span />}
        {next && <button className="btn ghost" onClick={() => navigate('guide', { o: next.id })}>{next.id} →</button>}
      </div>
    </section>
  )
}
