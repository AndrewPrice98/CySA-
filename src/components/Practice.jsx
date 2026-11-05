import { useEffect, useMemo, useState } from 'react'
import { navigate } from '../App.jsx'
import { QUESTIONS } from '../data/questions.js'
import { useStored } from '../hooks/useStored.js'
import { KEYS, matches, shuffle, pct } from '../progress.js'
import { ScopeSelect, scopeLabel } from './common.jsx'
import Question from './Question.jsx'

const MODES = [
  ['all', 'All'],
  ['new', 'Not tried yet'],
  ['missed', 'Missed last time'],
]

export function recordAnswer(stats, q, correct) {
  const prev = stats[q.id] ?? { right: 0, wrong: 0 }
  return { ...stats, [q.id]: { right: prev.right + (correct ? 1 : 0), wrong: prev.wrong + (correct ? 0 : 1), last: correct ? 'right' : 'wrong' } }
}

export default function Practice({ params }) {
  const [filter, setFilter] = useState(params.f ?? 'all')
  const [mode, setMode] = useState('all')
  const [stats, setStats] = useStored(KEYS.quizStats, {})
  const [seed, setSeed] = useState(0)
  const [index, setIndex] = useState(0)
  const [picked, setPicked] = useState(null)
  const [score, setScore] = useState({ right: 0, answered: 0 })

  const deck = useMemo(() => {
    const list = QUESTIONS.filter((q) => matches(filter, q.objective)).filter((q) => {
      if (mode === 'new') return !stats[q.id]
      if (mode === 'missed') return stats[q.id]?.last === 'wrong'
      return true
    })
    return shuffle(list)
    // stats left out on purpose: answering must not reshuffle the run
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filter, mode, seed])

  const q = deck[index]
  const finished = deck.length > 0 && index >= deck.length

  function restart(change = {}) {
    if (change.filter !== undefined) setFilter(change.filter)
    if (change.mode !== undefined) setMode(change.mode)
    setSeed((s) => s + 1)
    setIndex(0)
    setPicked(null)
    setScore({ right: 0, answered: 0 })
  }

  function pick(i) {
    if (picked !== null || !q) return
    const correct = i === q.answer
    setPicked(i)
    setScore((s) => ({ right: s.right + (correct ? 1 : 0), answered: s.answered + 1 }))
    setStats(recordAnswer(stats, q, correct))
  }

  function next() {
    setPicked(null)
    setIndex((i) => i + 1)
  }

  // Keys: 1-4 or A-D to answer, Enter / → for next
  useEffect(() => {
    const onKey = (e) => {
      if (e.target.closest('input, select, textarea') || e.metaKey || e.ctrlKey || e.altKey) return
      const k = e.key.toLowerCase()
      const n = '1234'.indexOf(k) >= 0 ? '1234'.indexOf(k) : 'abcd'.indexOf(k)
      if (picked === null && n >= 0 && q) pick(n)
      else if (picked !== null && (k === 'enter' || k === 'arrowright')) { e.preventDefault(); next() }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  })

  const missedCount = QUESTIONS.filter((x) => matches(filter, x.objective) && stats[x.id]?.last === 'wrong').length

  return (
    <section>
      <h1>Practice questions</h1>
      <p className="lede">Instant feedback with an explanation after every answer. Keys: <kbd>1</kbd>–<kbd>4</kbd> to answer, <kbd>Enter</kbd> for the next one.</p>

      <div className="toolbar">
        <ScopeSelect value={filter} items={QUESTIONS} onChange={(v) => restart({ filter: v })} />
        <div className="segmented" role="group" aria-label="Which questions">
          {MODES.map(([k, label]) => (
            <button key={k} className={mode === k ? 'active' : ''} aria-pressed={mode === k} onClick={() => restart({ mode: k })}>
              {label}{k === 'missed' ? ` (${missedCount})` : ''}
            </button>
          ))}
        </div>
        <button className="btn ghost" onClick={() => restart()}>Shuffle</button>
      </div>

      {deck.length === 0 && (
        <div className="card empty">
          <p>{mode === 'missed' ? 'Nothing missed in this topic. Nice.' : mode === 'new' ? 'You\'ve tried every question in this topic.' : 'No questions for this topic yet.'}</p>
          <button className="btn ghost" onClick={() => restart({ mode: 'all' })}>Show all questions</button>
        </div>
      )}

      {finished && (
        <div className="card result">
          <p className="kicker">Round complete · {scopeLabel(filter)}</p>
          <p className="big-num">{pct(score.right / Math.max(1, score.answered))}<small> ({score.right} of {score.answered})</small></p>
          <p className="muted">Aim for a steady 85% or better before moving on.</p>
          <div className="row wrap">
            <button className="btn" onClick={() => restart()}>Go again</button>
            {missedCount > 0 && <button className="btn ghost" onClick={() => restart({ mode: 'missed' })}>Retry the {missedCount} I missed</button>}
            {filter !== 'all' && !filter.startsWith('d') && <button className="btn ghost" onClick={() => navigate('guide', { o: filter })}>Re-read the notes</button>}
          </div>
        </div>
      )}

      {q && !finished && (
        <>
          <Question
            q={q}
            picked={picked}
            reveal={picked !== null}
            onPick={pick}
            header={<span>Question {index + 1} of {deck.length} · {score.right}/{score.answered} right</span>}
          />
          {picked !== null && (
            <div className="row next-row">
              <button className="btn" onClick={next} autoFocus>{index + 1 < deck.length ? 'Next question' : 'See results'}</button>
            </div>
          )}
        </>
      )}
    </section>
  )
}
