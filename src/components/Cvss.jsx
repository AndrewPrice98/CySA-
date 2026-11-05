import { useState } from 'react'
import { METRICS, DEFAULT, score, severity, toVector, parseVector, randomMetrics } from '../lib/cvss.js'

const SEVERITIES = ['None', 'Low', 'Medium', 'High', 'Critical']
const RANGES = { None: '0.0', Low: '0.1–3.9', Medium: '4.0–6.9', High: '7.0–8.9', Critical: '9.0–10.0' }

export default function Cvss() {
  const [m, setM] = useState(DEFAULT)
  const [paste, setPaste] = useState('')
  const [pasteError, setPasteError] = useState(false)
  const [copied, setCopied] = useState(false)
  const s = score(m)
  const sev = severity(s.base)
  const vector = toVector(m)

  function load(e) {
    e.preventDefault()
    const parsed = parseVector(paste)
    setPasteError(!parsed)
    if (parsed) setM(parsed)
  }

  async function copy() {
    try {
      await navigator.clipboard.writeText(vector)
      setCopied(true)
      setTimeout(() => setCopied(false), 1500)
    } catch {
      // clipboard blocked: the vector is selectable text anyway
    }
  }

  return (
    <section>
      <h1>CVSS v3.1 calculator</h1>
      <p className="lede">Objective 2.3 expects you to read a vector string and know what drives the score. Click through the metrics, or paste a vector from a scan report.</p>

      <div className="cvss-layout">
        <div className="cvss-metrics">
          <form className="row paste" onSubmit={load}>
            <label className="field grow">
              <span>Paste a vector</span>
              <input value={paste} onChange={(e) => setPaste(e.target.value)} placeholder="CVSS:3.1/AV:N/AC:L/PR:N/UI:N/S:U/C:H/I:H/A:H" aria-invalid={pasteError} />
            </label>
            <button className="btn ghost" type="submit">Load</button>
          </form>
          {pasteError && <p className="error-text">That isn't a complete v3.x base vector. It needs all eight: AV, AC, PR, UI, S, C, I, A.</p>}

          {METRICS.map((metric) => {
            const current = metric.values.find((v) => v.v === m[metric.key])
            return (
              <fieldset key={metric.key} className="metric">
                <legend><strong>{metric.name}</strong> <code>{metric.key}</code> <span className="muted">{metric.help}</span></legend>
                <div className="segmented">
                  {metric.values.map((v) => (
                    <button key={v.v} type="button" className={m[metric.key] === v.v ? 'active' : ''} aria-pressed={m[metric.key] === v.v} onClick={() => setM({ ...m, [metric.key]: v.v })}>
                      {v.label} <span className="code-hint">{v.v}</span>
                    </button>
                  ))}
                </div>
                <p className="fine">{current.help}</p>
              </fieldset>
            )
          })}
        </div>

        <aside className="cvss-score">
          <div className={`score-box sev-${sev.toLowerCase()}`}>
            <span className="score-num">{s.base.toFixed(1)}</span>
            <span className="score-sev">{sev}</span>
          </div>
          <code className="vector" onClick={copy} title="Copy">{vector}</code>
          <button className="btn ghost small" onClick={copy}>{copied ? 'Copied' : 'Copy vector'}</button>
          <dl className="sub-scores">
            <div><dt>Exploitability</dt><dd>{s.exploitability.toFixed(1)}</dd></div>
            <div><dt>Impact</dt><dd>{s.impact.toFixed(1)}</dd></div>
          </dl>
          <table className="table sev-table">
            <tbody>
              {SEVERITIES.map((x) => (
                <tr key={x} className={x === sev ? 'on' : ''}><td><span className={`sev-dot sev-${x.toLowerCase()}`} />{x}</td><td>{RANGES[x]}</td></tr>
              ))}
            </tbody>
          </table>
          <p className="fine">If C, I and A are all None the score is 0.0 however easy the exploit is. Scope Changed multiplies the result by 1.08 and raises PR weights.</p>
        </aside>
      </div>

      <SeverityDrill />
    </section>
  )
}

// Read a random vector and call the severity: the skill the exam actually tests
function SeverityDrill() {
  const [m, setM] = useState(randomMetrics)
  const [guess, setGuess] = useState(null)
  const [tally, setTally] = useState({ right: 0, total: 0 })
  const sev = severity(score(m).base)

  function answer(g) {
    if (guess) return
    setGuess(g)
    setTally((t) => ({ right: t.right + (g === sev ? 1 : 0), total: t.total + 1 }))
  }

  return (
    <div className="card drill">
      <h2>Drill: call the severity</h2>
      <p className="muted">Read the vector, pick a rating. {tally.total > 0 && <>{tally.right} / {tally.total} so far.</>}</p>
      <code className="vector big">{toVector(m)}</code>
      <div className="segmented sev-choices">
        {SEVERITIES.map((x) => (
          <button key={x} className={guess ? (x === sev ? 'correct' : x === guess ? 'wrong' : '') : ''} disabled={!!guess} onClick={() => answer(x)}>{x}</button>
        ))}
      </div>
      {guess && (
        <div className="row wrap">
          <p><strong>{guess === sev ? 'Right.' : 'Not quite.'}</strong> {score(m).base.toFixed(1)} = {sev}.</p>
          <button className="btn" onClick={() => { setM(randomMetrics()); setGuess(null) }} autoFocus>Next vector</button>
        </div>
      )}
    </div>
  )
}
