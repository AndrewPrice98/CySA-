// CompTIA CySA+ CS0-004 (V4, launched 23 June 2026) exam structure.
// Domain weights and objective titles follow CompTIA's official V4 certification page. CompTIA lists the
// objectives in this order without numbers, so the numbering here is by that order. The page gives a
// one-line scope per objective but no sub-bullets: the topic lists below are built from those scope
// lines, the CS0-003 outline they replace, and the areas V4 expands (AI, cloud and hybrid, XDR, ZTNA/SASE,
// SOAR, exploit-likelihood prioritization). Check them against CompTIA's objectives PDF when you have it.

export const EXAM = {
  code: 'CS0-004',
  name: 'CompTIA CySA+',
  version: 'V4',
  launched: '2026-06-23',
  maxQuestions: 85,
  minutes: 165,
  passing: 750,
  scale: '100–900',
  replaces: 'CS0-003 (English exam retires 22 December 2026)',
}

export const DOMAINS = [
  { id: 'd1', num: 1, title: 'Security Operations', weight: 34 },
  { id: 'd2', num: 2, title: 'Vulnerability Management', weight: 26 },
  { id: 'd3', num: 3, title: 'Incident Response and Management', weight: 24 },
  { id: 'd4', num: 4, title: 'Reporting and Communication', weight: 16 },
]

export const OBJECTIVES = [
  {
    id: '1.1', domain: 'd1',
    title: 'Explain system and network architecture concepts in security operations',
    scope: 'Security architecture components, identity concepts and logging practices that support secure environments.',
    topics: ['Logging: ingestion, time synchronization, logging levels, log sources across on-prem and cloud', 'OS concepts: Windows Registry, hardening, file structure, config file locations, system processes', 'Infrastructure: virtualization, containers, serverless, cloud and hybrid', 'Network architecture: segmentation, zero trust, ZTNA, SASE, SDN', 'Identity: MFA, SSO, federation, PAM, passwordless, conditional access, CASB', 'Encryption: PKI, TLS inspection', 'Data protection: DLP, PII, cardholder data'],
  },
  {
    id: '1.2', domain: 'd1',
    title: 'Analyze indicators of potential malicious activity',
    scope: 'Suspicious activity across networks, endpoints, cloud and identity systems.',
    topics: ['Network: beaconing, bandwidth spikes, irregular peer-to-peer, rogue devices, scans and sweeps, unexpected ports, DNS anomalies', 'Endpoint: resource consumption, malicious or abnormal processes, unauthorized software, changes and privileges, file system and registry anomalies, scheduled tasks, exfiltration', 'Cloud: unusual API calls, new access keys, public storage, disabled logging, unexpected regions or resources', 'Identity: impossible travel, MFA fatigue, password spraying, new accounts, privilege changes, token theft', 'Application: anomalous activity, unexpected output and outbound traffic, service interruption, app logs', 'Social engineering and obfuscated links'],
  },
  {
    id: '1.3', domain: 'd1',
    title: 'Use tools to determine malicious activity',
    scope: 'SIEM, EDR, packet analysis tools and threat intelligence platforms.',
    topics: ['SIEM queries and correlation; SOAR', 'EDR and XDR', 'Packet analysis: Wireshark, tcpdump, Zeek; IDS/IPS such as Snort and Suricata', 'Threat intelligence platforms; DNS and IP reputation (WHOIS, AbuseIPDB)', 'File analysis: hashing, strings, VirusTotal, YARA, CyberChef; sandboxing', 'Techniques: email header analysis (SPF, DKIM, DMARC), interpreting suspicious commands, user behavior analytics', 'Scripting and data formats: regex, grep/awk, PowerShell, Python, JSON, XML'],
  },
  {
    id: '1.4', domain: 'd1',
    title: 'Explain threat intelligence and threat-hunting concepts',
    scope: 'Frameworks, data sources and methods used to identify and investigate threats.',
    topics: ['Threat actors: APT, nation-state, organized crime, hacktivist, insider, script kiddie, supply chain', 'TTPs and IoCs vs IoAs', 'Intelligence sources: open, closed, ISACs, CERTs, dark web, internal; STIX/TAXII; TLP', 'Confidence: timeliness, relevancy, accuracy', 'Threat hunting: hypothesis-driven hunting, focus areas, active defense, honeypots', 'Threat modeling: STRIDE, attack trees'],
  },
  {
    id: '1.5', domain: 'd1',
    title: 'Describe efficiency and process improvement in security operations',
    scope: 'Automation, workflows and processes used to improve operational efficiency.',
    topics: ['Standardizing processes and finding tasks to automate', 'SOAR playbooks: enrichment, ticketing, containment, notification', 'When automation needs human approval', 'Integration: APIs, webhooks, plugins; single pane of glass', 'Alert tuning and reducing false positives and alert fatigue'],
  },
  {
    id: '1.6', domain: 'd1',
    title: 'Summarize concepts related to the use of AI in security operations',
    scope: 'Use cases, risks and governance considerations.',
    topics: ['Use cases: summarizing alerts and logs, pattern and anomaly detection, triage assistance, query generation, investigation and report drafting', 'Risks: hallucination, prompt injection, data leakage, model and data poisoning, over-reliance, bias', 'Governance: human-in-the-loop, acceptable use, data handling, validation of outputs, auditability', 'AI-enabled attacks: phishing, deepfakes, faster exploit development'],
  },
  {
    id: '2.1', domain: 'd2',
    title: 'Implement the appropriate vulnerability scanning method',
    scope: 'Tools and techniques used to identify vulnerabilities across systems, networks and applications.',
    topics: ['Asset discovery and fingerprinting', 'Internal vs external, agent vs agentless, credentialed vs non-credentialed, active vs passive', 'Static vs dynamic analysis, fuzzing, software composition analysis and SBOMs', 'Cloud, container and API scanning', 'OT / ICS / SCADA considerations', 'Scheduling, performance, segmentation and sensitivity constraints', 'Baselines and frameworks: CIS Benchmarks, PCI DSS, ISO 27000, OWASP'],
  },
  {
    id: '2.2', domain: 'd2',
    title: 'Analyze output from vulnerability assessment tools',
    scope: 'Vulnerabilities, findings and security gaps identified through scan results.',
    topics: ['Network scanners and mappers: Nmap, Angry IP Scanner, Maltego', 'Vulnerability scanners: Nessus, OpenVAS, Qualys-style reports', 'Web app scanners: Burp Suite, ZAP, Nikto', 'Cloud assessment: Scout Suite, Prowler, Pacu', 'Multipurpose and debugging: Metasploit, Recon-ng, GDB', 'Validation: true and false positives and negatives'],
  },
  {
    id: '2.3', domain: 'd2',
    title: 'Prioritize and mitigate vulnerabilities',
    scope: 'Risk-based approaches using scoring systems, threat intelligence and business context.',
    topics: ['CVSS base metrics and vectors', 'Exploit likelihood: EPSS, CISA KEV, weaponization, zero-days', 'Context: asset value and criticality, exposure (internal, external, isolated)', 'Web and software flaws and their fixes: XSS, injection, CSRF, SSRF, directory traversal, LFI/RFI, overflows, broken access control, crypto failures, misconfiguration, outdated components', 'Secure coding: input validation, output encoding, parameterized queries, session management'],
  },
  {
    id: '2.4', domain: 'd2',
    title: 'Explain concepts related to control types, risks and vulnerability management',
    scope: 'Controls, policies and compliance practices used to manage risk.',
    topics: ['Control categories and functions: managerial, operational, technical; preventive, detective, corrective, compensating', 'Risk responses: accept, transfer, avoid, mitigate; exceptions', 'Patch and configuration management, maintenance windows, rollback, validation', 'Policies, governance, SLAs and SLOs, compliance', 'Attack surface management, penetration testing, bug bounties', 'Secure SDLC and threat modeling'],
  },
  {
    id: '3.1', domain: 'd3',
    title: 'Summarize concepts related to attack methodology frameworks',
    scope: 'Models such as MITRE ATT&CK and the Cyber Kill Chain.',
    topics: ['Cyber Kill Chain', 'MITRE ATT&CK tactics, techniques and procedures', 'Diamond Model of Intrusion Analysis', 'OSSTMM and the OWASP Testing Guide'],
  },
  {
    id: '3.2', domain: 'd3',
    title: 'Outline the incident response process',
    scope: 'Phases including preparation, detection, analysis, containment, eradication and recovery.',
    topics: ['IR life cycle phases and their order (NIST SP 800-61)', 'Preparation: IR plan, playbooks, tools, training, tabletop exercises', 'Business continuity and disaster recovery', 'Post-incident activity: lessons learned, reporting, evidence retention'],
  },
  {
    id: '3.3', domain: 'd3',
    title: 'Implement incident response techniques',
    scope: 'Triage, evidence handling, escalation, remediation and root cause identification.',
    topics: ['Triage, scoping and severity classification', 'Evidence handling: order of volatility, chain of custody, hashing, legal hold', 'Containment: isolation, segmentation, account and key revocation, including cloud resources', 'Eradication and recovery: re-imaging, patching, restoring, monitoring', 'Escalation paths', 'Root cause analysis'],
  },
  {
    id: '4.1', domain: 'd4',
    title: 'Explain vulnerability management reporting and communication',
    scope: 'Reports, dashboards and communication activities used to present findings and support escalation.',
    topics: ['Vulnerability reports: affected hosts, risk score, mitigation, recurrence, prioritization', 'Dashboards, trends, top-10 lists, SLA compliance', 'Compliance reports and action plans', 'Inhibitors to remediation: SLAs, MOUs, business interruption, legacy and proprietary systems', 'Stakeholder communication and escalation'],
  },
  {
    id: '4.2', domain: 'd4',
    title: 'Describe security operations, incident response reporting and communication',
    scope: 'Incident documentation, post-incident reviews and metrics such as detection time, response time and remediation effectiveness.',
    topics: ['Incident reports: executive summary, timeline, scope, impact, evidence, recommendations', 'Declaration, escalation and stakeholder communication: legal, PR, regulators, law enforcement, customers', 'Post-incident reviews: root cause, lessons learned', 'SOC and IR metrics: MTTD, MTTR, mean time to remediate, alert volume, false positive rate, remediation effectiveness'],
  },
]

export const domainById = (id) => DOMAINS.find((d) => d.id === id)
export const objectiveById = (id) => OBJECTIVES.find((o) => o.id === id)
export const objectivesIn = (domainId) => OBJECTIVES.filter((o) => o.domain === domainId)
