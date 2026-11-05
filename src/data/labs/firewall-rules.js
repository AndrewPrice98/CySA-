// Lab: audit a broken edge ruleset, then rebuild it from business requirements.
// The grid is the classic CompTIA "configure the firewall" PBQ: one rule per row, top to bottom.

const diagram = `                         INTERNET
                            |
                  outside: 203.0.113.1/24
               +---------------------------+
               |   FW-01 (edge firewall)   |   first match wins, top to bottom
               +---------------------------+
                 |                       |
       DMZ 172.16.10.0/24         INSIDE 10.10.0.0/16
                 |                       |
   web-01  172.16.10.10           user LAN       10.10.20.0/24
   (public site, NAT from         admin jump box 10.10.5.10
    203.0.113.10)                 internal DNS   10.10.0.53
                                  db-01 (MS SQL) 10.10.50.20
                                  SIEM collector 10.10.60.5 (syslog)
`

const requirements = `R1  Anyone on the internet can reach the public website on web-01, over HTTPS only.
R2  web-01 reads and writes orders in the SQL Server database on db-01. Nothing else in
    the DMZ or on the internet may reach db-01.
R3  web-01 forwards its system and web-server logs to the SIEM collector (classic syslog).
R4  Administrators manage web-01 over SSH, and only from the admin jump box.
R5  The internal DNS server resolves internet names through the ISP's resolvers.
R6  Threat intel: an active malware family calls home on TCP 4444. No user LAN host may
    reach the internet on that port.
R7  Users on the user LAN may browse and use SaaS over any TCP port (egress filtering is
    scheduled for next quarter, so outbound TCP stays open for now).
R8  Everything not explicitly allowed is denied. No remote desktop, SMB or database access
    from the internet.
`

const current = `#  Action  Proto  Source           Destination      Port   Comment
1  Allow   TCP    any              172.16.10.10     443    Public website
2  Allow   TCP    any              172.16.10.10     22     Vendor support (temporary, 2024)
3  Allow   TCP    10.10.20.0/24    any              any    User outbound
4  Deny    TCP    10.10.20.0/24    any              4444   Block malware C2
5  Allow   TCP    any              10.10.50.20      1433   App database
6  Allow   UDP    172.16.10.10     10.10.60.5       514    web-01 syslog to SIEM
7  Deny    any    any              any              any    Cleanup
`

export default {
  id: 'firewall-rules',
  title: 'Configure an edge firewall ruleset',
  objectives: ['1.1', '3.3'],
  difficulty: 'Core',
  minutes: 15,
  scenario: 'An audit found that the edge firewall FW-01 no longer matches the network design. Before the change window tonight, review the current ruleset, then build a replacement that meets every business requirement and nothing more. FW-01 evaluates rules top to bottom and the first match wins.',
  artifacts: [
    { id: 'diagram', title: 'Network diagram', content: diagram },
    { id: 'reqs', title: 'Business requirements', content: requirements },
    { id: 'current', title: 'Current FW-01 ruleset', content: current },
  ],
  tasks: [
    {
      id: 'audit', type: 'lines', artifact: 'current',
      prompt: 'Audit the current ruleset. Select every rule that allows more than the requirements permit, plus any rule that can never match because a rule above it catches the same traffic first.',
      answer: [2, 4, 5],
      explain: 'Rule 2 opens SSH on web-01 to the whole internet (R4 says jump box only), and a "temporary" vendor rule from 2024 is a classic stale rule. Rule 4 is shadowed: rule 3 already allows all user TCP outbound, including 4444, so the deny is never reached. Rule 5 lets anyone, including the internet, reach SQL Server on db-01 (R2). Rules 1, 6 and 7 are correct. Rule audits look for exactly these three problems: overly broad sources, shadowed rules, and stale exceptions.',
    },
    {
      id: 'build', type: 'grid',
      prompt: 'Build the replacement ruleset. Source and destination are fixed for each row; set the Action, Protocol and Port so the rules, read top to bottom, meet R1 to R8.',
      columns: [
        { key: 'action', label: 'Action', options: ['Allow', 'Deny'] },
        { key: 'proto', label: 'Protocol', options: ['TCP', 'UDP', 'Any'] },
        { key: 'port', label: 'Port', options: ['22', '53', '443', '514', '1433', '3389', '4444', 'Any'] },
      ],
      rows: [
        { label: '1. any (internet) -> web-01 172.16.10.10', answer: { action: 'Allow', proto: 'TCP', port: '443' } },
        { label: '2. jump box 10.10.5.10 -> web-01 172.16.10.10', answer: { action: 'Allow', proto: 'TCP', port: '22' } },
        { label: '3. web-01 172.16.10.10 -> db-01 10.10.50.20', answer: { action: 'Allow', proto: 'TCP', port: '1433' } },
        { label: '4. web-01 172.16.10.10 -> SIEM 10.10.60.5', answer: { action: 'Allow', proto: 'UDP', port: '514' } },
        { label: '5. DNS 10.10.0.53 -> any (internet)', answer: { action: 'Allow', proto: 'UDP', port: '53' } },
        { label: '6. user LAN 10.10.20.0/24 -> any (internet)', answer: { action: 'Deny', proto: 'TCP', port: '4444' } },
        { label: '7. user LAN 10.10.20.0/24 -> any (internet)', answer: { action: 'Allow', proto: 'TCP', port: 'Any' } },
        { label: '8. any -> any', answer: { action: 'Deny', proto: 'Any', port: 'Any' } },
      ],
      explain: 'HTTPS is TCP 443 (R1). SSH is TCP 22, limited to the jump box (R4). Microsoft SQL Server listens on TCP 1433, and only web-01 gets it (R2). Classic syslog is UDP 514 (R3). DNS lookups are UDP 53; resolvers fall back to TCP 53 for large responses, which you could add as a separate rule. Row 6 denies the C2 port and must sit ABOVE row 7, the broad user allow (R6, R7). Row 8 is the explicit cleanup deny (R8); writing it out, rather than trusting the implicit deny, lets you log what it drops. 3389 (RDP) never appears as an allow: the cleanup rule blocks it, and that is what R8 asks for.',
    },
    {
      id: 'ordering', type: 'single',
      prompt: 'Why must the Deny TCP 4444 rule sit above the "user LAN -> any, Allow TCP Any" rule?',
      options: [
        'Deny rules are always processed before allow rules, so the position does not actually matter',
        'The firewall stops at the first matching rule; if the broad allow came first, traffic to 4444 would match it and the deny would never be evaluated',
        'Rules lower in the list have a higher priority, so the deny should really be at the bottom',
        'Specific rules use less CPU, so they should be placed first for performance',
      ],
      answer: 1,
      explain: 'Firewall ACLs are first-match: the packet is compared to each rule in order and the first hit decides. A specific deny placed under a broader allow is "shadowed", which is exactly what was wrong with rules 3 and 4 in the old set. Some products do sort denies first, but you can\'t assume that; the CompTIA answer is "most specific first, cleanup deny last". Ordering for performance is a real secondary concern, but it never overrides correctness.',
    },
    {
      id: 'vendor', type: 'single',
      prompt: 'A database vendor asks for "Allow any -> db-01 TCP 1433" for two days so they can troubleshoot remotely. What is the best response?',
      options: [
        'Add the rule but restrict the source to the vendor\'s public IP address',
        'Add the rule exactly as asked and set a calendar reminder to remove it',
        'Refuse direct exposure; give the vendor time-limited, MFA-protected access through the VPN or jump box, with the session logged',
        'Move db-01 into the DMZ so the rule is not needed',
      ],
      answer: 2,
      explain: 'A database should never be directly reachable from the internet, even from one source IP: that address is shared by everyone at the vendor, and by anyone who compromises the vendor, and SQL Server becomes a target for every exploit and password attack that comes through it. Brokered, time-boxed access (VPN or ZTNA to the jump box, MFA, session recording) meets the need with least privilege and an audit trail. "Temporary" rules with reminders are how rule 2 in the old set survived since 2024. Moving the database into the DMZ increases its exposure.',
    },
    {
      id: 'logging', type: 'multi',
      prompt: 'Which events should FW-01 log and forward to the SIEM? Select all that apply.',
      options: [
        'Hits on the Deny TCP 4444 rule, with the internal source address',
        'Connections dropped by the cleanup rule',
        'SSH sessions allowed from the jump box to web-01',
        'Configuration changes and administrator logins on FW-01 itself',
        'The full packet payload of every allowed HTTPS session to web-01',
        'Every successful DNS lookup made by the internal DNS server, at debug level',
      ],
      answer: [0, 1, 2, 3],
      explain: 'A hit on the C2 deny means an internal host is probably infected, so it is a high-value alert. Cleanup-rule drops show scans and misconfigurations. Privileged access (SSH to the DMZ) and changes to the firewall itself are needed for accountability and are required by most compliance frameworks. Full HTTPS payloads are encrypted, huge and add privacy risk; that belongs to targeted packet capture, not firewall logging. Debug-level DNS logging on the firewall adds noise; DNS visibility is better collected from the DNS server or a resolver log. Whatever you log, sync FW-01 to NTP so its timestamps line up with the SIEM.',
    },
    {
      id: 'syslog', type: 'single',
      prompt: 'The auditor notes that row 4 of your new ruleset sends web-01\'s logs over classic syslog (UDP 514). What is the main weakness, and the usual fix?',
      options: [
        'UDP 514 is too slow; switch to ICMP',
        'Messages are cleartext and can be silently lost or spoofed; use syslog over TLS (TCP 6514) or a log agent with an encrypted, acknowledged channel',
        'Syslog cannot carry web-server logs; install a second SIEM for them',
        'UDP 514 is only for Windows; Linux hosts must use TCP 3389',
      ],
      answer: 1,
      explain: 'Classic syslog over UDP has no encryption, no delivery guarantee and no sender authentication, so logs can be read in transit, dropped under load or forged. RFC 5425 defines syslog over TLS on TCP 6514; most SIEM agents (for example the Elastic and Splunk forwarders) also offer encrypted, acknowledged transport. If you change it, update the firewall rule to TCP 6514.',
    },
  ],
}
