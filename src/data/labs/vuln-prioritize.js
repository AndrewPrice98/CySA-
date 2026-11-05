// Lab: prioritize a vulnerability scan using CVSS, EPSS, CISA KEV and business context.

const findings = `ID   Host            Exposure   Asset tier   Finding                                        CVSS   EPSS   KEV
F1   vpn-gw-01       Internet   Critical     VPN appliance auth bypass (pre-auth RCE)       9.8    0.94   Yes
F2   hr-db-01        Internal   Critical     Database server: privilege escalation          7.8    0.03   No
F3   kiosk-lobby-03  Internal   Low          Outdated browser, multiple memory corruption   8.8    0.12   No
F4   www-01          Internet   High         TLS 1.0 and 1.1 enabled                        5.3    0.00   No
F5   files-02        Internal   High         SMB remote code execution (wormable)           8.1    0.89   Yes
F6   lab-plc-07      Isolated   Medium       PLC web UI default credentials                 9.1    0.02   No
F7   www-01          Internet   High         Reflected XSS on /search                       6.1    0.05   No
F8   build-01        Internal   High         Apache Struts RCE (scanner: banner match only) 9.8    0.97   Yes
`

const f8evidence = `Credentialed check, build-01 (Nessus agent):
  /opt/app/lib/struts2-core-6.3.0.2.jar   installed 2026-03-02
  Vendor advisory: fixed in 6.3.0.2 and later
Unauthenticated check: Server header "Apache Struts" -> flagged as vulnerable version range
`

export default {
  id: 'vuln-prioritize',
  title: 'Prioritize a vulnerability scan',
  objectives: ['2.2', '2.3', '4.1'],
  difficulty: 'Core',
  minutes: 12,
  scenario: 'Monday\'s scan produced eight findings. You have capacity to fix three this week. The CISO wants a defensible, risk-based order rather than "highest CVSS first". Use CVSS, EPSS (probability of exploitation in the next 30 days), the CISA KEV catalog, exposure and asset tier.',
  artifacts: [
    { id: 'scan', title: 'Scan summary', content: findings },
    { id: 'f8', title: 'F8 evidence', content: f8evidence },
  ],
  tasks: [
    {
      id: 'fp', type: 'single',
      prompt: 'Look at the F8 evidence. How should F8 be classified?',
      options: ['True positive', 'False positive', 'True negative', 'False negative'],
      answer: 1,
      explain: 'The credentialed check shows the fixed version (6.3.0.2) is installed. The finding came from a banner match by the unauthenticated check, so it\'s a false positive. Document it and tune the scan, but don\'t spend patch capacity on it.',
    },
    {
      id: 'top3', type: 'order',
      prompt: 'Order the three findings to fix this week, most urgent first.',
      items: ['F1 vpn-gw-01 VPN auth bypass', 'F5 files-02 SMB wormable RCE', 'F2 hr-db-01 privilege escalation'],
      explain: 'F1 is internet-facing, actively exploited (KEV) and very likely to be exploited (EPSS 0.94), so it comes first. F5 is also KEV with high EPSS, and wormable on the internal network. F2 is a lower likelihood but sits on a critical asset holding HR data. A high CVSS alone (F3, F6) does not outrank exploit likelihood plus exposure.',
    },
    {
      id: 'actions', type: 'grid',
      prompt: 'Choose the most appropriate response for each remaining finding.',
      columns: [{ key: 'action', label: 'Response', options: ['Patch in next cycle', 'Compensating control', 'Configuration change', 'Mark false positive', 'Accept risk with exception'] }],
      rows: [
        { label: 'F6 PLC default creds (isolated OT network, vendor patch requires downtime)', answer: { action: 'Compensating control' } },
        { label: 'F4 TLS 1.0/1.1 enabled on www-01', answer: { action: 'Configuration change' } },
        { label: 'F8 Struts RCE on build-01', answer: { action: 'Mark false positive' } },
        { label: 'F3 outdated browser on lobby kiosk', answer: { action: 'Patch in next cycle' } },
      ],
      explain: 'For F6, change the credentials if possible and keep the PLC isolated and monitored until a maintenance window: that is a compensating control. F4 is fixed by disabling the old protocols, with no patch needed. F8 is verified fixed. F3 is a low-tier asset with low EPSS, so it goes in the normal cycle.',
    },
    {
      id: 'epss', type: 'single',
      prompt: 'F3 has CVSS 8.8 but EPSS 0.12. What does the EPSS value tell you?',
      options: [
        'The vulnerability is 12% as severe as a critical one',
        'There is an estimated 12% probability it will be exploited in the wild in the next 30 days',
        '12% of hosts in the environment are affected',
        'The vendor rates exploit code maturity at 0.12',
      ],
      answer: 1,
      explain: 'EPSS, published by FIRST, estimates the probability of exploitation activity in the next 30 days. CVSS measures severity, not likelihood, and V4 expects you to combine the two.',
    },
    {
      id: 'report', type: 'multi',
      prompt: 'Which items belong in the weekly vulnerability report to the CISO? Select all that apply.',
      options: [
        'Risk-ranked list with affected hosts and owners',
        'Remediation status against SLA, including overdue items',
        'The full raw scanner export for every host',
        'Exceptions and compensating controls with expiry dates',
        'Trend of open critical/KEV findings over time',
      ],
      answer: [0, 1, 3, 4],
      explain: 'Executives need prioritized risk, SLA status, exceptions and trends. Raw scanner exports belong with the technical teams, not in an executive report.',
    },
  ],
}
