import { useState } from 'react'
import { seededShuffle, solution } from '../../lib/grade.js'
import { Rich } from '../common.jsx'

const pctLabel = (s) => `${Math.round(s * 100)}%`

// One graded task. `graded` is null until "Check answers"; then it's the 0..1 score.
export function Task({ lab, task, n, value, onChange, graded, reveal }) {
  const Body = BODIES[task.type]
  const state = graded === null || graded === undefined ? '' : graded === 1 ? 'right' : graded > 0 ? 'partial' : 'wrong'
  return (
    <section className={`task ${state}`} aria-labelledby={`task-${task.id}`}>
      <header className="task-head">
        <span className="task-n">{n}</span>
        <h3 id={`task-${task.id}`}><Rich text={task.prompt} /></h3>
        {state && <span className={`task-score ${state}`}>{pctLabel(graded)}</span>}
      </header>
      <Body lab={lab} task={task} value={value} onChange={onChange} checked={graded !== null && graded !== undefined} reveal={reveal} />
      {(state || reveal) && (
        <div className="task-explain">
          {reveal && <SolutionLine task={task} />}
          <p><Rich text={task.explain} /></p>
          {task.cmd && <p className="fine">Found with: <code>{task.cmd}</code></p>}
        </div>
      )}
    </section>
  )
}

function SolutionLine({ task }) {
  const sol = solution(task)
  if (task.type === 'input') return <p><strong>Answer:</strong> <code>{sol}</code></p>
  if (task.type === 'single') return <p><strong>Answer:</strong> {task.options[sol]}</p>
  if (task.type === 'multi') return <p><strong>Answer:</strong> {sol.map((i) => task.options[i]).join('; ')}</p>
  return null
}

function InputBody({ task, value, onChange, checked }) {
  return (
    <input
      className={`task-input ${checked ? 'locked' : ''}`}
      value={value ?? ''}
      onChange={(e) => onChange(e.target.value)}
      placeholder={task.placeholder ?? 'Type your answer'}
      spellCheck={false}
      autoComplete="off"
      aria-label="Answer"
    />
  )
}

function SingleBody({ task, value, onChange, checked, reveal }) {
  return (
    <div className="choice-list" role="radiogroup">
      {task.options.map((o, i) => {
        const mark = (checked || reveal) ? (i === task.answer ? 'correct' : value === i ? 'wrong' : '') : value === i ? 'chosen' : ''
        return (
          <label key={i} className={`choice ${mark}`}>
            <input type="radio" name={task.id} checked={value === i} onChange={() => onChange(i)} />
            <span>{o}</span>
          </label>
        )
      })}
    </div>
  )
}

function MultiBody({ task, value = [], onChange, checked, reveal }) {
  const toggle = (i) => onChange(value.includes(i) ? value.filter((x) => x !== i) : [...value, i].sort((a, b) => a - b))
  return (
    <div className="choice-list">
      <p className="fine">Select all that apply.</p>
      {task.options.map((o, i) => {
        const want = task.answer.includes(i)
        const got = value.includes(i)
        const mark = (checked || reveal) ? (want ? (got || reveal ? 'correct' : 'missed') : got ? 'wrong' : '') : got ? 'chosen' : ''
        return (
          <label key={i} className={`choice ${mark}`}>
            <input type="checkbox" checked={got} onChange={() => toggle(i)} />
            <span>{o}</span>
          </label>
        )
      })}
    </div>
  )
}

function LinesBody({ lab, task, value = [], onChange, checked, reveal }) {
  const art = lab.artifacts.find((a) => a.id === task.artifact)
  const text = art.content ?? lab.files?.[art.file] ?? ''
  const ls = text.replace(/\n$/, '').split('\n')
  const toggle = (i) => onChange(value.includes(i) ? value.filter((x) => x !== i) : [...value, i].sort((a, b) => a - b))
  return (
    <div className="line-pick" role="group" aria-label={`Lines of ${art.title}`}>
      <p className="fine">Click lines to select them. Source: {art.title}</p>
      <div className="line-scroll">
        {ls.map((l, i) => {
          const want = task.answer.includes(i)
          const got = value.includes(i)
          const mark = (checked || reveal) ? (want ? (got || reveal ? 'correct' : 'missed') : got ? 'wrong' : '') : got ? 'chosen' : ''
          return (
            <button key={i} type="button" className={`pick-line ${mark}`} aria-pressed={got} onClick={() => toggle(i)}>
              <span className="ln">{i + 1}</span>
              <span className="lt">{l || ' '}</span>
            </button>
          )
        })}
      </div>
    </div>
  )
}

function OrderBody({ lab, task, value, onChange, checked, reveal }) {
  const current = value ?? seededShuffle(task.items, `${lab.id}/${task.id}`)
  const [drag, setDrag] = useState(null)
  const move = (from, to) => {
    if (to < 0 || to >= current.length || from === to) return
    const next = [...current]
    const [x] = next.splice(from, 1)
    next.splice(to, 0, x)
    onChange(next)
  }
  return (
    <div>
      <p className="fine">Drag the steps, or use the arrows.</p>
      <ol className="order-list">
        {current.map((item, i) => {
          const mark = checked || reveal ? (item === task.items[i] ? 'correct' : 'wrong') : ''
          return (
            <li
              key={item}
              className={`order-item ${mark} ${drag === i ? 'dragging' : ''}`}
              draggable
              onDragStart={() => setDrag(i)}
              onDragOver={(e) => e.preventDefault()}
              onDrop={() => { move(drag, i); setDrag(null) }}
              onDragEnd={() => setDrag(null)}
            >
              <span className="grip" aria-hidden="true">⋮⋮</span>
              <span className="order-text">{item}</span>
              <span className="order-btns">
                <button type="button" aria-label={`Move "${item}" up`} disabled={i === 0} onClick={() => move(i, i - 1)}>↑</button>
                <button type="button" aria-label={`Move "${item}" down`} disabled={i === current.length - 1} onClick={() => move(i, i + 1)}>↓</button>
              </span>
            </li>
          )
        })}
      </ol>
      {reveal && (
        <div className="fine">
          <strong>Correct order:</strong>
          <ol className="solution-list">{task.items.map((x) => <li key={x}>{x}</li>)}</ol>
        </div>
      )}
    </div>
  )
}

function GridBody({ task, value = [], onChange, checked, reveal }) {
  const set = (r, key, v) => {
    const next = task.rows.map((_, i) => ({ ...(value[i] ?? {}) }))
    next[r][key] = v
    onChange(next)
  }
  return (
    <div className="grid-wrap">
      <table className="pbq-grid">
        <thead>
          <tr><th scope="col">Item</th>{task.columns.map((c) => <th key={c.key} scope="col">{c.label}</th>)}</tr>
        </thead>
        <tbody>
          {task.rows.map((row, r) => (
            <tr key={r}>
              <th scope="row"><Rich text={row.label} /></th>
              {task.columns.map((c) => {
                const v = value[r]?.[c.key] ?? ''
                const want = row.answer[c.key]
                const mark = want === undefined ? '' : (checked || reveal) ? (v === want ? 'correct' : 'wrong') : ''
                return (
                  <td key={c.key} className={mark}>
                    {want === undefined && !c.options.length ? null : (
                      <select value={v} onChange={(e) => set(r, c.key, e.target.value)} aria-label={`${c.label} for ${row.label}`}>
                        <option value="">Choose…</option>
                        {c.options.map((o) => <option key={o} value={o}>{o}</option>)}
                      </select>
                    )}
                    {(checked || reveal) && want !== undefined && v !== want && <span className="should-be">{want}</span>}
                  </td>
                )
              })}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

const BODIES = { input: InputBody, single: SingleBody, multi: MultiBody, lines: LinesBody, order: OrderBody, grid: GridBody }
