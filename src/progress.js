import { useMemo } from 'react'
import { OBJECTIVES, DOMAINS } from './data/objectives.js'
import { QUESTIONS } from './data/questions.js'
import { TERMS } from './data/terms.js'
import { useStored } from './hooks/useStored.js'

export const KEYS = {
  theme: 'cysa.theme', // 'light' | 'dark' | 'system'
  studied: 'cysa.studied', // { '1.1': true }
  quizStats: 'cysa.quizStats', // { [questionId]: { right, wrong, last: 'right' | 'wrong' } }
  cards: 'cysa.cards', // { [term]: 'known' | 'again' }
  examDate: 'cysa.examDate', // 'YYYY-MM-DD'
  exams: 'cysa.exams', // [{ at, right, total, byDomain: { d1: [right, total] }, pbq? }]
  labs: 'cysa.labs', // { [labId]: { best, last, at } } (draft answers live in cysa.lab.<id>)
}

// A filter value is 'all', a domain id ('d2') or an objective id ('2.3')
export function matches(filter, objectiveId) {
  if (!filter || filter === 'all') return true
  if (filter.startsWith('d')) return OBJECTIVES.find((o) => o.id === objectiveId)?.domain === filter
  return filter === objectiveId
}

export function objectiveStats(objId, stats) {
  const qs = QUESTIONS.filter((q) => q.objective === objId)
  const answered = qs.filter((q) => stats[q.id])
  const right = answered.filter((q) => stats[q.id].last === 'right').length
  return { total: qs.length, answered: answered.length, right, acc: answered.length ? right / answered.length : null }
}

export function useProgress() {
  const [studied, setStudied] = useStored(KEYS.studied, {})
  const [stats] = useStored(KEYS.quizStats, {})
  const [cards] = useStored(KEYS.cards, {})

  return useMemo(() => {
    const byObjective = Object.fromEntries(OBJECTIVES.map((o) => {
      const s = objectiveStats(o.id, stats)
      const terms = TERMS.filter((t) => t.objective === o.id)
      const known = terms.filter((t) => cards[t.term] === 'known').length
      return [o.id, { ...s, studied: !!studied[o.id], terms: terms.length, known }]
    }))
    const byDomain = Object.fromEntries(DOMAINS.map((d) => {
      const objs = OBJECTIVES.filter((o) => o.domain === d.id).map((o) => byObjective[o.id])
      const sum = (k) => objs.reduce((n, x) => n + x[k], 0)
      const answered = sum('answered')
      return [d.id, {
        objectives: objs.length,
        studied: objs.filter((x) => x.studied).length,
        total: sum('total'),
        answered,
        right: sum('right'),
        acc: answered ? sum('right') / answered : null,
        terms: sum('terms'),
        known: sum('known'),
      }]
    }))
    const toggleStudied = (id) => setStudied({ ...studied, [id]: !studied[id] })
    return { byObjective, byDomain, studied, toggleStudied }
  }, [studied, stats, cards, setStudied])
}

export function shuffle(list) {
  const a = [...list]
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1))
    ;[a[i], a[j]] = [a[j], a[i]]
  }
  return a
}

export const pct = (x) => (x === null || x === undefined ? '–' : `${Math.round(x * 100)}%`)
