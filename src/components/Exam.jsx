import { useEffect, useMemo, useState } from 'react'
import { DOMAINS, EXAM, objectiveById } from '../data/objectives.js'
import { QUESTIONS } from '../data/questions.js'
import { LABS } from '../data/labs/index.js'
import { useStored } from '../hooks/useStored.js'
import { KEYS, shuffle, pct } from '../progress.js'
import { recordAnswer } from './Practice.jsx'
import Question from './Question.jsx'
import LabRunner, { gradeLab } from './labs/LabRunner.jsx'

const RUN_KEY = 'cysa.examRun' // in-progress exam survives a refresh
const PBQ_WEIGHT = 3 // each PBQ counts as this many questions in the combined score
const domainOf = (q) => objectiveById(q.objective).domain
const PBQS_FOR = { 25: 1, 50: 2, 85: 3 }

// Pick n questions, split across domains by exam weight
function buildExam(n) {
  const pools = Object.fromEntries(DOMAINS.map((d) => [d.id, shuffle(QUESTIONS.filter((q) => domainOf(q) === d.id))]))
  const want = DOMAINS.map((d) => ({ id: d.id, n: Math.min(pools[d.id].length, Math.round((n * d.weight) / 100)) }))
  let picked = want.flatMap((w) => pools[w.id].slice(0, w.n))
  if (picked.length < n) {
    const used = new Set(picked.map((q) => q.id))
    picked = picked.concat(shuffle(QUESTIONS.filter((q) => !used.has(q.id))).slice(0, n - picked.length))
  }
  return shuffle(picked.slice(0, n))
}

function fmt(sec) {
  const s = Math.max(0, Math.floor(sec))
  const h = Math.floor(s / 3600)
  const m = Math.floor((s % 3600) / 60)
  return `${h ? `${h}:` : ''}${String(m).padStart(h ? 2 : 1, '0')}:${String(s % 60).padStart(2, '0')}`
}

export default function Exam() {
  const [run, setRun] = useStored(RUN_KEY, null)
  if (!run) return <Setup onStart={setRun} />
  if (run.submittedAt) return <Results run={run} onReset={() => setRun(null)} />
  return <Running run={run} setRun={setRun} />
}

function Setup({ onStart }) {
  const sizes = [25, 50, EXAM.maxQuestions]
  const [size, setSize] = useState(50)
  const [timed, setTimed] = useState(true)
  const [withPbq, setWithPbq] = useState(true)
  const pbqs = withPbq ? Math.min(PBQS_FOR[size] ?? 1, LABS.length) : 0
  const mcq = Math.min(QUESTIONS.length, size - pbqs)
  const minutes = Math.round((EXAM.minutes * size) / EXAM.maxQuestions)

  function start() {
    const labIds = shuffle(LABS).slice(0, pbqs).map((l) => l.id)
    const qs = buildExam(mcq)
    onStart({ labIds, labAnswers: {}, ids: qs.map((q) => q.id), answers: {}, flags: {}, index: 0, startedAt: Date.now(), minutes: timed ? minutes : null })
  }

  return (
    <section>
      <h1>Exam simulator</h1>
      <p className="lede">
        A timed {EXAM.code} run with no feedback until you submit, like test day. Like the real exam, it opens with
        performance-based questions, then multiple choice weighted by domain. Flag items and jump around before submitting.
      </p>
      <div className="card setup">
        <div className="field">
          <span>Length</span>
          <div className="segmented" role="group" aria-label="Number of items">
            {sizes.map((n) => (
              <button key={n} className={size === n ? 'active' : ''} aria-pressed={size === n} onClick={() => setSize(n)}>
                {n}{n === EXAM.maxQuestions ? ' (full)' : ''}
              </button>
            ))}
          </div>
        </div>
        <label className="check">
          <input type="checkbox" checked={withPbq} onChange={(e) => setWithPbq(e.target.checked)} />
          Start with {PBQS_FOR[size]} PBQ lab{PBQS_FOR[size] === 1 ? '' : 's'}
        </label>
        <label className="check">
          <input type="checkbox" checked={timed} onChange={(e) => setTimed(e.target.checked)} />
          Timed: {minutes} minutes (real pace: {EXAM.minutes} min for up to {EXAM.maxQuestions} items)
        </label>
        <p className="fine">
          {pbqs ? `${pbqs} PBQ${pbqs > 1 ? 's' : ''} + ` : ''}{mcq} multiple choice. Domain mix: {DOMAINS.map((d) => `${d.weight}% D${d.num}`).join(' · ')}.
          {pbqs > 0 && ' Strategy: read each PBQ, flag it and move on, finish the multiple choice, then come back with the time that’s left. Budget about 5–10 minutes per PBQ.'}
        </p>
        <button className="btn" onClick={start}>Start exam</button>
      </div>
    </section>
  )
}

function useItems(run) {
  return useMemo(() => [
    ...(run.labIds ?? []).map((id) => ({ kind: 'lab', id, lab: LABS.find((l) => l.id === id) })).filter((x) => x.lab),
    ...run.ids.map((id) => ({ kind: 'q', id, q: QUESTIONS.find((q) => q.id === id) })).filter((x) => x.q),
  ], [run.labIds, run.ids])
}

function isAnswered(run, item) {
  if (item.kind === 'q') return run.answers[item.id] !== undefined
  const a = run.labAnswers?.[item.id] ?? {}
  return item.lab.tasks.some((t) => a[t.id] !== undefined && a[t.id] !== '')
}

function Running({ run, setRun }) {
  const items = useItems(run)
  const [now, setNow] = useState(Date.now())
  const [confirming, setConfirming] = useState(false)
  const item = items[run.index]
  const remaining = run.minutes ? run.startedAt + run.minutes * 60000 - now : null
  const answeredCount = items.filter((x) => isAnswered(run, x)).length

  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 1000)
    return () => clearInterval(t)
  }, [])

  const [stats, setStats] = useStored(KEYS.quizStats, {})
  const [exams, setExams] = useStored(KEYS.exams, [])
  const [labResults, setLabResults] = useStored(KEYS.labs, {})

  function submit() {
    let next = stats
    const byDomain = {}
    let right = 0
    let total = 0
    for (const x of items.filter((i) => i.kind === 'q')) {
      const a = run.answers[x.id]
      const ok = a === x.q.answer
      const d = domainOf(x.q)
      byDomain[d] = byDomain[d] ?? [0, 0]
      byDomain[d][1]++
      total++
      if (ok) { right++; byDomain[d][0]++ }
      if (a !== undefined) next = recordAnswer(next, x.q, ok)
    }
    const pbq = items.filter((i) => i.kind === 'lab').map((x) => ({ id: x.id, score: gradeLab(x.lab, run.labAnswers?.[x.id]).total }))
    const lr = { ...labResults }
    for (const p of pbq) lr[p.id] = { best: Math.max(lr[p.id]?.best ?? 0, p.score), last: p.score, at: Date.now() }
    setLabResults(lr)
    setStats(next)
    const pbqPoints = pbq.reduce((s, p) => s + p.score * PBQ_WEIGHT, 0)
    setExams([...exams, { at: Date.now(), right: right + pbqPoints, total: total + pbq.length * PBQ_WEIGHT, mcq: [right, total], pbq, byDomain }].slice(-30))
    setRun({ ...run, submittedAt: Date.now() })
  }

  useEffect(() => {
    if (remaining !== null && remaining <= 0) submit()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [remaining !== null && remaining <= 0])

  const go = (i) => setRun({ ...run, index: Math.max(0, Math.min(items.length - 1, i)) })
  const pick = (i) => setRun({ ...run, answers: { ...run.answers, [item.id]: i } })
  const flag = () => setRun({ ...run, flags: { ...run.flags, [item.id]: !run.flags[item.id] } })
  const setLab = (a) => setRun({ ...run, labAnswers: { ...(run.labAnswers ?? {}), [item.id]: a } })
  const flagged = Object.values(run.flags).filter(Boolean).length

  if (!item) return null
  return (
    <section className={`exam ${item.kind === 'lab' ? 'exam-wide' : ''}`}>
      <div className="exam-bar">
        <strong>{item.kind === 'lab' ? `PBQ ${run.index + 1}` : `Question ${run.index + 1}`} / {items.length}</strong>
        <span className="muted">{answeredCount} answered</span>
        <span className="spacer" />
        {remaining !== null && <span className={`timer ${remaining < 5 * 60000 ? 'low' : ''}`}>{fmt(remaining / 1000)}</span>}
        <button className="btn ghost small" onClick={() => setConfirming(true)}>Submit</button>
      </div>

      {confirming && (
        <div className="card confirm" role="alertdialog" aria-label="Submit exam?">
          <p><strong>Submit now?</strong> {items.length - answeredCount > 0 ? `${items.length - answeredCount} item(s) have no answer and will score zero.` : 'Everything has an answer.'}{' '}
            {flagged > 0 && `${flagged} still flagged.`}</p>
          <div className="row">
            <button className="btn" onClick={submit}>Submit exam</button>
            <button className="btn ghost" onClick={() => setConfirming(false)}>Keep going</button>
          </div>
        </div>
      )}

      {item.kind === 'q'
        ? <Question q={item.q} picked={run.answers[item.id] ?? null} reveal={false} onPick={pick} header={null} />
        : (
          <>
            <h2 className="pbq-title">{item.lab.title}</h2>
            <LabRunner key={item.id} lab={item.lab} answers={run.labAnswers?.[item.id] ?? {}} setAnswers={setLab} mode="exam" />
          </>
        )}

      <div className="row wrap exam-nav">
        <button className="btn ghost" disabled={run.index === 0} onClick={() => go(run.index - 1)}>← Previous</button>
        <button className={`btn ghost ${run.flags[item.id] ? 'flagged' : ''}`} aria-pressed={!!run.flags[item.id]} onClick={flag}>
          {run.flags[item.id] ? '⚑ Flagged' : '⚐ Flag for review'}
        </button>
        <span className="spacer" />
        {run.index + 1 < items.length
          ? <button className="btn" onClick={() => go(run.index + 1)}>Next →</button>
          : <button className="btn" onClick={() => setConfirming(true)}>Review and submit</button>}
      </div>

      <div className="q-grid" aria-label="Jump to item">
        {items.map((x, i) => (
          <button
            key={x.id}
            className={[i === run.index && 'current', isAnswered(run, x) && 'answered', run.flags[x.id] && 'flag', x.kind === 'lab' && 'pbq'].filter(Boolean).join(' ')}
            onClick={() => go(i)}
            aria-label={`${x.kind === 'lab' ? 'PBQ' : 'Question'} ${i + 1}${isAnswered(run, x) ? ', answered' : ''}${run.flags[x.id] ? ', flagged' : ''}`}
          >{x.kind === 'lab' ? `P${i + 1}` : i + 1}</button>
        ))}
      </div>
      <button className="linkish small" onClick={() => { if (confirm('Abandon this exam? Answers are discarded.')) setRun(null) }}>Abandon exam</button>
    </section>
  )
}

function Results({ run, onReset }) {
  const items = useItems(run)
  const [onlyWrong, setOnlyWrong] = useState(true)
  const [openLab, setOpenLab] = useState(null)
  const qs = items.filter((x) => x.kind === 'q').map((x) => x.q)
  const labs = items.filter((x) => x.kind === 'lab').map((x) => ({ lab: x.lab, g: gradeLab(x.lab, run.labAnswers?.[x.id]) }))
  const right = qs.filter((q) => run.answers[q.id] === q.answer).length
  const pbqPoints = labs.reduce((s, l) => s + l.g.total * PBQ_WEIGHT, 0)
  const combined = (right + pbqPoints) / Math.max(1, qs.length + labs.length * PBQ_WEIGHT)
  const took = Math.round((run.submittedAt - run.startedAt) / 60000)
  const review = qs.filter((q) => !onlyWrong || run.answers[q.id] !== q.answer)

  return (
    <section>
      <h1>Exam results</h1>
      <div className="card result">
        <p className="big-num">{pct(combined)}<small> overall in {took} min</small></p>
        <p className={combined >= 0.8 ? 'good-text' : 'muted'}>
          {combined >= 0.85 ? 'Strong. Consistent scores like this suggest you\'re ready.' : combined >= 0.75 ? 'Close. Target the weakest area below and run another.' : 'Keep going. Review the misses below, then redo the weak objectives and labs.'}
        </p>
        <p className="fine">
          Multiple choice {right}/{qs.length} ({pct(right / Math.max(1, qs.length))}){labs.length > 0 && <>; PBQs {pct(labs.reduce((s, l) => s + l.g.total, 0) / labs.length)} with partial credit, each counted as {PBQ_WEIGHT} questions</>}.
          CompTIA reports a scaled score (750 to pass) and doesn't publish a percentage cut-off, so treat this as a guide.
        </p>
        <table className="table">
          <thead><tr><th>Domain (multiple choice)</th><th>Right</th><th>Score</th></tr></thead>
          <tbody>
            {DOMAINS.map((d) => {
              const ds = qs.filter((q) => domainOf(q) === d.id)
              const r = ds.filter((q) => run.answers[q.id] === q.answer).length
              return <tr key={d.id}><td>{d.num}. {d.title}</td><td>{r} / {ds.length}</td><td>{ds.length ? pct(r / ds.length) : '–'}</td></tr>
            })}
          </tbody>
        </table>
        <button className="btn" onClick={onReset}>New exam</button>
      </div>

      {labs.length > 0 && (
        <>
          <h2 className="section-head">PBQs</h2>
          {labs.map(({ lab, g }) => (
            <div key={lab.id} className="card">
              <div className="row wrap">
                <strong>{lab.title}</strong>
                <span className={`lab-best ${g.total >= 0.85 ? 'pass' : ''}`}>{pct(g.total)}</span>
                <span className="spacer" />
                <button className="btn ghost small" onClick={() => setOpenLab(openLab === lab.id ? null : lab.id)}>{openLab === lab.id ? 'Hide review' : 'Review answers'}</button>
              </div>
              {openLab === lab.id && <LabRunner lab={lab} answers={run.labAnswers?.[lab.id] ?? {}} setAnswers={() => {}} checked={g} reveal mode="exam" />}
            </div>
          ))}
        </>
      )}

      <div className="row wrap section-head">
        <h2>Multiple-choice review</h2>
        <label className="check"><input type="checkbox" checked={onlyWrong} onChange={(e) => setOnlyWrong(e.target.checked)} /> Only questions I got wrong</label>
      </div>
      {review.length === 0 && <div className="card empty"><p>Nothing to review. Perfect run.</p></div>}
      {review.map((q) => (
        <Question key={q.id} q={q} picked={run.answers[q.id] ?? null} reveal onPick={() => {}} header={<span>Question {items.findIndex((x) => x.id === q.id) + 1}</span>} />
      ))}
    </section>
  )
}
