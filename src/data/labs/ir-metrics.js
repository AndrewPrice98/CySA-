// Lab: compute SOC response metrics from an incident register and structure an incident report.
// Timestamps are generated from minute offsets, and the answers are computed from the same data.

const INCIDENTS = [
  // id, type, occurred (UTC), minutes to detect, then minutes after detection to acknowledge / contain / remediate
  { id: 'IR-1', type: 'Credential phishing', occurred: '2026-03-03T08:00', detect: 270, ack: 45, contain: 360, remediate: 1800 },
  { id: 'IR-2', type: 'Malware on file server', occurred: '2026-04-14T22:00', detect: 360, ack: 50, contain: 480, remediate: 1560 },
  { id: 'IR-3', type: 'Business email compromise', occurred: '2026-05-20T09:30', detect: 210, ack: 40, contain: 300, remediate: 2400 },
  { id: 'IR-4', type: 'Exposed cloud access key', occurred: '2026-07-08T01:15', detect: 540, ack: 5, contain: 90, remediate: 2040 },
  { id: 'IR-5', type: 'Infostealer on laptop', occurred: '2026-09-22T14:00', detect: 240, ack: 4, contain: 60, remediate: 1860 },
]

const fmt = (d) => d.toISOString().slice(0, 16).replace('T', ' ')
const rows = INCIDENTS.map((i) => {
  const occurred = new Date(`${i.occurred}:00Z`)
  const detected = new Date(occurred.getTime() + i.detect * 60000)
  const at = (min) => new Date(detected.getTime() + min * 60000)
  return { ...i, occurred, detected, acknowledged: at(i.ack), contained: at(i.contain), remediated: at(i.remediate) }
})

const hours = (a, b) => (b - a) / 3600000
const mean = (xs) => xs.reduce((s, x) => s + x, 0) / xs.length
const MTTD = mean(rows.map((r) => hours(r.occurred, r.detected)))
const MTTC = mean(rows.map((r) => hours(r.detected, r.contained)))
for (const v of [MTTD, MTTC]) if (Math.abs(v * 10 - Math.round(v * 10)) > 1e-9) throw new Error(`ir-metrics: ${v} is not exact to one decimal`)

// Accept the usual ways of writing a duration in hours, e.g. 5.4 -> '5.4', '5.4h', '5.4 hours', '5h24m', '5:24'
function hourForms(h) {
  const d = h.toFixed(1)
  const whole = Math.floor(h)
  const min = Math.round((h - whole) * 60)
  return [d, `${d}0`, `${d}h`, `${d} h`, `${d}hr`, `${d} hr`, `${d}hrs`, `${d} hrs`, `${d} hours`,
    `${whole}h${min}m`, `${whole}h ${min}m`, `${whole} h ${min} min`, `${whole}:${String(min).padStart(2, '0')}`, `${whole} hours ${min} minutes`]
}

const register = `INCIDENT REGISTER, 2026 (all times UTC)
ID    Type                        Occurred          Detected          Acknowledged      Contained         Remediated
${rows.map((r) => `${r.id.padEnd(6)}${r.type.padEnd(28)}${[r.occurred, r.detected, r.acknowledged, r.contained, r.remediated].map(fmt).join('  ')}`).join('\n')}

SOAR went live on 2026-06-01 (automated enrichment, on-call paging and one-click containment).

METRIC DEFINITIONS (SOC handbook)
Time to detect       Detected - Occurred
Time to acknowledge  Acknowledged - Detected
Time to contain      Contained - Detected   (the SOC's "time to respond")
Time to remediate    Remediated - Detected
Report each metric as the mean across incidents, in hours.
`

const SECTIONS = ['Executive summary', 'Timeline', 'Scope', 'Impact', 'Root cause', 'Recommendations']

export default {
  id: 'ir-metrics',
  title: 'Incident metrics and reporting',
  objectives: ['4.1', '4.2'],
  difficulty: 'Core',
  minutes: 15,
  scenario: 'The CISO is presenting the year\'s incident response performance to the board and wants to know whether the SOAR investment made a difference. Compute the metrics from the incident register, then help finish the IR-3 report and decide how to handle a new discovery.',
  artifacts: [
    { id: 'register', title: 'Incident register', content: register },
  ],
  tasks: [
    {
      id: 'mttd', type: 'input',
      prompt: 'What is the mean time to detect (MTTD) across all five incidents, in hours?',
      answer: hourForms(MTTD),
      explain: `Detected - Occurred for each incident: ${rows.map((r) => hours(r.occurred, r.detected)).join(' + ')} = ${rows.reduce((s, r) => s + hours(r.occurred, r.detected), 0)} hours, and ${rows.reduce((s, r) => s + hours(r.occurred, r.detected), 0)} / 5 = ${MTTD.toFixed(1)} hours (${hourForms(MTTD)[9]}). Work in minutes or decimal hours, never mix clock times with decimals: 4 h 30 min is 4.5 h, not 4.3 h. MTTD measures how long attackers operate unseen, and it depends on telemetry and detection content.`,
    },
    {
      id: 'mttc', type: 'input',
      prompt: 'What is the mean time to contain (the SOC\'s "time to respond": Contained - Detected) across all five incidents, in hours?',
      answer: hourForms(MTTC),
      explain: `Contained - Detected: ${rows.map((r) => hours(r.detected, r.contained)).join(' + ')} = ${rows.reduce((s, r) => s + hours(r.detected, r.contained), 0)} hours, and ${rows.reduce((s, r) => s + hours(r.detected, r.contained), 0)} / 5 = ${MTTC.toFixed(1)} hours. Note which clock the metric starts from. Many frameworks measure MTTR from detection, but some measure from occurrence or from acknowledgement, so a report must state its definitions or the numbers can\'t be compared.`,
    },
    {
      id: 'soar', type: 'single',
      prompt: 'Compare IR-1 to IR-3 (before SOAR) with IR-4 and IR-5 (after). Which metric shows the clear improvement?',
      options: ['Mean time to detect', 'Mean time to contain', 'Mean time to remediate', 'Number of incidents per quarter'],
      answer: 1,
      explain: 'Containment fell from a mean of 6.3 hours (6, 8, 5) to 1.25 hours (1.5, 1), and acknowledgement from about 45 minutes to under 5. Those are the steps SOAR automates: enrichment, paging and one-click containment. Detection got worse (a mean of 4.7 hours before, 6.5 after), because SOAR acts on alerts but does not create them; MTTD improves with better telemetry and detection rules. Remediation stayed around 32 hours because re-imaging and rebuilding are still manual. Two incidents after the change is a small sample, so present it as an early trend, not a proven result.',
    },
    {
      id: 'sections', type: 'grid',
      prompt: 'Match each sentence from the IR-3 report to the section it belongs in.',
      columns: [{ key: 'section', label: 'Report section', options: SECTIONS }],
      rows: [
        { label: '"On 20 May an attacker took over a finance mailbox and requested a fraudulent supplier payment. The payment was stopped, no money was lost, and the account is secured."', answer: { section: 'Executive summary' } },
        { label: '"13:00 mailbox-rule alert fires; 13:40 analyst acknowledges; 18:00 sessions revoked and forwarding rule removed."', answer: { section: 'Timeline' } },
        { label: '"Two mailboxes (ap-clerk, ap-lead) and one SharePoint site were accessed; no other accounts or systems were involved."', answer: { section: 'Scope' } },
        { label: '"Accounts payable stopped work for 5 hours, and 312 supplier contact records (names, emails, phone numbers) were exposed."', answer: { section: 'Impact' } },
        { label: '"Legacy IMAP authentication was still enabled for the finance group, which let the attacker sign in without MFA."', answer: { section: 'Root cause' } },
        { label: '"Disable legacy authentication tenant-wide by 30 June (owner: IAM team) and require call-back verification for bank-detail changes."', answer: { section: 'Recommendations' } },
      ],
      explain: 'The executive summary is the whole story in plain language: what happened, the outcome and the current status. The timeline lists timestamped events. Scope is what was touched: accounts, systems and data. Impact is the effect on the business: downtime, data exposed and cost. Root cause is the underlying weakness, not the attacker\'s action. Recommendations are specific, with an owner and a date. Telling scope from impact is the usual trap: scope is how wide, impact is how much it hurt.',
    },
    {
      id: 'execsum', type: 'multi',
      prompt: 'Which items belong in the executive summary rather than the technical appendix? Select all that apply.',
      options: [
        'Business impact in plain language: downtime, data affected, cost',
        'Current status, including whether the threat is contained',
        'Decisions or resources needed from leadership',
        'The top recommendations, with owners and dates',
        'Full list of IoCs: IP addresses, domains and file hashes',
        'The SIEM queries and EDR process trees used in the investigation',
        'Raw log excerpts with timestamps',
      ],
      answer: [0, 1, 2, 3],
      explain: 'Executives read the summary to decide and to fund: what happened to the business, is it over, what do you need from us, and what will change. IoCs, queries, process trees and raw logs are evidence for the technical audience (and for sharing with peers or an ISAC); they go in the appendix, where they support the summary\'s claims without burying them.',
    },
    {
      id: 'escalate', type: 'single',
      prompt: 'During the IR-3 investigation an analyst finds that one of the accessed SharePoint files holds customer names with Social Security numbers. The incident is already declared. What should happen next?',
      options: [
        'Finish the technical investigation first, then mention the file in the final report',
        'Escalate now, as the IR plan requires, to legal counsel and the privacy officer, because exposed personal data can start breach-notification deadlines',
        'Email the affected customers directly from the SOC mailbox today',
        'Raise the ticket priority but keep the finding inside the SOC to prevent leaks',
      ],
      answer: 1,
      explain: 'PII changes the incident from a security problem into a possible legal one. Notification deadlines often run from discovery: for example, GDPR gives 72 hours to notify the supervisory authority, and US state laws set their own deadlines. Legal and privacy decide whether notification is required, who must be told and what is said. Waiting for the final report can miss a deadline. The SOC contacting customers directly bypasses legal review. Keeping the finding in the SOC is the opposite of escalating.',
    },
  ],
}
