// CVSS v3.1 base score, implemented from the FIRST specification (section 7 and Appendix A).

export const METRICS = [
  {
    key: 'AV', name: 'Attack Vector',
    help: 'How close the attacker has to be.',
    values: [
      { v: 'N', label: 'Network', w: 0.85, help: 'Exploitable remotely across routed networks, e.g. the internet.' },
      { v: 'A', label: 'Adjacent', w: 0.62, help: 'Same shared physical or logical network: same subnet, Bluetooth, local Wi-Fi.' },
      { v: 'L', label: 'Local', w: 0.55, help: 'Needs local access or a user to open something (e.g. a malicious file).' },
      { v: 'P', label: 'Physical', w: 0.2, help: 'Must physically touch the device.' },
    ],
  },
  {
    key: 'AC', name: 'Attack Complexity',
    help: 'Conditions outside the attacker\'s control.',
    values: [
      { v: 'L', label: 'Low', w: 0.77, help: 'Works reliably, every time.' },
      { v: 'H', label: 'High', w: 0.44, help: 'Needs a race condition, specific config, or man-in-the-middle position.' },
    ],
  },
  {
    key: 'PR', name: 'Privileges Required',
    help: 'Access the attacker needs before exploiting.',
    values: [
      { v: 'N', label: 'None', w: 0.85, help: 'Unauthenticated.' },
      { v: 'L', label: 'Low', w: 0.62, wChanged: 0.68, help: 'A basic user account.' },
      { v: 'H', label: 'High', w: 0.27, wChanged: 0.5, help: 'Admin-level access.' },
    ],
  },
  {
    key: 'UI', name: 'User Interaction',
    help: 'Does a victim have to do something?',
    values: [
      { v: 'N', label: 'None', w: 0.85, help: 'No user action needed.' },
      { v: 'R', label: 'Required', w: 0.62, help: 'Someone must click a link, open a file, etc.' },
    ],
  },
  {
    key: 'S', name: 'Scope',
    help: 'Can it affect components beyond the vulnerable one?',
    values: [
      { v: 'U', label: 'Unchanged', help: 'Impact stays within the same security authority.' },
      { v: 'C', label: 'Changed', help: 'Breaks out, e.g. VM escape, or XSS hitting the user\'s browser.' },
    ],
  },
  {
    key: 'C', name: 'Confidentiality',
    help: 'Information disclosure.',
    values: [
      { v: 'H', label: 'High', w: 0.56, help: 'Total loss, or very sensitive data exposed.' },
      { v: 'L', label: 'Low', w: 0.22, help: 'Some data, limited control over what.' },
      { v: 'N', label: 'None', w: 0, help: 'No confidentiality impact.' },
    ],
  },
  {
    key: 'I', name: 'Integrity',
    help: 'Unauthorized modification.',
    values: [
      { v: 'H', label: 'High', w: 0.56, help: 'Can modify anything, or modifications are serious.' },
      { v: 'L', label: 'Low', w: 0.22, help: 'Limited modification.' },
      { v: 'N', label: 'None', w: 0, help: 'No integrity impact.' },
    ],
  },
  {
    key: 'A', name: 'Availability',
    help: 'Disruption of the service.',
    values: [
      { v: 'H', label: 'High', w: 0.56, help: 'Full denial of service.' },
      { v: 'L', label: 'Low', w: 0.22, help: 'Degraded performance or partial outage.' },
      { v: 'N', label: 'None', w: 0, help: 'No availability impact.' },
    ],
  },
]

export const DEFAULT = { AV: 'N', AC: 'L', PR: 'N', UI: 'N', S: 'U', C: 'H', I: 'H', A: 'H' }

// Spec Appendix A: round up to one decimal, avoiding floating point error
export function roundUp(x) {
  const i = Math.round(x * 100000)
  return i % 10000 === 0 ? i / 100000 : (Math.floor(i / 10000) + 1) / 10
}

const weight = (key, v, scopeChanged) => {
  const val = METRICS.find((m) => m.key === key).values.find((x) => x.v === v)
  return scopeChanged && val.wChanged !== undefined ? val.wChanged : val.w
}

export function score(m) {
  const changed = m.S === 'C'
  const iss = 1 - (1 - weight('C', m.C)) * (1 - weight('I', m.I)) * (1 - weight('A', m.A))
  const impact = changed ? 7.52 * (iss - 0.029) - 3.25 * Math.pow(iss - 0.02, 15) : 6.42 * iss
  const exploitability = 8.22 * weight('AV', m.AV) * weight('AC', m.AC) * weight('PR', m.PR, changed) * weight('UI', m.UI)
  let base = 0
  if (impact > 0) base = changed ? roundUp(Math.min(1.08 * (impact + exploitability), 10)) : roundUp(Math.min(impact + exploitability, 10))
  return { base, impact: Math.max(0, impact), exploitability, iss }
}

export function severity(s) {
  if (s === 0) return 'None'
  if (s < 4) return 'Low'
  if (s < 7) return 'Medium'
  if (s < 9) return 'High'
  return 'Critical'
}

export const toVector = (m) => 'CVSS:3.1/' + METRICS.map((x) => `${x.key}:${m[x.key]}`).join('/')

// Accepts "CVSS:3.1/AV:N/..." or "AV:N/AC:L/..." (3.0 prefix too). Returns null if any base metric is missing or invalid.
export function parseVector(text) {
  const out = {}
  for (const part of text.trim().split('/')) {
    const [k, v] = part.split(':').map((s) => s?.trim().toUpperCase())
    const metric = METRICS.find((x) => x.key === k)
    if (metric && metric.values.some((x) => x.v === v)) out[k] = v
  }
  return METRICS.every((x) => out[x.key]) ? out : null
}

export function randomMetrics() {
  const m = {}
  for (const x of METRICS) m[x.key] = x.values[Math.floor(Math.random() * x.values.length)].v
  return m
}
