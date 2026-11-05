// Lab: DNS tunneling and a DGA in a resolver log (Unbound "log-replies" format via syslog).
// Deterministic: names and timings come from a seeded PRNG, never Math.random.

const TUNNEL_HOST = '10.20.30.44'
const TUNNEL_DOMAIN = 'syncstat.example'
const DGA_HOST = '10.20.30.61'
const DGA_HITS_BEFORE_LIVE = 37

function prng(seed) {
  let s = seed >>> 0
  return () => {
    s = (Math.imul(s, 1664525) + 1013904223) >>> 0
    return s / 4294967296
  }
}

const pad = (n) => String(n).padStart(2, '0')
const clock = (sec) => `${pad(Math.floor(sec / 3600))}:${pad(Math.floor((sec % 3600) / 60))}:${pad(Math.floor(sec % 60))}`

function build() {
  const rand = prng(53)
  const between = (a, b) => a + Math.floor(rand() * (b - a + 1))
  const pick = (arr) => arr[Math.floor(rand() * arr.length)]
  const rows = []
  const q = (sec, client, name, type, rcode, size, fresh = false) => rows.push({
    sec,
    line: `Nov  4 ${clock(sec)} resolver01 unbound: [1123:0] info: ${client} ${name}. ${type} IN ${rcode} ${(0.0004 + rand() * 0.09).toFixed(6)} ${!fresh && rand() < 0.4 ? 1 : 0} ${size}`,
  })
  const T0 = 10 * 3600

  // Normal workstation lookups
  const hosts = ['10.20.30.12', '10.20.30.17', '10.20.30.23', '10.20.30.35', '10.20.30.48', '10.20.30.52', TUNNEL_HOST, DGA_HOST]
  const names = ['www.example.com', 'login.example.com', 'cdn.example.net', 'mail.example.net', 'teams.example.net', 'api.example.com',
    'updates.example.com', 'static.example.net', 'intranet.corp.example.com', 'fileshare.corp.example.com', 'ocsp.example.net', 'news.example.com']
  for (let i = 0; i < 96; i++) {
    const sec = T0 + rand() * 3600
    const h = pick(hosts)
    const n = pick(names)
    q(sec, h, n, 'A', 'NOERROR', between(60, 140))
    if (rand() < 0.35) q(sec + 0.01, h, n, 'AAAA', 'NOERROR', between(70, 160))
  }
  // Ordinary NXDOMAIN noise (WPAD lookups and a typo) from several hosts
  for (const [h, n, s] of [['10.20.30.12', 'wpad.corp.example.com', 300], ['10.20.30.23', 'wpad.corp.example.com', 1210], ['10.20.30.48', 'wwww.example.com', 1802],
    ['10.20.30.35', 'wpad.corp.example.com', 2400], ['10.20.30.52', 'intranet.crop.example.com', 2911], [TUNNEL_HOST, 'wpad.corp.example.com', 3300]]) {
    q(T0 + s, h, n, 'A', 'NXDOMAIN', between(110, 130))
  }
  // Mail server: SPF, DKIM and DMARC lookups are legitimate TXT traffic
  const mailTxt = ['example.net', '_dmarc.example.net', 's1._domainkey.example.net', 'partner.example', '_dmarc.example.com', 'selector2._domainkey.example.com', 'example.com', '_dmarc.partner.example']
  for (let i = 0; i < 16; i++) q(T0 + 120 + i * 214 + rand() * 60, '10.20.0.25', mailTxt[i % mailTxt.length], 'TXT', 'NOERROR', between(180, 520))

  // Tunneling: one long base32-looking label per query, TXT replies, a steady stream
  const B32 = 'abcdefghijklmnopqrstuvwxyz234567'
  let sec = T0 + 611
  for (let i = 0; i < 230; i++) {
    const label = Array.from({ length: between(44, 52) }, () => B32[Math.floor(rand() * 32)]).join('')
    q(sec, TUNNEL_HOST, `${label}.${TUNNEL_DOMAIN}`, 'TXT', 'NOERROR', between(150, 260), true)
    sec += 4 + rand() * 7
  }

  // DGA: random names under one TLD until one resolves, then it keeps using that one
  const LET = 'abcdefghijklmnopqrstuvwxyz'
  const dga = () => Array.from({ length: between(11, 16) }, () => LET[Math.floor(rand() * 26)]).join('')
  sec = T0 + 1500
  for (let i = 0; i < DGA_HITS_BEFORE_LIVE; i++) { q(sec, DGA_HOST, `${dga()}.example`, 'A', 'NXDOMAIN', between(100, 120), true); sec += 1 + rand() * 2 }
  const live = `${dga()}.example`
  for (let i = 0; i < 9; i++) { q(sec, DGA_HOST, live, 'A', 'NOERROR', 74, i === 0); sec += 220 }

  rows.sort((a, b) => a.sec - b.sec)
  return { text: `${rows.map((r) => r.line).join('\n')}\n`, live }
}

const { text: LOG, live: LIVE_DGA } = build()
const PATH = '/var/log/unbound/queries.log'

export default {
  id: 'dns-tunnel',
  title: 'DNS tunneling and DGA in resolver logs',
  objectives: ['1.2', '1.3'],
  difficulty: 'Advanced',
  minutes: 16,
  scenario: 'Egress firewall rules block everything except DNS from the user VLAN, and all DNS must go through the internal resolver (resolver01). The SOC wants to know whether anyone is abusing DNS. You have one hour of resolver01\'s reply log. Each line is: syslog date and time, host, then `client qname qtype class rcode response_time cached size`. Split on whitespace, the client is field 8, the queried name field 9, the record type field 10 and the rcode field 12. The mail server 10.20.0.25 runs SPF, DKIM and DMARC checks.',
  files: { [PATH]: LOG },
  artifacts: [{ id: 'dns', title: 'queries.log', file: PATH }],
  hints: [
    `awk '{print $8, $10}' ${PATH} | sort | uniq -c | sort -rn | head`,
    `awk '{print length($9), $8, $9}' ${PATH} | sort -rn | head -5`,
    `grep NXDOMAIN ${PATH} | awk '{print $8}' | sort | uniq -c | sort -rn`,
    `awk '{print $9}' ${PATH} | awk -F. '{print $(NF-2) "." $(NF-1)}' | sort | uniq -c | sort -rn | head`,
  ],
  tasks: [
    {
      id: 'host', type: 'input',
      prompt: 'Which internal host is tunneling data over DNS?',
      answer: [TUNNEL_HOST],
      cmd: `awk '$10 == "TXT" {print $8}' ${PATH} | sort | uniq -c | sort -rn`,
      explain: `${TUNNEL_HOST} made 230 TXT queries in under an hour. The only other TXT client is the mail server, which looks up SPF, DKIM and DMARC records, and that is normal. TXT is popular for tunnels because a TXT reply can carry a few hundred bytes of arbitrary data back to the client, so the channel works in both directions.`,
    },
    {
      id: 'domain', type: 'input',
      prompt: 'What parent domain is the tunnel using?',
      answer: [TUNNEL_DOMAIN, `${TUNNEL_DOMAIN}.`, `*.${TUNNEL_DOMAIN}`],
      cmd: `grep ${TUNNEL_HOST} ${PATH} | awk '{print $9}' | awk -F. '{print $(NF-2) "." $(NF-1)}' | sort | uniq -c | sort -rn`,
      explain: `Every tunnel query is <44–52 random base32 characters>.${TUNNEL_DOMAIN}. The attacker runs the authoritative name server for ${TUNNEL_DOMAIN}, so your own resolver dutifully forwards every query (and the data encoded in its label) straight to them. That is why "only DNS is allowed out" is not a control by itself. Group by the registered domain, not by the full name, or every unique label looks like a different site.`,
    },
    {
      id: 'nx', type: 'input',
      prompt: `How many NXDOMAIN responses did ${DGA_HOST} receive?`,
      answer: [String(DGA_HITS_BEFORE_LIVE)],
      cmd: `grep ${DGA_HOST} ${PATH} | grep -c NXDOMAIN`,
      explain: `${DGA_HITS_BEFORE_LIVE}. Malware with a domain generation algorithm computes many pseudo-random names per day and tries them in turn. The operator registers only one or two, so almost every lookup fails with NXDOMAIN in a fast burst. A burst of NXDOMAINs for random-looking names from one host is the DGA signature. A few NXDOMAINs from many hosts (wpad, typos) is ordinary noise.`,
    },
    {
      id: 'live', type: 'input',
      prompt: `Which DGA domain actually resolved? (It is the one ${DGA_HOST} keeps using.)`,
      answer: [LIVE_DGA, `${LIVE_DGA}.`],
      cmd: `grep ${DGA_HOST} ${PATH} | grep NOERROR | awk '{print $9}' | sort | uniq -c | sort -rn`,
      explain: `${LIVE_DGA} is the only generated name that returned NOERROR, and the host re-resolves it every few minutes afterwards. That is the live C2 domain. Block it and sinkhole it, then look for traffic to the IPs it resolved to. If you can identify the malware family, its algorithm lets you pre-compute and block future domains.`,
    },
    {
      id: 'classify', type: 'grid',
      prompt: 'Classify each pattern found in the log.',
      columns: [{ key: 'v', label: 'Assessment', options: ['DNS tunneling', 'DGA C2 discovery', 'Normal: email authentication', 'Normal: misconfiguration or typo', 'DNS amplification attack'] }],
      rows: [
        { label: `${TUNNEL_HOST}: 230 TXT queries, long random labels, one parent domain`, answer: { v: 'DNS tunneling' } },
        { label: `${DGA_HOST}: burst of random .example names, nearly all NXDOMAIN`, answer: { v: 'DGA C2 discovery' } },
        { label: '10.20.0.25: TXT lookups for _dmarc and _domainkey records', answer: { v: 'Normal: email authentication' } },
        { label: 'Several hosts: occasional NXDOMAIN for wpad.corp.example.com', answer: { v: 'Normal: misconfiguration or typo' } },
      ],
      explain: 'Tunneling shows as high volume to one domain with long, high-entropy labels (often 40–63 characters, the maximum label length) and TXT/NULL/CNAME record types. A DGA shows as many different random domains and mostly failures. The mail server\'s TXT lookups are its job. WPAD lookups come from browsers auto-detecting a proxy, and you should disable that, because WPAD can itself be abused. Amplification uses spoofed sources and large ANY or DNSSEC answers aimed at a victim, which doesn\'t fit any of these.',
    },
    {
      id: 'control', type: 'single',
      prompt: 'Which control BEST prevents and detects this kind of DNS tunneling from now on?',
      options: [
        'Block all TXT record queries at the resolver',
        `Add ${TUNNEL_DOMAIN} to the blocklist and close the case`,
        'Force all DNS through the internal resolvers (block outbound 53/853 and known DoH endpoints elsewhere), apply protective DNS / RPZ filtering, and alert on long or high-entropy labels and per-domain query volume',
        'Enable DNSSEC validation on the resolver',
      ],
      answer: 2,
      explain: 'A tunnel only needs some resolver to forward its queries. Centralize DNS, filter newly registered and uncategorized domains, and add analytics for label length, entropy and volume per registered domain. Blocking all TXT breaks SPF, DKIM and DMARC and many SaaS verifications, and tunnels simply switch to A, CNAME or NULL records. Blocklisting one domain is a whack-a-mole fix. DNSSEC protects the integrity of answers and does nothing about exfiltration.',
    },
  ],
}
