// node scripts/validate-labs.mjs  - checks every lab's structure, answer keys and terminal commands
import { LABS } from '../src/data/labs/index.js'
import { OBJECTIVES } from '../src/data/objectives.js'
import { validateLab } from '../src/lib/grade.js'
import { Shell } from '../src/lib/shell.js'

const objIds = new Set(OBJECTIVES.map((o) => o.id))
let problems = 0
const seen = new Set()
for (const lab of LABS) {
  const errs = validateLab(lab, Shell)
  if (seen.has(lab.id)) errs.push(`${lab.id}: duplicate lab id`)
  seen.add(lab.id)
  for (const o of lab.objectives ?? []) if (!objIds.has(o)) errs.push(`${lab.id}: unknown objective ${o}`)
  for (const h of lab.hints ?? []) {
    const r = new Shell(lab.files ?? {}, { extra: lab.extra }).run(h)
    if (r.err) errs.push(`${lab.id}: hint fails: ${h} -> ${r.err}`)
  }
  problems += errs.length
  console.log(`${errs.length ? 'FAIL' : 'ok  '} ${lab.id} (${lab.tasks.length} tasks${lab.files ? ', terminal' : ''})`)
  for (const e of errs) console.log('     ' + e)
}
console.log(`${LABS.length} labs, ${problems} problem(s)`)
process.exit(problems ? 1 : 0)
