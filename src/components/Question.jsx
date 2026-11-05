import { objectiveById } from '../data/objectives.js'

const LETTERS = ['A', 'B', 'C', 'D']

// One question. `picked` is the chosen index or null. `reveal` shows right/wrong colouring and the explanation.
export default function Question({ q, picked, reveal, onPick, header }) {
  const o = objectiveById(q.objective)
  return (
    <div className="card question-card">
      <p className="q-meta">{header}<span className="tag">{o.id} {o.title}</span></p>
      <h2 className="question">{q.question}</h2>
      {q.exhibit && <pre className="exhibit" tabIndex={0} aria-label="Exhibit">{q.exhibit}</pre>}
      <div className="options" role="radiogroup">
        {q.options.map((opt, i) => {
          let state = ''
          if (reveal && i === q.answer) state = 'correct'
          else if (reveal && picked === i) state = 'wrong'
          else if (!reveal && picked === i) state = 'chosen'
          return (
            <button key={i} role="radio" aria-checked={picked === i} className={state} disabled={reveal} onClick={() => onPick(i)}>
              <span className="letter">{LETTERS[i]}</span>
              <span>{opt}</span>
            </button>
          )
        })}
      </div>
      {reveal && (
        <div className={`feedback ${picked === q.answer ? 'good' : 'bad'}`}>
          <p><strong>{picked === q.answer ? 'Correct.' : picked === null ? `Answer: ${LETTERS[q.answer]}.` : `Not quite. The answer is ${LETTERS[q.answer]}.`}</strong> {q.explanation}</p>
        </div>
      )}
    </div>
  )
}
