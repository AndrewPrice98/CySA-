// Lab: design a SOAR phishing-report playbook, decide what to automate, and tune its rules.

const brief = `PHISHING-REPORT PLAYBOOK: design brief
Trigger      User clicks "Report phish" in the mail client; the message lands in phish@corp.example
Volume       About 120 reports a week; 1 in 6 is malicious
Today        Tier 1 triages every report by hand: about 25 minutes each
Target       4 minutes of analyst time per report after automation
Tools        Email gateway (sends webhooks), TI platform (REST API), sandbox (REST API),
             EDR (vendor plugin for the SOAR), web proxy (REST API), ticketing (plugin)
Guardrail    Any action that could stop a business service or lock out a person
             needs a named analyst's approval inside the playbook
`

const tuning = `ALERT-TUNING REVIEW, last 30 days (rules that feed the playbook)
Rule                      Alerts  True pos.  False pos.  Main false-positive cause
PHISH-URL-NEWDOMAIN          250         50         200  Links to the company's own new marketing
                                                         domains (registered under 30 days ago)
PHISH-ATTACH-MACRO            40         34           6  Finance templates with signed macros
PHISH-SPOOF-DISPLAYNAME       90         81           9  Executives emailing from personal accounts

The SOC defines a rule's false-positive rate as false positives / total alerts.
`

const MODE = ['Fully automate', 'Require analyst approval']

export default {
  id: 'soar-playbook',
  title: 'Build a SOAR phishing playbook',
  objectives: ['1.5'],
  difficulty: 'Core',
  minutes: 14,
  scenario: 'The SOC is buried in user-reported phishing. You have been asked to design the SOAR playbook that handles these reports: put the steps in order, decide what the playbook may do on its own, tune the noisiest detection rule, and work out the time it saves.',
  artifacts: [
    { id: 'brief', title: 'Playbook design brief', content: brief },
    { id: 'tuning', title: 'Alert-tuning review', content: tuning },
  ],
  tasks: [
    {
      id: 'steps', type: 'order',
      prompt: 'Put the playbook steps in order.',
      items: [
        'Ingest the reported email and open a ticket',
        'Parse headers, URLs and attachments to extract IoCs',
        'Enrich IoCs with threat intelligence (reputation, domain age, prior sightings)',
        'Detonate the attachment in the sandbox',
        'Decide the verdict: malicious, suspicious or benign',
        'Quarantine every matching email across the organization',
        'Block the sender and URL at the email gateway and web proxy',
        'Notify the reporting user of the outcome',
        'Close the ticket with the evidence and actions recorded',
      ],
      explain: 'A playbook runs collect, analyze, decide, act, communicate, close. You can\'t enrich what you haven\'t parsed, and the verdict depends on the enrichment and sandbox results. Containment comes next: pull the copies already in other inboxes first, since those are the people who haven\'t clicked yet, then block the source so no more arrive. Telling the reporter what happened keeps people reporting. Closing with full documentation gives the audit trail and the metrics.',
    },
    {
      id: 'approval', type: 'grid',
      prompt: 'For each action, decide whether the playbook may run it on its own or must pause for a named analyst\'s approval.',
      columns: [{ key: 'mode', label: 'Mode', options: MODE }],
      rows: [
        { label: 'Look up the URL and attachment hash in threat-intel feeds', answer: { mode: 'Fully automate' } },
        { label: 'Detonate the attachment in the sandbox', answer: { mode: 'Fully automate' } },
        { label: 'Soft-delete (recoverable) copies of an email the sandbox judged malicious from all mailboxes', answer: { mode: 'Fully automate' } },
        { label: 'Send the reporter an automatic "thanks, we are looking at it" reply', answer: { mode: 'Fully automate' } },
        { label: 'Disable the CFO\'s account because she entered her password on the phishing page', answer: { mode: 'Require analyst approval' } },
        { label: 'Network-isolate the production ERP server because EDR saw it contact the phishing URL', answer: { mode: 'Require analyst approval' } },
        { label: 'Block the domain of a widely used file-sharing SaaS because one phishing link was hosted there', answer: { mode: 'Require analyst approval' } },
        { label: 'Force a password reset for all 1,200 recipients of the campaign', answer: { mode: 'Require analyst approval' } },
      ],
      explain: 'Automate actions that are read-only, low-impact or easy to reverse, where speed matters: enrichment, detonation, recoverable quarantine of a confirmed-malicious message, acknowledgements. Put a human approval step in front of anything that can stop the business or lock out people, or that is hard to undo: disabling an executive, isolating a production server, blocking a domain the whole company uses, or a mass password reset. The playbook still prepares these actions; the analyst approves with one click, so the SOC keeps most of the speed with a person accountable. Most analysts would contain the CFO\'s account quickly, but a person makes that call with context, such as whether she is mid-wire-transfer.',
    },
    {
      id: 'fprate', type: 'input',
      prompt: 'Using the SOC\'s definition, what is the false-positive rate of PHISH-URL-NEWDOMAIN? (A percentage or a decimal is fine.)',
      answer: ['80%', '80', '0.8', '0.80', '80 %', '80 percent', '.8', '4/5', '200/250'],
      explain: '200 false positives / 250 alerts = 0.8, or 80%. Four out of five alerts from this rule waste analyst time, a textbook cause of alert fatigue. Strictly, a statistician calls FP / (FP + TP) the false discovery rate; "false positive rate" in statistics is FP / (FP + TN). SOC metrics usually use the per-alert definition, which is why the review spells it out. Always check the definition in the question.',
    },
    {
      id: 'tune', type: 'single',
      prompt: 'What is the best tuning action for PHISH-URL-NEWDOMAIN?',
      options: [
        'Disable the rule; 80% noise means it is worthless',
        'Add a scoped exception for domains the company owns (pulled from the registrar or asset inventory), keep the rule for every other new domain, and review the exception quarterly',
        'Only alert when 10 or more users click the same link',
        'Send all of its alerts straight to tier 2 so tier 1 is not distracted',
      ],
      answer: 1,
      explain: 'The false positives have one clear cause, so remove that cause and nothing else. Newly registered domains are a strong phishing signal, and the rule\'s 50 true positives prove it, so disabling it throws those away. A 10-click threshold means waiting until a campaign has already succeeded. Moving the noise to tier 2 changes who suffers, not how much. Exceptions should be narrow, have an owner, and be reviewed, or they turn into blind spots.',
    },
    {
      id: 'integrations', type: 'multi',
      prompt: 'Which statements correctly describe how the SOAR integrates with the tools in the brief? Select all that apply.',
      options: [
        'Webhook: the email gateway pushes an HTTP POST to the SOAR as soon as it flags a message, so nothing has to poll',
        'REST API: the playbook calls the TI platform\'s API, authenticating with an API key, to look up a hash\'s reputation',
        'Plugin: a vendor-built connector packaged for the SOAR wraps the EDR\'s API into ready-made actions such as "isolate host"',
        'Webhook: the SOAR asks the gateway for new messages every five minutes',
        'All integrations should authenticate with one administrator\'s personal API key so there is a single key to rotate',
        'When the EDR offers an API, scraping its web console is the preferred integration method',
      ],
      answer: [0, 1, 2],
      explain: 'Webhooks push events to the SOAR the moment they happen; asking every five minutes is polling an API, not a webhook. REST APIs are request and response, the SOAR asking the tool. Plugins (also called apps, connectors or integrations) are packaged API wrappers that save you writing the calls. Each integration should use its own least-privilege service account or key, kept in a vault, so one compromise or one person leaving doesn\'t break or expose everything. Screen scraping breaks with every UI change and is a last resort.',
    },
    {
      id: 'hours', type: 'input',
      prompt: 'If the playbook meets its target (4 minutes instead of 25 per report, 120 reports a week), how many analyst hours does it save per week?',
      answer: ['42', '42h', '42 h', '42 hours', '42 hrs', '42.0'],
      explain: '(25 - 4) minutes x 120 reports = 2,520 minutes, and 2,520 / 60 = 42 hours a week, more than one full-time analyst. Numbers like this make the business case for SOAR. Track them afterwards with metrics such as mean time to triage per report and the share of reports closed without an analyst touching them.',
    },
  ],
}
