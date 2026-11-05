// Lab: run a ransomware incident through the NIST lifecycle, handle evidence, classify and notify.

const timeline = `INC-2026-0412  Ransomware outbreak (all times UTC)
2026-10-09 16:20  Mail gateway delivers "Invoice 7781" with invoice.iso to ap-clerk@corp.example (ISO attachments are not sent to the sandbox)
2026-10-09 16:31  ap-clerk opens invoice.iso; invoice.lnk starts rundll32 loading a DLL. EDR raises a Medium alert; a tuning rule auto-closes it
2026-10-10 02:05  WS-AP-03 begins HTTPS beacons to 198.51.100.200 every 60 s (seen later in proxy logs; no alert fired)
2026-10-11 23:40  svc_backup credentials, dumped from LSASS on WS-AP-03, used for RDP logons to FS-01 and FS-02
2026-10-12 00:15  rclone on FS-01 uploads 41 GB from the HR and Finance shares to 203.0.113.150
2026-10-12 02:58  vssadmin delete shadows /all /quiet on FS-01 and FS-02
2026-10-12 03:02  Files renamed to *.lkd on FS-01, FS-02 and 14 workstations; README_LKD.txt ransom note dropped
2026-10-12 03:09  EDR High alert "Mass file modification"; SOC on-call analyst paged
2026-10-12 03:24  Analyst confirms active encryption and declares a SEV-1 incident
2026-10-12 06:30  Leak site lists the company: "41 GB incl. employee SSNs and payroll"
`

const matrix = `SEVERITY (highest matching level wins)
SEV-1  A critical business function is unavailable, OR regulated data (PII, PHI,
       cardholder data) is confirmed exfiltrated or exposed
SEV-2  Confirmed unauthorized access to, or change of, internal data that is not
       regulated, OR a business function is degraded for some users
SEV-3  One host or account compromised and contained; no data access confirmed
SEV-4  Attack attempted and blocked; no compromise

INFORMATION IMPACT (NIST SP 800-61 Rev. 2)
None                No information was exfiltrated, changed, deleted or otherwise compromised
Privacy breach      Sensitive personally identifiable information was accessed or exfiltrated
Proprietary breach  Unclassified proprietary information was accessed or exfiltrated
Integrity loss      Sensitive or proprietary information was changed or deleted
`

const PHASES = ['Preparation', 'Detection & Analysis', 'Containment, Eradication & Recovery', 'Post-Incident Activity']
const SEV = ['SEV-1', 'SEV-2', 'SEV-3', 'SEV-4']
const INFO = ['None', 'Privacy breach', 'Proprietary breach', 'Integrity loss']

export default {
  id: 'ransomware-ir',
  title: 'Ransomware incident response',
  objectives: ['3.2', '3.3', '4.2'],
  difficulty: 'Advanced',
  minutes: 18,
  scenario: 'At 03:09 UTC on Monday 12 October the EDR fired a "mass file modification" alert on the file servers. You are the incident handler on the bridge call. Use the reconstructed timeline and the company severity matrix to answer the questions as the response unfolds.',
  artifacts: [
    { id: 'timeline', title: 'Incident timeline', content: timeline },
    { id: 'matrix', title: 'Severity and impact matrix', content: matrix },
  ],
  tasks: [
    {
      id: 'first', type: 'single',
      prompt: 'It is 03:25. The CIO wants to pull the power on every server, and the CFO asks whether to just pay. What should the incident handler do FIRST?',
      options: [
        'Pay the ransom quickly, before the price goes up',
        'Power off every server and workstation immediately',
        'Isolate the affected hosts from the network (EDR containment or a quarantine VLAN), leave them powered on, and block 198.51.100.200 and 203.0.113.150',
        'Start restoring FS-01 from backup on the same network so payroll can run',
      ],
      answer: 2,
      explain: 'Network isolation stops the spread and cuts the attacker\'s channel while keeping memory intact. RAM may hold encryption keys, the injected DLL and live network connections. Pulling power destroys that evidence and can corrupt half-encrypted files. Restoring now, while the attacker still holds svc_backup and has a C2 channel, invites re-encryption. Whether to pay is a business decision for executives, legal counsel and the insurer, and it carries sanctions risk: the US Treasury (OFAC) warns that paying a sanctioned group can be illegal. Paying also guarantees neither a working decryptor nor deletion of the stolen data.',
    },
    {
      id: 'phases', type: 'grid',
      prompt: 'Map each action to its NIST SP 800-61 incident response phase.',
      columns: [{ key: 'phase', label: 'Phase', options: PHASES }],
      rows: [
        { label: 'Quarterly tabletop of the ransomware playbook with IT, legal and communications', answer: { phase: 'Preparation' } },
        { label: 'Keep immutable, offline backups of the file servers and test a restore every quarter', answer: { phase: 'Preparation' } },
        { label: 'Review the 03:09 EDR alert, confirm encryption and declare the incident', answer: { phase: 'Detection & Analysis' } },
        { label: 'Hunt across all endpoints for the invoice.iso hash and beacons to 198.51.100.200 to scope the outbreak', answer: { phase: 'Detection & Analysis' } },
        { label: 'Network-contain infected hosts with EDR and disable the svc_backup account', answer: { phase: 'Containment, Eradication & Recovery' } },
        { label: 'Re-image the 14 workstations and restore FS-01 and FS-02 from the offline backups', answer: { phase: 'Containment, Eradication & Recovery' } },
        { label: 'Lessons-learned meeting on why the 9 October EDR alert was auto-closed', answer: { phase: 'Post-Incident Activity' } },
        { label: 'Write the final report and retain the evidence under legal hold', answer: { phase: 'Post-Incident Activity' } },
      ],
      explain: 'NIST SP 800-61 Rev. 2 has four phases. Preparation covers everything done before an incident: plans, exercises, tooling and backups. Detection & Analysis covers validating alerts, declaring the incident and scoping it; the IoC hunt counts as analysis even while containment begins. Containment, Eradication & Recovery covers isolating hosts, revoking credentials, removing the attacker and restoring service. Post-Incident Activity covers lessons learned, reporting and evidence retention. The phases loop: lessons learned feed back into Preparation. Rev. 3 (2025) maps the same activities onto the NIST CSF 2.0 functions, but the four-phase cycle is what most exam questions use.',
    },
    {
      id: 'volatility', type: 'order',
      prompt: 'Before re-imaging FS-01 you must collect evidence. Put the sources in the order of collection (most volatile first, per RFC 3227).',
      items: [
        'CPU registers and cache',
        'RAM: running processes, network connections, ARP and routing tables',
        'Temporary file systems and the page/swap file',
        'Full disk image of the system drive',
        'Remote logs held on the SIEM and the firewall',
        'Backup tapes and archived media',
      ],
      explain: 'RFC 3227 says to collect from most to least volatile: registers and cache; then routing table, ARP cache, process table, kernel statistics and memory; then temporary file systems; then disk; then remote logging and monitoring data; then physical configuration and topology; and archival media last. Memory comes before disk because it disappears at power-off, and for ransomware it may hold the key. Hash every image and record chain of custody as you go.',
    },
    {
      id: 'missed', type: 'lines', artifact: 'timeline',
      prompt: 'For the root-cause section, select every timeline entry where a control saw (or should have seen) the attack but nothing reached an analyst.',
      answer: [1, 2, 3],
      explain: 'Three missed chances: the ISO attachment skipped the sandbox (16:20), the EDR Medium alert was auto-closed by a tuning rule (16:31), and 60-second beacons ran for two days without an alert (02:05). Each becomes a recommendation: sandbox container formats such as ISO and IMG, review auto-close rules, and add beacon detection. Later entries are the attack progressing; the 03:09 alert is the detection that worked.',
    },
    {
      id: 'severity', type: 'grid',
      prompt: 'Use the matrix to classify this incident and four others from the same quarter.',
      columns: [
        { key: 'sev', label: 'Severity', options: SEV },
        { key: 'info', label: 'Information impact', options: INFO },
      ],
      rows: [
        { label: 'This ransomware incident: file servers encrypted, payroll offline, 41 GB including employee SSNs stolen', answer: { sev: 'SEV-1', info: 'Privacy breach' } },
        { label: 'Stolen VPN credentials used to download engineering design documents from the wiki; no personal data, wiki stayed up', answer: { sev: 'SEV-2', info: 'Proprietary breach' } },
        { label: 'Attacker changed a supplier\'s bank account number in the ERP; caught before any payment run, services normal', answer: { sev: 'SEV-2', info: 'Integrity loss' } },
        { label: 'Infostealer on one marketing laptop; EDR isolated it in 6 minutes, no evidence of data access', answer: { sev: 'SEV-3', info: 'None' } },
        { label: 'Password spray against the VPN, stopped by MFA and lockout; no successful logins', answer: { sev: 'SEV-4', info: 'None' } },
      ],
      explain: 'Read the matrix literally and take the highest level that matches. Payroll down and SSNs stolen each meet SEV-1 on their own. The design documents are unregulated internal data (SEV-2) that was copied, which makes it a proprietary breach. The bank-detail change is unauthorized modification (SEV-2): nothing was stolen, but the data can no longer be trusted, which is integrity loss. A contained single host with no data access is SEV-3. A blocked attempt is SEV-4. Severity drives who gets paged and how fast, which is why it is defined before an incident.',
    },
    {
      id: 'notify', type: 'multi',
      prompt: 'Exfiltration of employee SSNs is now confirmed. Which parties should the incident commander bring in or notify? Select all that apply.',
      options: [
        'Legal counsel (internal or outside breach counsel)',
        'The cyber-insurance carrier, as the policy\'s notice clause requires',
        'Regulators and state authorities that breach-notification laws require for SSNs',
        'Law enforcement, such as the local FBI field office or IC3',
        'Affected employees, on the timeline and with the wording legal sets',
        'The attackers, contacted directly by the SOC to negotiate',
        'A reporter who called the help desk, given the on-call analyst\'s account of events',
      ],
      answer: [0, 1, 2, 3, 4],
      explain: 'Legal comes first: counsel decides which notification laws apply, and directing the investigation through counsel can protect privilege. Insurers usually require prompt notice and may supply breach coaches, forensics firms and negotiators, so notifying late can void cover. SSNs trigger breach-notification duties to regulators and to the individuals affected, each with its own deadline. Law enforcement may hold decryptors or intelligence, and engaging them is a factor regulators consider. Any contact with the attacker goes through counsel and specialist negotiators, never the SOC alone. Media questions go to the designated spokesperson.',
    },
    {
      id: 'pr', type: 'single',
      prompt: 'Corporate communications has drafted a press statement. Why must it go through legal before release?',
      options: [
        'Legal owns the company\'s social media accounts',
        'Public statements create legal exposure, so they must match facts counsel has confirmed and the regulatory notifications. An early or inaccurate statement can mislead regulators and the people affected, and can tip off the attacker',
        'Legal must approve every email sent during an incident, including technical ones',
        'So the statement can say no personal data was affected until the investigation is finished',
      ],
      answer: 1,
      explain: 'Everything said in public can become evidence in lawsuits and regulatory actions. Statements must be accurate, consistent with the formal notifications, and must not reveal details that help the attacker. Saying "no personal data was affected" while SSNs are on a leak site is exactly the kind of statement that creates liability. Use one spokesperson, approved wording and a single source of truth; legal does not need to approve routine technical messages.',
    },
  ],
}
