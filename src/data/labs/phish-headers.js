// Lab: phishing triage from raw email headers. A spoof of the company's own domain gets
// through because its DMARC policy is p=none. The headers are a fixed artifact (line
// numbers matter for the "lines" task), so keep the line order stable if you edit them.

const headers = [
  'Return-Path: <bounce-0193@brightvvater.example>',
  'Delivered-To: j.alvarez@brightwater.example',
  'Received: from mx1.brightwater.example (mx1.brightwater.example [192.0.2.25])',
  '\tby mbox03.brightwater.example (Postfix) with ESMTPS id 4R7kQ2mZ1hz9vY',
  '\tfor <j.alvarez@brightwater.example>; Wed,  4 Nov 2026 09:15:24 -0500 (EST)',
  'Received: from mail.brightwater.example (vps-4471.cloudhost.example.net [198.51.100.73])',
  '\tby mx1.brightwater.example (Postfix) with ESMTP id 8C1F2A0412',
  '\tfor <j.alvarez@brightwater.example>; Wed,  4 Nov 2026 09:15:22 -0500 (EST)',
  'Received: from [10.0.0.14] (unknown [10.0.0.14])',
  '\tby mail.brightwater.example (Postfix) with ESMTPSA id 77D2E1',
  '\tfor <j.alvarez@brightwater.example>; Wed,  4 Nov 2026 14:15:19 +0000',
  'Authentication-Results: mx1.brightwater.example;',
  '\tspf=softfail (mx1.brightwater.example: domain of transitioning bounce-0193@brightvvater.example does not designate 198.51.100.73 as permitted sender) smtp.mailfrom=bounce-0193@brightvvater.example;',
  '\tdkim=pass (2048-bit key) header.d=brightvvater.example header.i=@brightvvater.example header.s=s2026 header.b="Qm3v9xLa";',
  '\tdmarc=fail (p=NONE sp=NONE dis=NONE) header.from=brightwater.example',
  'DKIM-Signature: v=1; a=rsa-sha256; c=relaxed/relaxed; d=brightvvater.example; s=s2026;',
  '\tt=1793801718; h=from:reply-to:to:subject:date:message-id:mime-version:content-type;',
  '\tbh=1rDn0mWb3vKXo1n8Vb4Zr3rFq1oYk5sR9wq2l0wA0Hc=;',
  '\tb=Qm3v9xLaT0d8Hc2nQp7YwR4kZs1uV6bN8mE3jF5gH0iK2lP9oQ7rS4tU1vW6xY3zA8bC5dE2fG9hJ0kL7mN4pQ1rS8tU5vW2x==',
  'From: "Brightwater IT Service Desk" <it-servicedesk@brightwater.example>',
  'Reply-To: "IT Service Desk" <brightwater.helpdesk@mailbox.example.net>',
  'To: <j.alvarez@brightwater.example>',
  'Subject: [ACTION REQUIRED] Mailbox password expires in 24 hours',
  'Date: Wed, 4 Nov 2026 14:15:18 +0000',
  'Message-ID: <20261104141518.77D2E1@mail.brightwater.example>',
  'X-Mailer: PHPMailer 6.8.1 (https://github.com/PHPMailer/PHPMailer)',
  'MIME-Version: 1.0',
  'Content-Type: text/html; charset=UTF-8',
  'Content-Transfer-Encoding: quoted-printable',
]

const body = `<!-- Links defanged by the SOC before analysis: hxxps = https, [.] = . -->
<html>
<body style="font-family:Segoe UI,Arial,sans-serif;font-size:14px;color:#222">
<img src="hxxps://cdn.brightvvater[.]example/assets/brightwater-logo.png" alt="Brightwater" width="160">
<p>Dear j.alvarez,</p>
<p>Our records show that your mailbox password <b>expires in 24 hours</b>. To avoid losing
access to email, Teams and VPN, re-validate your credentials now.</p>
<p style="text-align:center">
  <a href="hxxps://sso-brightwater.brightvvater[.]example/owa/auth/logon.aspx?replaceCurrent=1&amp;u=j.alvarez%40brightwater.example"
     style="background:#0b5cad;color:#fff;padding:10px 18px;text-decoration:none">https://sso.brightwater.example/password-reset</a>
</p>
<p>If you do not validate within 24 hours your mailbox will be suspended and pending
messages will be deleted.</p>
<p>Thank you,<br>Brightwater IT Service Desk<br>Ext. 4400</p>
<img src="hxxps://trk.brightvvater[.]example/o.gif?id=c2a1f0e9" width="1" height="1" alt="">
</body>
</html>
`

const gateway = `Mail gateway message trace (last 24 h), sender domain brightvvater.example
Time (EST)  Recipient                          Verdict     Action
09:15:22    j.alvarez@brightwater.example      Delivered   Inbox   (user reported 09:31)
09:15:23    k.osei@brightwater.example         Delivered   Inbox
09:15:23    finance-ap@brightwater.example     Delivered   Inbox
09:15:24    r.nakamura@brightwater.example     Delivered   Inbox
09:15:24    m.duarte@brightwater.example       Delivered   Inbox
... 9 more recipients, all Delivered
URL click log (proxy): 2 users requested sso-brightwater.brightvvater.example after 09:15
  09:22:41  k.osei      GET  /owa/auth/logon.aspx   200
  09:23:05  k.osei      POST /owa/auth/logon.aspx   302 -> https://outlook.example.com
  09:40:17  m.duarte    GET  /owa/auth/logon.aspx   200
`

export default {
  id: 'phish-headers',
  title: 'Phishing email header triage',
  objectives: ['1.2', '1.3'],
  difficulty: 'Core',
  minutes: 14,
  scenario: 'j.alvarez reported an email titled "Mailbox password expires in 24 hours" that claims to come from the Brightwater IT Service Desk. Your company\'s real domain is brightwater.example and its inbound gateway is mx1.brightwater.example (192.0.2.25). Analyze the raw headers and the HTML body, decide whether it is spoofed, and choose the response. The links in the body were defanged by the SOC: read hxxps as https and [.] as a dot.',
  artifacts: [
    { id: 'hdr', title: 'Raw headers', content: `${headers.join('\n')}\n` },
    { id: 'body', title: 'HTML body (defanged)', content: body },
    { id: 'trace', title: 'Gateway trace and proxy clicks', content: gateway },
  ],
  tasks: [
    {
      id: 'spoof', type: 'lines', artifact: 'hdr',
      prompt: 'Select the FIVE header lines that prove this message did not come from Brightwater\'s mail system.',
      answer: [0, 5, 12, 14, 20],
      explain: 'Line 1: the envelope sender (Return-Path) is brightvvater.example, a lookalike with "vv" in place of "w". Line 6: the first hop your own MX recorded shows a host that called itself mail.brightwater.example in its HELO but connected from vps-4471.cloudhost.example.net [198.51.100.73], a rented server. Line 13: SPF softfail, so that IP is not allowed to send for the envelope domain. Line 15: DMARC fail for header.from=brightwater.example. Line 21: Reply-To sends any answers to a free-mail address. The dkim=pass line is the trap. It is a valid signature from the attacker\'s own lookalike domain, which proves nothing about Brightwater. That missing alignment is exactly why DMARC failed. The Message-ID and X-Mailer are set by the sender and are suspicious at best, not proof.',
    },
    {
      id: 'ip', type: 'input',
      prompt: 'What is the true IP address of the server that sent this message onto the internet?',
      answer: ['198.51.100.73'],
      explain: 'Read the Received chain from the top down and stop at the first hop added by infrastructure you trust. mx1.brightwater.example recorded the connecting IP as [198.51.100.73]. The IP in square brackets is what the TCP connection really came from, unlike the HELO name, which the client chooses. 10.0.0.14 sits in a Received header written by the attacker\'s own server, so it is unverifiable (and private). 192.0.2.25 is your own MX.',
    },
    {
      id: 'auth', type: 'grid',
      prompt: 'Classify each authentication result and whether its domain aligns with the From: domain (brightwater.example).',
      columns: [
        { key: 'result', label: 'Result', options: ['Pass', 'Fail', 'Softfail', 'Neutral', 'None'] },
        { key: 'align', label: 'Alignment with From:', options: ['Aligned', 'Not aligned', 'Not applicable'] },
      ],
      rows: [
        { label: 'SPF (smtp.mailfrom=brightvvater.example)', answer: { result: 'Softfail', align: 'Not aligned' } },
        { label: 'DKIM (header.d=brightvvater.example)', answer: { result: 'Pass', align: 'Not aligned' } },
        { label: 'DMARC (header.from=brightwater.example)', answer: { result: 'Fail', align: 'Not applicable' } },
      ],
      explain: 'DMARC passes only if SPF or DKIM passes AND that domain aligns with the visible From: domain. SPF softfailed (~all), and its domain (brightvvater) doesn\'t match anyway. DKIM passed, but for brightvvater.example, so it isn\'t aligned. With neither check both passing and aligned, DMARC fails. DMARC is itself the alignment check, so alignment doesn\'t apply to it. Lesson: "dkim=pass" alone never means the mail is legitimate.',
    },
    {
      id: 'pnone', type: 'single',
      prompt: 'DMARC failed, yet the gateway delivered the message to 14 inboxes. Why?',
      options: [
        'The DKIM pass overrode the DMARC failure',
        'brightwater.example publishes p=none, so receivers only report DMARC failures and take no action',
        'SPF softfail always means "accept"',
        'The gateway does not support DMARC',
      ],
      answer: 1,
      explain: 'The header shows "p=NONE sp=NONE dis=NONE": the domain owner (your own company) asked receivers to monitor only, so the disposition was none. Once the aggregate (rua) reports confirm all legitimate senders pass, move to p=quarantine and then p=reject. Then a spoof of your exact domain is blocked. Note that this would NOT stop the lookalike brightvvater.example: that needs lookalike-domain monitoring and gateway rules.',
    },
    {
      id: 'action', type: 'single',
      prompt: 'Look at the gateway trace and proxy log as well. What is the BEST next action?',
      options: [
        'Delete the email from j.alvarez\'s mailbox and thank the user',
        'Block the sender domain brightwater.example at the gateway',
        'Purge the message from all 14 mailboxes, block the lookalike domain, sending IP and URL, and reset k.osei\'s password and revoke that user\'s sessions',
        'Change the company DMARC record to p=reject immediately, then close the ticket',
      ],
      answer: 2,
      explain: 'This is a campaign, not one email. Purge it everywhere (search by Message-ID or sender), block the IoCs, and handle the user who submitted credentials: k.osei sent a POST to the harvest page. Reset that password, revoke tokens and sessions, and review sign-ins and MFA changes. Blocking brightwater.example would block your own mail. Moving to p=reject is a good follow-up, but it is not an incident response, and done in a hurry it can break legitimate mail flows.',
    },
    {
      id: 'ioc', type: 'multi',
      prompt: 'Which indicators should you add to the block lists? Select all that apply.',
      options: [
        'Domain brightvvater.example (including subdomains such as sso-brightwater. and trk.)',
        'Sending IP 198.51.100.73',
        'Reply-To address brightwater.helpdesk@mailbox.example.net',
        'Credential-harvest URL hxxps://sso-brightwater.brightvvater[.]example/owa/auth/logon.aspx',
        'Domain brightwater.example',
        'IP 192.0.2.25',
        'IP 10.0.0.14',
      ],
      answer: [0, 1, 2, 3],
      explain: 'Block the lookalike domain and its hosts, the sending IP, the reply-to address (so users can\'t answer the attacker) and the harvest URL. brightwater.example is your own domain and 192.0.2.25 is your own MX. 10.0.0.14 is a private address from a header the attacker wrote, and blocking it would do nothing (or break something internal).',
    },
  ],
}
