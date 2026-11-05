// Lab: find a C2 beacon in a Zeek conn.log. One host checks in every ~60 s with near-identical
// byte counts; everything else is ordinary office traffic. Deterministic (seeded PRNG).

const BEACON_SRC = '10.10.5.23'
const C2 = '203.0.113.200'
const C2_PORT = 8443
const START = Date.UTC(2026, 10, 4, 13, 0, 0) / 1000

function prng(seed) {
  let s = seed >>> 0
  return () => {
    s = (Math.imul(s, 1664525) + 1013904223) >>> 0
    return s / 4294967296
  }
}

const HEADER = [
  '#separator \\x09',
  '#set_separator\t,',
  '#empty_field\t(empty)',
  '#unset_field\t-',
  '#path\tconn',
  '#open\t2026-11-04-13-00-00',
  '#fields\tts\tuid\tid.orig_h\tid.orig_p\tid.resp_h\tid.resp_p\tproto\tservice\tduration\torig_bytes\tresp_bytes\tconn_state\tlocal_orig\tlocal_resp\tmissed_bytes\thistory\torig_pkts\torig_ip_bytes\tresp_pkts\tresp_ip_bytes\ttunnel_parents',
  '#types\ttime\tstring\taddr\tport\taddr\tport\tenum\tstring\tinterval\tcount\tcount\tstring\tbool\tbool\tcount\tstring\tcount\tcount\tcount\tcount\tset[string]',
]

function connLog() {
  const rand = prng(4471)
  const B62 = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789'
  const uid = () => `C${Array.from({ length: 16 }, () => B62[Math.floor(rand() * 62)]).join('')}`
  const between = (a, b) => a + Math.floor(rand() * (b - a + 1))
  const rows = []
  const conn = (ts, src, dst, dport, proto, service, dur, ob, rb, state = 'SF', history = null) => {
    const sport = proto === 'udp' && dport === 123 ? 123 : between(49152, 64999)
    const op = proto === 'tcp' ? Math.max(3, Math.ceil(ob / 1200) + 4) : 1
    const rp = state === 'S0' ? 0 : proto === 'tcp' ? Math.max(2, Math.ceil(rb / 1400) + 3) : 1
    const hdr = proto === 'tcp' ? 52 : 28
    const local = dst.startsWith('10.') ? 'T' : 'F'
    const hist = history ?? (proto === 'udp' ? 'Dd' : state === 'S0' ? 'S' : state === 'REJ' ? 'Sr' : 'ShADadFf')
    rows.push({
      ts,
      line: [ts.toFixed(6), uid(), src, sport, dst, dport, proto, service, dur.toFixed(6), ob, rb, state, 'T', local, 0, hist, op, ob + op * hdr, rp, rb + rp * hdr, '-'].join('\t'),
    })
  }

  // The beacon: every 60 s +/- 2 s, ~704 bytes up and ~435 down, for 70 minutes
  let ts = START + 7.218
  for (let i = 0; i < 70; i++) {
    conn(ts, BEACON_SRC, C2, C2_PORT, 'tcp', 'ssl', 0.18 + rand() * 0.07, between(702, 706), between(433, 437))
    ts += 58 + rand() * 4
  }

  // Normal traffic over the same window
  const users = ['10.10.5.11', '10.10.5.14', '10.10.5.17', '10.10.5.19', '10.10.5.26', '10.10.5.28', '10.10.5.33', '10.10.5.35', BEACON_SRC]
  const web = ['198.51.100.10', '198.51.100.27', '198.51.100.44', '198.51.100.140', '192.0.2.15', '192.0.2.61', '192.0.2.99', '203.0.113.21', '203.0.113.75']
  for (let i = 0; i < 56; i++) {
    const at = START + rand() * 4200
    const src = users[Math.floor(rand() * users.length)]
    // DNS lookup, then the web session it led to
    conn(at, src, '10.10.0.2', 53, 'udp', 'dns', 0.002 + rand() * 0.03, between(31, 48), between(47, 220))
    const dst = web[Math.floor(rand() * web.length)]
    const https = rand() < 0.85
    const fail = rand() < 0.04
    if (fail) conn(at + 0.04, src, dst, 443, 'tcp', '-', 0, 0, 0, 'S0')
    else conn(at + 0.04, src, dst, https ? 443 : 80, 'tcp', https ? 'ssl' : 'http', 0.3 + rand() * 45, between(600, 24000), between(3000, 900000))
  }
  // Software update downloads on one host: few, irregular and large
  for (const off of [312, 1490, 2930, 3611]) conn(START + off + rand() * 30, '10.10.5.31', '192.0.2.80', 443, 'tcp', 'ssl', 20 + rand() * 60, between(2000, 6000), between(18000000, 64000000))
  // File server and time sync
  for (let i = 0; i < 14; i++) conn(START + rand() * 4200, users[Math.floor(rand() * 8)], '10.10.1.5', 445, 'tcp', 'smb', 1 + rand() * 300, between(2000, 90000), between(5000, 4000000))
  for (const h of ['10.10.5.11', '10.10.5.19', '10.10.5.31', '10.10.5.33']) conn(START + 900 + rand() * 2000, h, '10.10.0.2', 123, 'udp', 'ntp', 0.001 + rand() * 0.002, 48, 48)
  // A blocked outbound attempt
  conn(START + 2214.5, '10.10.5.28', '198.51.100.233', 3389, 'tcp', '-', 0, 0, 0, 'REJ')

  rows.sort((a, b) => a.ts - b.ts)
  return `${[...HEADER, ...rows.map((r) => r.line), '#close\t2026-11-04-14-15-00'].join('\n')}\n`
}

const PATH = '/home/analyst/zeek/conn.log'

export default {
  id: 'beacon-zeek',
  title: 'C2 beacon hunting in Zeek conn.log',
  objectives: ['1.2', '1.3'],
  difficulty: 'Advanced',
  minutes: 16,
  scenario: 'Threat intel warns that a commodity RAT used against your sector checks in over TLS on a non-standard port. You have 75 minutes of Zeek conn.log from the user VLAN 10.10.5.0/24 (internal resolver and NTP server: 10.10.0.2; file server: 10.10.1.5). Hunt for beaconing. Zeek logs are tab-separated, so `cut -f` works, and awk splits on whitespace by default. Field order is listed on the #fields line: ts is field 1, id.orig_h field 3, id.resp_h field 5, id.resp_p field 6, orig_bytes field 10 and resp_bytes field 11.',
  files: { [PATH]: connLog() },
  artifacts: [{ id: 'conn', title: 'conn.log', file: PATH }],
  hints: [
    `grep -v "^#" ${PATH} | cut -f3,5,6 | sort | uniq -c | sort -rn | head`,
    `grep ${C2} ${PATH} | cut -f1,10,11 | head`,
    `grep ${C2} ${PATH} | awk '{ if (prev) print $1 - prev; prev = $1 }' | head`,
  ],
  tasks: [
    {
      id: 'host', type: 'input',
      prompt: 'Which internal host is beaconing?',
      answer: [BEACON_SRC],
      cmd: `grep -v "^#" ${PATH} | cut -f3,5,6 | sort | uniq -c | sort -rn | head -5`,
      explain: `Count connections per (source, destination, port) triple. ${BEACON_SRC} -> ${C2}:${C2_PORT} occurs 70 times in 75 minutes, far more than any browsing pair. The internal DNS server 10.10.0.2 is contacted often too, but that traffic is spread across many hosts and is expected. Frequency alone isn't proof, though. Confirm with regularity and size, as the next tasks do.`,
    },
    {
      id: 'c2', type: 'input',
      prompt: 'What is the C2 server\'s IP and port? Answer as ip:port.',
      answer: [`${C2}:${C2_PORT}`, `${C2} ${C2_PORT}`, `${C2}/${C2_PORT}`, `${C2}, ${C2_PORT}`, `${C2} port ${C2_PORT}`],
      cmd: `awk '$3 == "${BEACON_SRC}" {print $5 ":" $6}' ${PATH} | sort | uniq -c | sort -rn`,
      explain: `${C2}:${C2_PORT}. Zeek identified the protocol as TLS (service ssl) on a non-standard port. Port 8443 blends in as "alternate HTTPS", but an external host serving TLS there to a single workstation every minute is not normal. Next, check ssl.log and x509.log for the SNI, JA3/JA4 and the certificate (often self-signed).`,
    },
    {
      id: 'interval', type: 'input',
      prompt: 'Approximately how often does the host check in, in seconds?',
      answer: ['60', '60s', '60 s', '60 sec', '60 seconds', '~60', '1 minute', '1 min', 'one minute', '1m'],
      explain: 'Subtract each timestamp from the one before it: `grep 203.0.113.200 conn.log | awk \'{ if (prev) print $1 - prev; prev = $1 }\'`. Every gap falls between 58 and 62 seconds. That is a 60 s sleep with about ±2 s (3%) jitter, which RAT and C2 frameworks add precisely to defeat naive "exactly N seconds" detections. Hunting tools such as RITA score beacons on the spread of the intervals and of the sizes, not on an exact match.',
    },
    {
      id: 'bytes', type: 'single',
      prompt: 'Every connection to the C2 carries 702–706 bytes out and 433–437 bytes back. Why does that matter?',
      options: [
        'Small transfers prove that no data was stolen, so the traffic is low risk',
        'Near-constant sizes mean an automated check-in that gets "no new tasking" each time. Human browsing varies widely, so low variance in size, like low variance in timing, is a beacon signature even when the payload is encrypted',
        'The sizes show the TLS handshake failed, so the C2 is unreachable',
        'The sizes prove large-scale exfiltration is in progress',
      ],
      answer: 1,
      explain: 'You can\'t read the encrypted payload, but metadata still talks. The same request and the same "nothing to do" reply, minute after minute, give a flat size profile. Watch for the moment it breaks: a much larger response means the operator sent a task or tool, and a much larger request suggests data leaving. Small beacons do NOT mean "no theft". Collection usually happens in separate, bigger sessions.',
    },
    {
      id: 'classify', type: 'grid',
      prompt: 'Classify each traffic pattern in the log.',
      columns: [{ key: 'v', label: 'Assessment', options: ['Likely C2 beacon', 'Normal web browsing', 'Name resolution', 'Software update download', 'Port scan'] }],
      rows: [
        { label: `${BEACON_SRC} -> ${C2}:${C2_PORT}, 70 times, ~60 s apart, ~704/435 bytes`, answer: { v: 'Likely C2 beacon' } },
        { label: 'Many hosts -> various external IPs on 443/80, irregular, 600 B–900 KB', answer: { v: 'Normal web browsing' } },
        { label: 'Many hosts -> 10.10.0.2:53/udp, tiny, just before each web session', answer: { v: 'Name resolution' } },
        { label: '10.10.5.31 -> 192.0.2.80:443, 4 sessions, 18–64 MB each', answer: { v: 'Software update download' } },
      ],
      explain: 'Regular timing combined with uniform size marks a beacon. Browsing is bursty and sizes vary widely. DNS queries to the internal resolver come right before each web connection. The large, infrequent downloads look like updates (verify the destination against the vendor). Downloads are the opposite of a heartbeat. Nothing here is a port scan: that would be one source hitting many ports or hosts with S0/REJ states.',
    },
    {
      id: 'next', type: 'multi',
      prompt: 'What should you do next? Select all that apply.',
      options: [
        `Search all Zeek, proxy and firewall logs fleet-wide for any other host talking to ${C2}`,
        `Use EDR to identify the process on ${BEACON_SRC} that owns the connection, then contain the host`,
        `Pull ssl.log/x509.log for the beacon (SNI, JA3/JA4, certificate) to build detections`,
        `Block ${C2} at the egress firewall/proxy once scoping is done`,
        'Re-image the host immediately before collecting anything',
        'Ignore it: TLS traffic is encrypted and therefore safe',
      ],
      answer: [0, 1, 2, 3],
      explain: 'Scope (who else is talking to it?), attribute it to a process, enrich it with TLS metadata and contain it. Blocking right away is common, but coordinate it with host containment, or the actor knows they\'ve been seen and switches infrastructure. Re-imaging before collecting memory and disk destroys the evidence of what the RAT did. Encryption hides content, not the threat.',
    },
  ],
}
