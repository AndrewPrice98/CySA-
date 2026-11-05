// PBQ grading. Pure functions so labs can be validated from Node.
// Every task scores 0..1 with partial credit, like CompTIA PBQs.
//
// Task shapes (all have id, type, prompt, explain):
//   input  { answer: string | string[] }                  typed answer; any listed form is accepted
//   single { options: string[], answer: number }
//   multi  { options: string[], answer: number[] }         select all that apply
//   lines  { artifact: id, answer: number[] }              click the lines (0-based) in an artifact
//   order  { items: string[] }                             items listed in the CORRECT order; shown shuffled
//   grid   { columns: [{ key, label, options }], rows: [{ label, answer: { key: value } }] }   match / classify / configure

export const norm = (s) => String(s ?? '').trim().toLowerCase().replace(/\s+/g, ' ').replace(/^["']|["']$/g, '')

function setScore(picked = [], answer = []) {
  const want = new Set(answer)
  const got = new Set(picked)
  const right = [...got].filter((x) => want.has(x)).length
  const wrong = got.size - right
  return Math.max(0, (right - wrong) / want.size)
}

export function scoreTask(task, value) {
  switch (task.type) {
    case 'input': {
      const accepted = (Array.isArray(task.answer) ? task.answer : [task.answer]).map(norm)
      return accepted.includes(norm(value)) ? 1 : 0
    }
    case 'single':
      return value === task.answer ? 1 : 0
    case 'multi':
    case 'lines':
      return setScore(value, task.answer)
    case 'order': {
      if (!Array.isArray(value)) return 0
      return value.filter((item, i) => item === task.items[i]).length / task.items.length
    }
    case 'grid': {
      let right = 0
      let total = 0
      task.rows.forEach((row, r) => {
        for (const col of task.columns) {
          if (row.answer[col.key] === undefined) continue
          total++
          if (value?.[r]?.[col.key] === row.answer[col.key]) right++
        }
      })
      return total ? right / total : 0
    }
    default:
      return 0
  }
}

export function scoreLab(lab, answers = {}) {
  const per = lab.tasks.map((t) => scoreTask(t, answers[t.id]))
  return { per, total: per.reduce((a, b) => a + b, 0) / per.length }
}

// The fully-correct answer for each task, used by "Show solution" and by lab validation
export function solution(task) {
  switch (task.type) {
    case 'input': return Array.isArray(task.answer) ? task.answer[0] : task.answer
    case 'order': return [...task.items]
    case 'grid': return task.rows.map((r) => ({ ...r.answer }))
    default: return task.answer
  }
}

// Deterministic shuffle so an order task looks the same on every render and reload
export function seededShuffle(list, seed) {
  let h = 2166136261
  for (const c of seed) h = Math.imul(h ^ c.charCodeAt(0), 16777619)
  const rand = () => {
    h ^= h << 13; h ^= h >>> 17; h ^= h << 5
    return ((h >>> 0) % 100000) / 100000
  }
  const a = [...list]
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(rand() * (i + 1))
    ;[a[i], a[j]] = [a[j], a[i]]
  }
  // Never start an ordering task already solved
  if (a.every((x, i) => x === list[i]) && a.length > 1) a.push(a.shift())
  return a
}

// Structural checks for a lab definition. Returns a list of problems (empty = OK).
export function validateLab(lab, Shell) {
  const errs = []
  const contentOf = (a) => a.content ?? lab.files?.[a.file]
  for (const a of lab.artifacts ?? []) if (typeof contentOf(a) !== 'string') errs.push(`${lab.id}: artifact ${a.id} has no content (file ${a.file} missing?)`)
  const where = (t) => `${lab.id}/${t.id}`
  if (!lab.id || !lab.title || !lab.scenario || !Array.isArray(lab.tasks) || !lab.tasks.length) errs.push(`${lab.id}: missing id/title/scenario/tasks`)
  const artifactIds = new Set((lab.artifacts ?? []).map((a) => a.id))
  const ids = new Set()
  for (const t of lab.tasks ?? []) {
    if (ids.has(t.id)) errs.push(`${where(t)}: duplicate task id`)
    ids.add(t.id)
    if (!t.prompt || !t.explain) errs.push(`${where(t)}: needs prompt and explain`)
    if (t.type === 'single' && !(t.answer >= 0 && t.answer < t.options?.length)) errs.push(`${where(t)}: bad single answer`)
    if (t.type === 'multi' && !(t.answer?.length && t.answer.every((i) => i >= 0 && i < t.options.length))) errs.push(`${where(t)}: bad multi answer`)
    if (t.type === 'lines') {
      const art = (lab.artifacts ?? []).find((a) => a.id === t.artifact)
      if (!art) errs.push(`${where(t)}: artifact ${t.artifact} not found`)
      else {
        const n = (contentOf(art) ?? '').replace(/\n$/, '').split('\n').length
        if (!t.answer?.length || t.answer.some((i) => i < 0 || i >= n)) errs.push(`${where(t)}: line index out of range (artifact has ${n} lines)`)
      }
    }
    if (t.type === 'grid') {
      for (const r of t.rows ?? []) for (const [k, v] of Object.entries(r.answer ?? {})) {
        const col = t.columns.find((c) => c.key === k)
        if (!col) errs.push(`${where(t)}: unknown column ${k}`)
        else if (!col.options.includes(v)) errs.push(`${where(t)}: "${v}" is not an option in column ${k}`)
      }
    }
    if (t.type === 'order' && !(t.items?.length > 1)) errs.push(`${where(t)}: order needs 2+ items`)
    if (t.type === 'input' && !t.answer) errs.push(`${where(t)}: input needs answer`)
    if (!['input', 'single', 'multi', 'lines', 'order', 'grid'].includes(t.type)) errs.push(`${where(t)}: unknown type ${t.type}`)
    if (t.type === 'lines' && !artifactIds.has(t.artifact)) errs.push(`${where(t)}: lines task must reference an artifact`)
    // Terminal tasks: the command that finds the answer must actually print it
    if (t.cmd) {
      if (!Shell || !lab.files) errs.push(`${where(t)}: has cmd but lab has no files`)
      else {
        const r = new Shell(lab.files, { extra: lab.extra }).run(t.cmd)
        const want = String(solution(t))
        if (r.err) errs.push(`${where(t)}: cmd failed: ${r.err}`)
        else if (!r.out.includes(want)) errs.push(`${where(t)}: cmd output does not contain "${want}". Output was:
${r.out.slice(0, 400)}`)
      }
    }
    const full = scoreTask(t, solution(t))
    if (full !== 1) errs.push(`${where(t)}: solution scores ${full}, expected 1`)
  }
  return errs
}
