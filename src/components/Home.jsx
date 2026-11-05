import { navigate } from '../App.jsx'
import { DOMAINS, OBJECTIVES, EXAM } from '../data/objectives.js'
import { QUESTIONS } from '../data/questions.js'
import { TERMS } from '../data/terms.js'
import { useProgress, KEYS, pct } from '../progress.js'
import { useEffect, useState } from 'react'
import { useStored } from '../hooks/useStored.js'
import { Meter } from './common.jsx'

function daysUntil(date) {
  if (!date) return null
  const today = new Date()
  today.setHours(0, 0, 0, 0)
  const target = new Date(`${date}T00:00:00`)
  return Math.round((target - today) / 86400000)
}

export default function Home() {
  const { byObjective, byDomain } = useProgress()
  const [examDate, setExamDate] = useStored(KEYS.examDate, '')
  const [exams] = useStored(KEYS.exams, [])
  const [labResults] = useStored(KEYS.labs, {})
  // Lab data is in its own chunk; fetch it after first paint
  const [LABS, setLabs] = useState([])
  useEffect(() => { import('../data/labs/index.js').then((m) => setLabs(m.LABS)) }, [])
  const labsPassed = LABS.filter((l) => (labResults[l.id]?.best ?? 0) >= 0.85).length
  const nextLab = LABS.find((l) => !labResults[l.id])
  const days = daysUntil(examDate)

  const nextUnstudied = OBJECTIVES.find((o) => !byObjective[o.id].studied)
  const weakest = OBJECTIVES
    .filter((o) => byObjective[o.id].answered >= 3)
    .sort((a, b) => byObjective[a.id].acc - byObjective[b.id].acc)[0]
  const answered = Object.values(byObjective).reduce((n, x) => n + x.answered, 0)

  return (
    <section>
      <p className="kicker">{EXAM.name} · {EXAM.code}</p>
      <h1>Dashboard</h1>
      <p className="lede">
        The V4 exam (launched June 2026): up to {EXAM.maxQuestions} questions in {EXAM.minutes} minutes, opening with
        performance-based questions (PBQs), then multiple choice. Passing is {EXAM.passing} on a {EXAM.scale} scale.
        Study each objective, practise the hands-on labs until they feel routine, then run full simulations.
      </p>

      <div className="grid two">
        <div className="card">
          <h2>Exam day</h2>
          <label className="field inline">
            <span>Booked for</span>
            <input type="date" value={examDate} onChange={(e) => setExamDate(e.target.value)} />
          </label>
          {days === null && <p className="muted">Set a date to get a countdown.</p>}
          {days !== null && days > 0 && <p className="big-num">{days}<small> day{days === 1 ? '' : 's'} to go</small></p>}
          {days === 0 && <p className="big-num">Today<small>. Good luck.</small></p>}
          {days !== null && days < 0 && <p className="muted">That date has passed. Set a new one if you're retaking.</p>}
        </div>

        <div className="card">
          <h2>Up next</h2>
          {nextUnstudied ? (
            <p>
              Study <button className="linkish" onClick={() => navigate('guide', { o: nextUnstudied.id })}>{nextUnstudied.id} {nextUnstudied.title}</button>
            </p>
          ) : <p>Every objective is marked studied. Time for full exam simulations.</p>}
          {weakest && byObjective[weakest.id].acc < 0.85 && (
            <p>
              Weakest area: <button className="linkish" onClick={() => navigate('practice', { f: weakest.id })}>{weakest.id} {weakest.title}</button>{' '}
              <span className="muted">({pct(byObjective[weakest.id].acc)} right)</span>
            </p>
          )}
          {nextLab && (
            <p>
              Hands-on: <button className="linkish" onClick={() => navigate('labs', { lab: nextLab.id })}>{nextLab.title}</button>{' '}
              <span className="muted">({labsPassed}/{LABS.length} PBQ labs passed)</span>
            </p>
          )}
          <div className="row wrap">
            <button className="btn" onClick={() => navigate('labs')}>PBQ labs</button>
            <button className="btn ghost" onClick={() => navigate('practice')}>Practice questions</button>
            <button className="btn ghost" onClick={() => navigate('exam')}>Exam simulation</button>
          </div>
          <p className="fine">{answered} of {QUESTIONS.length} questions answered · {TERMS.length} flashcards</p>
        </div>
      </div>

      <h2 className="section-head">Domains</h2>
      <div className="domain-list">
        {DOMAINS.map((d) => {
          const s = byDomain[d.id]
          return (
            <div key={d.id} className="card domain-card">
              <div className="domain-head">
                <span className="domain-num">{d.num}</span>
                <div>
                  <h3>{d.title}</h3>
                  <p className="fine">{d.weight}% of the exam</p>
                </div>
                <button className="btn ghost small" onClick={() => navigate('guide', { d: d.id })}>Open</button>
              </div>
              <dl className="stats">
                <div><dt>Objectives studied</dt><dd>{s.studied} / {s.objectives}</dd><Meter value={s.studied / s.objectives} /></div>
                <div><dt>Questions right</dt><dd>{pct(s.acc)} <small>of {s.answered} tried</small></dd><Meter value={s.acc} tone={s.acc === null ? '' : s.acc >= 0.8 ? 'good' : s.acc >= 0.6 ? 'warn' : 'bad'} /></div>
                <div><dt>Flashcards known</dt><dd>{s.known} / {s.terms}</dd><Meter value={s.terms ? s.known / s.terms : 0} /></div>
              </dl>
            </div>
          )
        })}
      </div>

      {exams.length > 0 && (
        <>
          <h2 className="section-head">Exam simulations</h2>
          <div className="card">
            <table className="table">
              <thead><tr><th>Date</th><th>Overall</th><th>PBQs</th>{DOMAINS.map((d) => <th key={d.id}>D{d.num}</th>)}</tr></thead>
              <tbody>
                {[...exams].reverse().slice(0, 8).map((e) => (
                  <tr key={e.at}>
                    <td>{new Date(e.at).toLocaleDateString()}</td>
                    <td><strong>{pct(e.right / e.total)}</strong></td>
                    <td>{e.pbq?.length ? pct(e.pbq.reduce((s, p) => s + p.score, 0) / e.pbq.length) : '–'}</td>
                    {DOMAINS.map((d) => {
                      const [r, t] = e.byDomain[d.id] ?? [0, 0]
                      return <td key={d.id}>{t ? pct(r / t) : '–'}</td>
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}
    </section>
  )
}
