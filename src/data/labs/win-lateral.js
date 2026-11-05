// Lab: password spray -> admin logon -> backdoor local admin -> PsExec -> log cleared,
// reconstructed from a Security/System event export (CSV). Deterministic generation.

const SPRAY_IP = '172.16.40.23'
const VICTIM = 'j.ortiz'
const BACKDOOR = 'svc_updater'
const HOST = 'FILE01.corp.example.com'

const SPRAY_USERS = ['a.patel', 'b.ross', 'c.diaz', 'd.okafor', 'e.walsh', 'f.romero', 'g.lee', 'h.schmidt', 'i.novak', VICTIM,
  'k.berg', 'l.harmon', 'm.chen', 'n.silva', 'o.kowalski', 'p.reyes', 'q.adams', 'r.kim', 's.ito', 't.nguyen',
  'u.mensah', 'administrator', 'backup', 'scanner']
const NOT_EXIST = new Set(['backup', 'scanner'])

const pad = (n) => String(n).padStart(2, '0')
const iso = (sec) => `2026-11-04T${pad(Math.floor(sec / 3600))}:${pad(Math.floor((sec % 3600) / 60))}:${pad(sec % 60)}Z`

function build() {
  const rows = []
  const ev = (sec, id, account, type, ip, details) => rows.push({ sec, n: rows.length, line: [iso(sec), id, HOST, account, type, ip, details].join(',') })
  const h = (hh, mm, ss = 0) => hh * 3600 + mm * 60 + ss

  // Background: monitoring account every 5 minutes, 01:00 - 03:30
  let logon = 0x3a0010
  for (let s = h(1, 0, 4); s < h(3, 30); s += 300) {
    const id = `0x${(logon += 0x1f3).toString(16).toUpperCase()}`
    ev(s, 4624, 'CORP\\svc_monitor', 3, '10.30.2.50', `LogonID=${id} AuthPackage=Kerberos WorkstationName=MON01`)
    ev(s + 2, 4634, 'CORP\\svc_monitor', 3, '10.30.2.50', `LogonID=${id} An account was logged off`)
  }
  // Nightly backup: privileged logon is expected here
  ev(h(1, 15, 2), 4624, 'CORP\\svc_backup', 3, '10.30.2.40', 'LogonID=0x3B71A0 AuthPackage=Kerberos WorkstationName=BKP01')
  ev(h(1, 15, 2), 4672, 'CORP\\svc_backup', '', '', 'LogonID=0x3B71A0 Privileges=SeBackupPrivilege SeRestorePrivilege SeSecurityPrivilege')
  ev(h(1, 58, 40), 4634, 'CORP\\svc_backup', 3, '10.30.2.40', 'LogonID=0x3B71A0 An account was logged off')
  // Defender platform update installs its driver: a benign 7045
  ev(h(1, 31, 12), 7045, 'NT AUTHORITY\\SYSTEM', '', '', 'Service Name: MpKslDrv; Image Path: \\??\\C:\\ProgramData\\Microsoft\\Windows Defender\\Definition Updates\\{5C2E9F41}\\MpKslDrv.sys; Service Type: kernel mode driver; Start Type: manual start; Account: -')
  ev(h(1, 31, 13), 7036, 'NT AUTHORITY\\SYSTEM', '', '', 'The MpKslDrv service entered the running state.')
  // A night-shift user mistypes a password twice, then succeeds
  ev(h(1, 47, 10), 4625, 'CORP\\r.kim', 3, '10.30.1.15', 'Status=0xC000006D SubStatus=0xC000006A AuthPackage=NTLM WorkstationName=WS-0215')
  ev(h(1, 47, 18), 4625, 'CORP\\r.kim', 3, '10.30.1.15', 'Status=0xC000006D SubStatus=0xC000006A AuthPackage=NTLM WorkstationName=WS-0215')
  ev(h(1, 47, 29), 4624, 'CORP\\r.kim', 3, '10.30.1.15', 'LogonID=0x3C0442 AuthPackage=Kerberos WorkstationName=WS-0215')
  ev(h(2, 20, 5), 4634, 'CORP\\r.kim', 3, '10.30.1.15', 'LogonID=0x3C0442 An account was logged off')
  // Stale credentials on a scanner hitting the share
  for (const m of [5, 35, 65, 95]) ev(h(1, 0, 30) + m * 60, 4625, 'CORP\\svc_scan', 3, '10.30.3.18', 'Status=0xC000006D SubStatus=0xC000006A AuthPackage=NTLM WorkstationName=MFP-3F')

  // The password spray: two rounds, one password per round, ~3 s per account
  const fail = (s, u) => ev(s, 4625, `CORP\\${u}`, 3, SPRAY_IP, `Status=0xC000006D SubStatus=${NOT_EXIST.has(u) ? '0xC0000064' : '0xC000006A'} AuthPackage=NTLM WorkstationName=WIN-K7QRN0P3`)
  let s = h(2, 10, 5)
  for (const u of SPRAY_USERS) { fail(s, u); s += 3 }
  s = h(2, 41, 2)
  for (const u of SPRAY_USERS) {
    if (u === VICTIM) {
      ev(s, 4624, `CORP\\${VICTIM}`, 3, SPRAY_IP, 'LogonID=0x5A3F21 AuthPackage=NTLM WorkstationName=WIN-K7QRN0P3 ElevatedToken=Yes')
      ev(s, 4672, `CORP\\${VICTIM}`, '', '', 'LogonID=0x5A3F21 Privileges=SeSecurityPrivilege SeBackupPrivilege SeRestorePrivilege SeTakeOwnershipPrivilege SeDebugPrivilege SeImpersonatePrivilege')
    } else fail(s, u)
    s += 3
  }
  // Backdoor account, then PsExec with it, then cover tracks
  ev(h(2, 43, 2), 4720, `CORP\\${VICTIM}`, '', '', `New account: FILE01\\${BACKDOOR}; SAM Account Name: ${BACKDOOR}; SubjectLogonID=0x5A3F21`)
  ev(h(2, 43, 3), 4722, `CORP\\${VICTIM}`, '', '', `Enabled account: FILE01\\${BACKDOOR}`)
  ev(h(2, 43, 9), 4732, `CORP\\${VICTIM}`, '', '', `Member: FILE01\\${BACKDOOR}; Group: BUILTIN\\Administrators`)
  ev(h(2, 44, 50), 4634, `CORP\\${VICTIM}`, 3, SPRAY_IP, 'LogonID=0x5A3F21 An account was logged off')
  ev(h(2, 45, 20), 4624, `FILE01\\${BACKDOOR}`, 3, SPRAY_IP, 'LogonID=0x5B0C77 AuthPackage=NTLM WorkstationName=WIN-K7QRN0P3 ElevatedToken=Yes')
  ev(h(2, 45, 20), 4672, `FILE01\\${BACKDOOR}`, '', '', 'LogonID=0x5B0C77 Privileges=SeSecurityPrivilege SeBackupPrivilege SeRestorePrivilege SeTakeOwnershipPrivilege SeDebugPrivilege SeImpersonatePrivilege')
  ev(h(2, 45, 22), 7045, `FILE01\\${BACKDOOR}`, '', '', 'Service Name: PSEXESVC; Image Path: %SystemRoot%\\PSEXESVC.exe; Service Type: user mode service; Start Type: demand start; Account: LocalSystem')
  ev(h(2, 45, 23), 7036, 'NT AUTHORITY\\SYSTEM', '', '', 'The PSEXESVC service entered the running state.')
  ev(h(2, 52, 31), 7036, 'NT AUTHORITY\\SYSTEM', '', '', 'The PSEXESVC service entered the stopped state.')
  ev(h(2, 53, 10), 1102, `FILE01\\${BACKDOOR}`, '', '', 'The audit log was cleared. SubjectLogonID=0x5B0C77')
  ev(h(2, 53, 40), 4634, `FILE01\\${BACKDOOR}`, 3, SPRAY_IP, 'LogonID=0x5B0C77 An account was logged off')

  rows.sort((a, b) => a.sec - b.sec || a.n - b.n)
  return `TimeCreated,EventID,Computer,Account,LogonType,SourceIP,Details\n${rows.map((r) => r.line).join('\n')}\n`
}

const PATH = '/home/analyst/evidence/FILE01_events.csv'

export default {
  id: 'win-lateral',
  title: 'Password spray to lateral movement on Windows',
  objectives: ['1.2', '3.3'],
  difficulty: 'Advanced',
  minutes: 20,
  scenario: `At 03:05 UTC the SIEM alerted "Security audit log cleared" on ${HOST}. Luckily the SIEM had already forwarded the Security and System events, so you have them as CSV. Columns: TimeCreated, EventID, Computer, Account (the account that logged on or performed the action), LogonType, SourceIP, Details. Fields are comma-separated, and the Details field never contains commas, so \`cut -d, -f\` and \`awk -F,\` work. 172.16.40.0/24 is the guest Wi-Fi range. Workstations use 10.30.1.0/24, and servers use 10.30.2.0/24 and 10.30.3.0/24.`,
  files: { [PATH]: build() },
  artifacts: [{ id: 'csv', title: 'FILE01_events.csv', file: PATH }],
  hints: [
    `awk -F, '$2 == 4625 {print $6}' ${PATH} | sort | uniq -c | sort -rn`,
    `awk -F, '$2 == 4625 && $6 == "${SPRAY_IP}" {print $4}' ${PATH} | sort -u | wc -l`,
    `awk -F, '$2 == 4624 && $6 == "${SPRAY_IP}"' ${PATH}`,
    `grep -E ",(4720|4732|7045|1102)," ${PATH}`,
  ],
  tasks: [
    {
      id: 'ip', type: 'input',
      prompt: 'What source IP performed the password spray?',
      answer: [SPRAY_IP],
      cmd: `awk -F, '$2 == 4625 {print $6}' ${PATH} | sort | uniq -c | sort -rn`,
      explain: `${SPRAY_IP} produced 47 failed logons (4625). It sits on the guest Wi-Fi range and reports the workstation name WIN-K7QRN0P3, an unmanaged machine with a default Windows hostname. The other failures are a user typing their password wrong (10.30.1.15) and a scanner with a stale password (10.30.3.18, one account, every 30 minutes).`,
    },
    {
      id: 'distinct', type: 'input',
      prompt: `How many DISTINCT accounts did ${SPRAY_IP} try?`,
      answer: [String(SPRAY_USERS.length)],
      cmd: `awk -F, '$2 == 4625 && $6 == "${SPRAY_IP}" {print $4}' ${PATH} | sort -u | wc -l`,
      explain: `${SPRAY_USERS.length} accounts in two rounds about 30 minutes apart. That shape (many accounts, one password per round, a long pause between rounds) is password spraying, T1110.003. Count distinct accounts with \`sort -u | wc -l\`. Counting lines gives 47, because the round with the successful logon still has 23 failures. SubStatus 0xC0000064 means the user does not exist, and 0xC000006A means a wrong password for a real user.`,
    },
    {
      id: 'victim', type: 'input',
      prompt: 'Which account did the attacker compromise through the spray? (username only)',
      answer: [VICTIM, `CORP\\${VICTIM}`, `corp\\${VICTIM}`],
      cmd: `awk -F, '$2 == 4624 && $6 == "${SPRAY_IP}"' ${PATH}`,
      explain: `The first 4624 from ${SPRAY_IP} is CORP\\${VICTIM}, LogonType 3 (network), in the middle of the second spray round. A 4672 follows in the same second for the same LogonID. Special privileges such as SeDebugPrivilege mean ${VICTIM} is an administrator on FILE01, which makes it a high-value catch. The later 4624 for ${BACKDOOR} is the attacker using the account they created, not the spray.`,
    },
    {
      id: 'backdoor', type: 'input',
      prompt: 'What is the name of the account the attacker created?',
      answer: [BACKDOOR, `FILE01\\${BACKDOOR}`],
      cmd: `grep ",4720," ${PATH}`,
      explain: `4720 (a user account was created) at 02:43:02 by CORP\\${VICTIM} creates FILE01\\${BACKDOOR}. Seven seconds later, 4732 adds it to BUILTIN\\Administrators. A name that imitates a service account is a classic way to blend in (T1136.001, Create Account: Local Account).`,
    },
    {
      id: 'timeline', type: 'order',
      prompt: 'Put the attack in chronological order.',
      items: [
        'Failed logons against many accounts from one source',
        `Network logon succeeds as ${VICTIM}`,
        'Special privileges assigned to that logon',
        `Local account ${BACKDOOR} created`,
        `${BACKDOOR} added to Administrators`,
        'PSEXESVC service installed',
        'Security audit log cleared',
      ],
      explain: 'Credential access (the spray), initial access with valid accounts, persistence (a new admin account), lateral movement and execution (PsExec installs PSEXESVC on the target, Event 7045 in the System log), then defense evasion (1102). The clear happened last, but because the SIEM forwarded the events in near real time, clearing the local log did not erase this timeline. That is a strong argument for central log collection.',
    },
    {
      id: 'eventids', type: 'grid',
      prompt: 'Map each Event ID to its meaning.',
      columns: [{
        key: 'm', label: 'Meaning',
        options: ['An account failed to log on', 'An account was successfully logged on', 'Special privileges assigned to new logon', 'A user account was created',
          'A member was added to a security-enabled local group', 'A service was installed in the system', 'The audit log was cleared', 'A user account was locked out'],
      }],
      rows: [
        { label: '4625', answer: { m: 'An account failed to log on' } },
        { label: '4624', answer: { m: 'An account was successfully logged on' } },
        { label: '4672', answer: { m: 'Special privileges assigned to new logon' } },
        { label: '4720', answer: { m: 'A user account was created' } },
        { label: '4732', answer: { m: 'A member was added to a security-enabled local group' } },
        { label: '7045', answer: { m: 'A service was installed in the system' } },
        { label: '1102', answer: { m: 'The audit log was cleared' } },
      ],
      explain: 'Learn these by heart for the exam. 4740 is account lockout, which never fired here. 4728 and 4756 are additions to global and universal groups (domain), while 4732 is a local group. 7045 is in the System log. Not every 7045 is bad: the MpKslDrv driver at 01:31 is a Defender update. PSEXESVC, or a service whose image path runs %COMSPEC% or cmd.exe /c, points to remote execution tooling.',
    },
    {
      id: 'lockout', type: 'single',
      prompt: 'The domain locks an account after 5 bad passwords in 30 minutes. Why didn\'t the spray lock anyone out?',
      options: [
        'NTLM logons do not count toward lockout',
        'Each account received only one wrong password per round, and the rounds were about 30 minutes apart, so no account came close to the threshold',
        'The attacker used Kerberos pre-authentication to bypass the counter',
        'Lockout only applies to interactive (type 2) logons',
      ],
      answer: 1,
      explain: 'Spraying inverts brute force: one or two passwords across many users, timed to stay under the lockout threshold and observation window. That is why per-account lockout doesn\'t stop it, and detection has to count failures per SOURCE across distinct accounts. Defenses: MFA, banned-password lists (Season+Year passwords), smart lockout, and alerts like "one source, more than 10 distinct accounts failing in 5 minutes". Bad NTLM and network logons DO count toward lockout.',
    },
  ],
}
