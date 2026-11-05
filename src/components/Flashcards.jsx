import { useEffect, useMemo, useState } from 'react'
import { TERMS } from '../data/terms.js'
import { objectiveById } from '../data/objectives.js'
import { useStored } from '../hooks/useStored.js'
import { KEYS, matches, shuffle } from '../progress.js'
import { ScopeSelect } from './common.jsx'

export default function Flashcards({ params }) {
  const [filter, setFilter] = useState(params.f ?? 'all')
  const [view, setView] = useState('cards')
  const [learningOnly, setLearningOnly] = useState(false)
  const [shuffled, setShuffled] = useState(true)
  const [seed, setSeed] = useState(0)
  const [index, setIndex] = useState(0)
  const [flipped, setFlipped] = useState(false)
  const [search, setSearch] = useState('')
  const [marks, setMarks] = useStored(KEYS.cards, {})

  const deck = useMemo(() => {
    const list = TERMS.filter((t) => matches(filter, t.objective)).filter((t) => !learningOnly || marks[t.term] !== 'known')
    return shuffled ? shuffle(list) : [...list].sort((a, b) => a.term.localeCompare(b.term))
    // marks left out: marking a card must not reorder the deck mid-run
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filter, learningOnly, shuffled, seed])

  const card = deck[index]
  const scoped = TERMS.filter((t) => matches(filter, t.objective))
  const known = scoped.filter((t) => marks[t.term] === 'known').length

  function reset(fn) {
    fn?.()
    setIndex(0)
    setFlipped(false)
    setSeed((s) => s + 1)
  }
  const step = (n) => {
    setFlipped(false)
    setIndex((i) => i + n)
  }
  const mark = (value) => {
    setMarks({ ...marks, [card.term]: value })
    step(1)
  }

  useEffect(() => {
    if (view !== 'cards') return
    const onKey = (e) => {
      if (e.target.closest('input, select, textarea') || !card) return
      if (e.key === ' ') { e.preventDefault(); setFlipped((f) => !f) }
      else if (e.key === 'ArrowRight') step(1)
      else if (e.key === 'ArrowLeft' && index > 0) step(-1)
      else if (e.key === '1') mark('again')
      else if (e.key === '2') mark('known')
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  })

  const listed = TERMS.filter((t) => matches(filter, t.objective))
    .filter((t) => !search || `${t.term} ${t.definition}`.toLowerCase().includes(search.toLowerCase()))
    .sort((a, b) => a.term.localeCompare(b.term))

  return (
    <section>
      <h1>Flashcards</h1>
      <p className="lede">Flip with <kbd>Space</kbd>. Mark <kbd>1</kbd> "Again" or <kbd>2</kbd> "Got it", then filter to the cards you're still learning.</p>

      <div className="toolbar">
        <ScopeSelect value={filter} items={TERMS} onChange={(v) => reset(() => setFilter(v))} />
        <div className="segmented" role="group" aria-label="View">
          {[['cards', 'Cards'], ['list', 'Glossary']].map(([k, label]) => (
            <button key={k} className={view === k ? 'active' : ''} aria-pressed={view === k} onClick={() => setView(k)}>{label}</button>
          ))}
        </div>
      </div>

      {view === 'cards' && (
        <>
          <div className="row wrap toolbar sub">
            <label className="check"><input type="checkbox" checked={learningOnly} onChange={(e) => reset(() => setLearningOnly(e.target.checked))} /> Still learning only ({scoped.length - known})</label>
            <label className="check"><input type="checkbox" checked={shuffled} onChange={(e) => reset(() => setShuffled(e.target.checked))} /> Shuffle</label>
            <span className="spacer" />
            <span className="fine">{known} of {scoped.length} known</span>
          </div>

          {card ? (
            <>
              <button className={`flashcard ${flipped ? 'flipped' : ''}`} onClick={() => setFlipped(!flipped)} aria-label={flipped ? 'Show term' : 'Show definition'}>
                {flipped ? (
                  <span className="fc-back">
                    <span className="fc-term-small">{card.term}</span>
                    <span>{card.definition}</span>
                    <span className="fine">Objective {card.objective} · {objectiveById(card.objective)?.title}</span>
                  </span>
                ) : (
                  <span className="fc-front">
                    <span className="fc-term">{card.term}</span>
                    {marks[card.term] && <span className={`pill ${marks[card.term]}`}>{marks[card.term] === 'known' ? 'Got it' : 'Learning'}</span>}
                  </span>
                )}
              </button>
              <div className="row wrap fc-controls">
                <button className="btn ghost" disabled={index === 0} onClick={() => step(-1)}>←</button>
                <span className="fine">{index + 1} / {deck.length}</span>
                <span className="spacer" />
                <button className="btn ghost danger" onClick={() => mark('again')}>Again</button>
                <button className="btn good" onClick={() => mark('known')}>Got it</button>
              </div>
            </>
          ) : (
            <div className="card empty">
              <p>{deck.length ? 'End of the deck.' : learningOnly ? 'You know every card here.' : 'No cards for this topic.'}</p>
              <button className="btn" onClick={() => reset()}>Start over</button>
            </div>
          )}
        </>
      )}

      {view === 'list' && (
        <>
          <label className="field search">
            <span className="sr-only">Search terms</span>
            <input type="search" placeholder={`Search ${listed.length} terms…`} value={search} onChange={(e) => setSearch(e.target.value)} />
          </label>
          <dl className="glossary">
            {listed.map((t) => (
              <div key={t.term}>
                <dt>{t.term} <span className="tag">{t.objective}</span></dt>
                <dd>{t.definition}</dd>
              </div>
            ))}
          </dl>
          {listed.length === 0 && <p className="muted">No matches.</p>}
        </>
      )}
    </section>
  )
}
