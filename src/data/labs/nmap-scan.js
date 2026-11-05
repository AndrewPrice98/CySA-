// Lab: read nmap -sV -O output (normal and grepable) for a server VLAN, then choose scan methods.
// Both files describe the same six hosts, so terminal answers can be checked either way.

const T = '\t'

const nmapOut = `# Nmap 7.94SVN scan initiated Tue Nov  3 09:12:04 2026 as: nmap -sS -sV -O -oA scans/internal-sweep 10.20.30.0/24
Nmap scan report for sw-core01.corp.example (10.20.30.2)
Host is up (0.0011s latency).
Not shown: 998 closed tcp ports (reset)
PORT   STATE SERVICE VERSION
22/tcp open  ssh     Cisco SSH 1.25 (protocol 2.0)
23/tcp open  telnet  Cisco router telnetd
Device type: switch
Running: Cisco IOS 15.X
OS CPE: cpe:/o:cisco:ios:15
OS details: Cisco IOS 15.0 - 15.5
Network Distance: 2 hops
Service Info: OS: IOS; Device: switch; CPE: cpe:/o:cisco:ios

Nmap scan report for dc01.corp.example (10.20.30.5)
Host is up (0.00052s latency).
Not shown: 988 filtered tcp ports (no-response)
PORT     STATE SERVICE       VERSION
53/tcp   open  domain        Simple DNS Plus
88/tcp   open  kerberos-sec  Microsoft Windows Kerberos (server time: 2026-11-03 09:13:41Z)
135/tcp  open  msrpc         Microsoft Windows RPC
139/tcp  open  netbios-ssn   Microsoft Windows netbios-ssn
389/tcp  open  ldap          Microsoft Windows Active Directory LDAP (Domain: corp.example0., Site: Default-First-Site-Name)
445/tcp  open  microsoft-ds?
464/tcp  open  kpasswd5?
593/tcp  open  ncacn_http    Microsoft Windows RPC over HTTP 1.0
636/tcp  open  tcpwrapped
3268/tcp open  ldap          Microsoft Windows Active Directory LDAP (Domain: corp.example0., Site: Default-First-Site-Name)
3269/tcp open  tcpwrapped
3389/tcp open  ms-wbt-server Microsoft Terminal Services
Warning: OSScan results may be unreliable because we could not find at least 1 open and 1 closed port
Aggressive OS guesses: Microsoft Windows Server 2019 (96%), Microsoft Windows Server 2016 (92%), Microsoft Windows 10 1709 - 21H2 (89%)
No exact OS matches for host (test conditions non-ideal).
Network Distance: 2 hops
Service Info: Host: DC01; OS: Windows; CPE: cpe:/o:microsoft:windows

Nmap scan report for files01.corp.example (10.20.30.12)
Host is up (0.00061s latency).
Not shown: 996 filtered tcp ports (no-response)
PORT     STATE SERVICE       VERSION
135/tcp  open  msrpc         Microsoft Windows RPC
139/tcp  open  netbios-ssn   Microsoft Windows netbios-ssn
445/tcp  open  microsoft-ds?
3389/tcp open  ms-wbt-server Microsoft Terminal Services
Warning: OSScan results may be unreliable because we could not find at least 1 open and 1 closed port
Aggressive OS guesses: Microsoft Windows Server 2016 (94%), Microsoft Windows Server 2019 (91%)
No exact OS matches for host (test conditions non-ideal).
Network Distance: 2 hops
Service Info: OS: Windows; CPE: cpe:/o:microsoft:windows

Nmap scan report for legacy-ftp01.corp.example (10.20.30.21)
Host is up (0.00094s latency).
Not shown: 996 closed tcp ports (reset)
PORT    STATE SERVICE     VERSION
21/tcp  open  ftp         vsftpd 2.3.4
22/tcp  open  ssh         OpenSSH 7.4 (protocol 2.0)
139/tcp open  netbios-ssn Samba smbd 3.X - 4.X (workgroup: CORP)
445/tcp open  netbios-ssn Samba smbd 3.X - 4.X (workgroup: CORP)
Device type: general purpose
Running: Linux 3.X|4.X
OS CPE: cpe:/o:linux:linux_kernel:3 cpe:/o:linux:linux_kernel:4
OS details: Linux 3.10 - 4.11
Network Distance: 2 hops
Service Info: Host: LEGACY-FTP01; OS: Unix

Nmap scan report for web01.corp.example (10.20.30.40)
Host is up (0.00048s latency).
Not shown: 997 closed tcp ports (reset)
PORT    STATE SERVICE  VERSION
22/tcp  open  ssh      OpenSSH 8.9p1 Ubuntu 3ubuntu0.10 (Ubuntu Linux; protocol 2.0)
80/tcp  open  http     nginx 1.18.0 (Ubuntu)
443/tcp open  ssl/http nginx 1.18.0 (Ubuntu)
Device type: general purpose
Running: Linux 4.X|5.X
OS CPE: cpe:/o:linux:linux_kernel:4 cpe:/o:linux:linux_kernel:5
OS details: Linux 4.15 - 5.19
Network Distance: 2 hops
Service Info: OS: Linux; CPE: cpe:/o:linux:linux_kernel

Nmap scan report for ws-fin-07.corp.example (10.20.30.55)
Host is up (0.0013s latency).
Not shown: 997 filtered tcp ports (no-response)
PORT    STATE SERVICE       VERSION
135/tcp open  msrpc         Microsoft Windows RPC
139/tcp open  netbios-ssn   Microsoft Windows netbios-ssn
445/tcp open  microsoft-ds?
Warning: OSScan results may be unreliable because we could not find at least 1 open and 1 closed port
Aggressive OS guesses: Microsoft Windows 10 1709 - 21H2 (93%), Microsoft Windows 11 21H2 (90%)
No exact OS matches for host (test conditions non-ideal).
Network Distance: 2 hops
Service Info: OS: Windows; CPE: cpe:/o:microsoft:windows

OS and Service detection performed. Please report any incorrect results at https://nmap.org/submit/ .
# Nmap done at Tue Nov  3 09:18:27 2026 -- 256 IP addresses (6 hosts up) scanned in 383.41 seconds
`

// Grepable output: one "Status" line and one "Ports" line per host, fields separated by tabs
const hosts = [
  ['10.20.30.2', 'sw-core01.corp.example', '22/open/tcp//ssh//Cisco SSH 1.25 (protocol 2.0)/, 23/open/tcp//telnet//Cisco router telnetd/', 'closed (998)', 'Cisco IOS 15.0 - 15.5'],
  ['10.20.30.5', 'dc01.corp.example', '53/open/tcp//domain//Simple DNS Plus/, 88/open/tcp//kerberos-sec//Microsoft Windows Kerberos (server time: 2026-11-03 09:13:41Z)/, 135/open/tcp//msrpc//Microsoft Windows RPC/, 139/open/tcp//netbios-ssn//Microsoft Windows netbios-ssn/, 389/open/tcp//ldap//Microsoft Windows Active Directory LDAP (Domain: corp.example0., Site: Default-First-Site-Name)/, 445/open/tcp//microsoft-ds?///, 464/open/tcp//kpasswd5?///, 593/open/tcp//ncacn_http//Microsoft Windows RPC over HTTP 1.0/, 636/open/tcp//tcpwrapped///, 3268/open/tcp//ldap//Microsoft Windows Active Directory LDAP (Domain: corp.example0., Site: Default-First-Site-Name)/, 3269/open/tcp//tcpwrapped///, 3389/open/tcp//ms-wbt-server//Microsoft Terminal Services/', 'filtered (988)', null],
  ['10.20.30.12', 'files01.corp.example', '135/open/tcp//msrpc//Microsoft Windows RPC/, 139/open/tcp//netbios-ssn//Microsoft Windows netbios-ssn/, 445/open/tcp//microsoft-ds?///, 3389/open/tcp//ms-wbt-server//Microsoft Terminal Services/', 'filtered (996)', null],
  ['10.20.30.21', 'legacy-ftp01.corp.example', '21/open/tcp//ftp//vsftpd 2.3.4/, 22/open/tcp//ssh//OpenSSH 7.4 (protocol 2.0)/, 139/open/tcp//netbios-ssn//Samba smbd 3.X - 4.X (workgroup: CORP)/, 445/open/tcp//netbios-ssn//Samba smbd 3.X - 4.X (workgroup: CORP)/', 'closed (996)', 'Linux 3.10 - 4.11'],
  ['10.20.30.40', 'web01.corp.example', '22/open/tcp//ssh//OpenSSH 8.9p1 Ubuntu 3ubuntu0.10 (Ubuntu Linux; protocol 2.0)/, 80/open/tcp//http//nginx 1.18.0 (Ubuntu)/, 443/open/tcp//ssl|http//nginx 1.18.0 (Ubuntu)/', 'closed (997)', 'Linux 4.15 - 5.19'],
  ['10.20.30.55', 'ws-fin-07.corp.example', '135/open/tcp//msrpc//Microsoft Windows RPC/, 139/open/tcp//netbios-ssn//Microsoft Windows netbios-ssn/, 445/open/tcp//microsoft-ds?///', 'filtered (997)', null],
]

function gnmap() {
  const out = ['# Nmap 7.94SVN scan initiated Tue Nov  3 09:12:04 2026 as: nmap -sS -sV -O -oA scans/internal-sweep 10.20.30.0/24']
  for (const [ip, name, ports, ignored, os] of hosts) {
    out.push(`Host: ${ip} (${name})${T}Status: Up`)
    out.push(`Host: ${ip} (${name})${T}Ports: ${ports}${T}Ignored State: ${ignored}${os ? `${T}OS: ${os}` : ''}`)
  }
  out.push('# Nmap done at Tue Nov  3 09:18:27 2026 -- 256 IP addresses (6 hosts up) scanned in 383.41 seconds')
  return `${out.join('\n')}\n`
}

export default {
  id: 'nmap-scan',
  title: 'Read an nmap service and OS scan',
  objectives: ['2.1', '2.2'],
  difficulty: 'Core',
  minutes: 15,
  scenario: 'You ran an authorized discovery scan of the server VLAN 10.20.30.0/24 from the SOC jump box, saving normal (.nmap) and grepable (.gnmap) output. Use the terminal to pull facts out of the results, flag the riskiest services, then help plan the next round of scanning.',
  files: {
    '/home/analyst/scans/internal-sweep.nmap': nmapOut,
    '/home/analyst/scans/internal-sweep.gnmap': gnmap(),
  },
  artifacts: [
    { id: 'nmap', title: 'internal-sweep.nmap', file: '/home/analyst/scans/internal-sweep.nmap' },
    { id: 'gnmap', title: 'internal-sweep.gnmap', file: '/home/analyst/scans/internal-sweep.gnmap' },
  ],
  hints: [
    'grep "23/open" scans/internal-sweep.gnmap',
    'grep -c "445/open" scans/internal-sweep.gnmap',
    'grep -E "^[0-9]+/tcp" scans/internal-sweep.nmap | awk \'{print $1}\' | sort | uniq -c | sort -rn',
    'grep "Nmap scan report" scans/internal-sweep.nmap',
  ],
  tasks: [
    {
      id: 'telnet', type: 'input',
      prompt: 'Which host has Telnet open? Give its IP address.',
      answer: ['10.20.30.2', 'sw-core01', 'sw-core01.corp.example'],
      cmd: 'grep "23/open" scans/internal-sweep.gnmap',
      explain: 'The grepable file puts each host\'s ports on one line, so `grep "23/open" scans/internal-sweep.gnmap` returns the host and its ports together: 10.20.30.2, the core switch. Telnet sends the management password in cleartext; disable it and keep SSH (with `transport input ssh` on Cisco IOS). In the .nmap file the port and the host are on different lines, which is why .gnmap is the better format for grep.',
    },
    {
      id: 'smb', type: 'input',
      prompt: 'How many hosts expose SMB (TCP 445)?',
      answer: ['4', 'four'],
      cmd: 'grep -c "445/open" scans/internal-sweep.gnmap',
      explain: 'Four: dc01, files01, legacy-ftp01 and ws-fin-07. The trap is legacy-ftp01: nmap labels its port 445 "netbios-ssn" because it is Samba, so `grep -c microsoft-ds` returns only 3. Count by port number, not by service name. A workstation (ws-fin-07) accepting SMB from the server VLAN is also worth a look, since SMB is the main lateral-movement path for ransomware.',
    },
    {
      id: 'backdoor', type: 'input',
      prompt: 'One service banner matches a release that was distributed with a backdoor. Enter the product and version exactly as -sV reports them (for example "nginx 1.18.0").',
      answer: ['vsftpd 2.3.4', 'vsftpd-2.3.4', 'vsftpd v2.3.4', 'vsftpd2.3.4'],
      cmd: 'grep ftp scans/internal-sweep.nmap',
      explain: 'vsftpd 2.3.4 on legacy-ftp01 (10.20.30.21). In 2011 the source archive on the official download site was replaced with a backdoored copy (CVE-2011-2523): a username containing ":)" opens a root shell on TCP 6200. Treat it as critical whatever its CVSS context, and confirm by checking the package, not by triggering the backdoor on a production host. OpenSSH 7.4 on the same box is old too, but it carries no known backdoor.',
    },
    {
      id: 'dc', type: 'input',
      prompt: 'Which host is the Active Directory domain controller? Give its IP address.',
      answer: ['10.20.30.5', 'dc01', 'dc01.corp.example'],
      cmd: 'grep kerberos scans/internal-sweep.gnmap',
      explain: 'Kerberos (88), LDAP (389), global catalog LDAP (3268) and kpasswd (464) together are the fingerprint of a domain controller: 10.20.30.5. Fingerprinting by port combination is faster and more reliable than the OS guess, which nmap itself marks as unreliable here because every unanswered port was filtered.',
    },
    {
      id: 'backport', type: 'single',
      prompt: 'A vulnerability scanner flags web01 because "OpenSSH 8.9p1" is older than the upstream release that fixed a CVE. The banner says "OpenSSH 8.9p1 Ubuntu 3ubuntu0.10". What should you do before opening a remediation ticket?',
      options: [
        'Open the ticket: the version number is below the fixed release, so the host is vulnerable',
        'Check the Ubuntu security notice or package changelog (or run a credentialed scan), because distributions backport fixes without changing the upstream version',
        'Mark it a false negative and suppress the plugin',
        'Run the public exploit against web01 to see whether it works',
      ],
      answer: 1,
      explain: 'Ubuntu, Debian and Red Hat patch security bugs into the version they shipped, so "8.9p1" can be fully patched. The package revision (3ubuntu0.10) is what matters. A banner-only match is a common source of false positives; a credentialed scan that reads the installed package, or the distro\'s security tracker, settles it. It would be a false positive, not a false negative. Running exploits against production needs explicit authorization and is not a validation step.',
    },
    {
      id: 'methods', type: 'grid',
      prompt: 'Choose the scanning approach that best fits each requirement.',
      columns: [{ key: 'method', label: 'Approach', options: ['Credentialed', 'Non-credentialed', 'Agent-based', 'Passive', 'External', 'Internal'] }],
      rows: [
        { label: 'PLCs on the plant OT network have crashed when probed in the past', answer: { method: 'Passive' } },
        { label: 'Find missing patches and weak registry settings on Windows servers with the fewest false positives', answer: { method: 'Credentialed' } },
        { label: 'Remote staff laptops that are rarely on the VPN when the weekly scan runs', answer: { method: 'Agent-based' } },
        { label: 'See what an attacker on the internet sees on the public IP range (quarterly PCI DSS ASV scan)', answer: { method: 'External' } },
        { label: 'Show what an unauthenticated attacker who is already on the network could find without any logins', answer: { method: 'Non-credentialed' } },
        { label: 'Verify from a host on the user VLAN that segmentation blocks access to the server VLAN', answer: { method: 'Internal' } },
      ],
      explain: 'Fragile OT and ICS devices get passive monitoring (watching a SPAN or TAP copy of traffic) because active probes can crash them. Credentialed scans log in and read installed packages and settings, which cuts the false positives that banner matching causes. Agents report from wherever the laptop is, with no network sweep needed. PCI DSS requires quarterly external scans by an Approved Scanning Vendor. A non-credentialed scan shows the attacker\'s-eye view. Segmentation testing has to be run from inside, on the source network.',
    },
    {
      id: 'synscan', type: 'single',
      prompt: 'The scan used -sS. How does it differ from -sT?',
      options: [
        '-sS scans UDP ports; -sT scans TCP ports',
        '-sS sends a SYN and resets the connection after the SYN/ACK without completing the handshake (needs raw-socket privileges); -sT completes the full TCP handshake through the OS connect() call',
        '-sS is a service-version scan; -sT is a traceroute',
        '-sS completes the full handshake so it is more accurate; -sT only sends SYN packets',
      ],
      answer: 1,
      explain: '-sS is the "half-open" SYN scan: SYN out, SYN/ACK back means open, then nmap sends RST instead of the final ACK. It is fast and is the default when nmap runs as root. -sT uses the operating system\'s connect(), completing the three-way handshake, so it works without privileges but is more likely to appear in the target application\'s logs. UDP is -sU, version detection is -sV, and OS detection is -O.',
    },
  ],
}
