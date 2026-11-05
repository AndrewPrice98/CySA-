import { useMemo, useRef, useState } from 'react'
import { Shell } from '../../lib/shell.js'
import { scoreLab, seededShuffle } from '../../lib/grade.js'
import { objectiveById } from '../../data/objectives.js'
import Terminal from './Terminal.jsx'
import { Task } from './Tasks.jsx'

// Order tasks the learner never touched are graded in the order they were shown
export function effectiveAnswers(lab, answers = {}) {
  const out = { ...answers }
  for (const t of lab.tasks) if (t.type === 'order' && !out[t.id]) out[t.id] = seededShuffle(t.items, `${lab.id}/${t.id}`)
  return out
}

export const gradeLab = (lab, answers) => scoreLab(lab, effectiveAnswers(lab, answers))

// The PBQ workspace: evidence (artifacts + terminal) on the left, tasks on the right.
// mode 'practice' shows Check / Solution buttons; mode 'exam' hides them (the exam grades at submit).
export default function LabRunner({ lab, answers, setAnswers, checked = null, reveal = false, mode = 'practice', toolbar }) {
  const shellRef = useRef(null)
  if (lab.files && !shellRef.current) shellRef.current = new Shell(lab.files, { extra: lab.extra })
  const tabs = useMemo(() => [
    ...(lab.files ? [{ id: '__term', title: 'Terminal' }] : []),
    ...lab.artifacts.map((a) => ({ id: a.id, title: a.title })),
  ], [lab])
  const [tab, setTab] = useState(tabs[0]?.id)
  const [showHints, setShowHints] = useState(false)
  const art = lab.artifacts.find((a) => a.id === tab)
  const artText = art ? art.content ?? lab.files?.[art.file] ?? '' : ''

  const intro = `CySA+ lab shell. Evidence for this case:\n${Object.keys(lab.files ?? {}).map((f) => `  ${f}`).join('\n')}\nType "help" for commands. Tab completes paths, ↑ recalls history.`

  return (
    <div className="lab">
      <div className="lab-brief card">
        <p className="kicker">PBQ · {lab.objectives.map((o) => `${o} ${objectiveById(o)?.title.split(' ').slice(0, 4).join(' ')}…`).join(' · ')}</p>
        <p className="scenario">{lab.scenario}</p>
        {toolbar}
      </div>

      <div className="lab-panes">
        <div className="evidence">
          <div className="ev-tabs" role="tablist" aria-label="Evidence">
            {tabs.map((t) => (
              <button key={t.id} role="tab" aria-selected={tab === t.id} className={tab === t.id ? 'active' : ''} onClick={() => setTab(t.id)}>
                {t.id === '__term' ? '>_ Terminal' : t.title}
              </button>
            ))}
          </div>
          {/* Terminal stays mounted so its history survives tab switches */}
          {lab.files && (
            <div hidden={tab !== '__term'} className="ev-body">
              <Terminal shell={shellRef.current} intro={intro} />
              {lab.hints?.length > 0 && mode === 'practice' && (
                <div className="hints">
                  <button className="linkish small" onClick={() => setShowHints(!showHints)}>{showHints ? 'Hide' : 'Stuck? Show'} starter commands</button>
                  {showHints && <ul>{lab.hints.map((h) => <li key={h}><code>{h}</code></li>)}</ul>}
                </div>
              )}
            </div>
          )}
          {art && (
            <div className="ev-body">
              <pre className="artifact" tabIndex={0}>{artText}</pre>
            </div>
          )}
        </div>

        <div className="tasks">
          {lab.tasks.map((t, i) => (
            <Task
              key={t.id}
              lab={lab}
              task={t}
              n={i + 1}
              value={answers[t.id]}
              onChange={(v) => setAnswers({ ...answers, [t.id]: v })}
              graded={checked ? checked.per[i] : null}
              reveal={reveal}
            />
          ))}
        </div>
      </div>
    </div>
  )
}
