// Lab: leaked IAM access key -> recon -> persistence -> logging disabled -> public bucket -> data theft.
// CloudTrail records are generated deterministically as JSON lines (one event per line).

const ACCOUNT = '111122223333'
const LEAKED = 'AKIAEXAMPLE7Q3DEPLOY'
const NEWKEY = 'AKIAEXAMPLE2NEWKEY88'
const SESSION = 'ASIAEXAMPLE4TMPSESS1'
const BAD_IP = '198.51.100.201'
const ANON_IP = '203.0.113.150'
const CI_IP = '192.0.2.40'
const BUCKET = 'corp-hr-exports-prod'
const ARTIFACTS = 'corp-build-artifacts'

const UA_CI = 'aws-cli/2.18.4 md/awscrt#0.21.2 os/linux#5.15.0-1066-aws lang/python#3.12.6 exec-env/GitHubRunner'
const UA_BAD = 'Boto3/1.34.162 md/Botocore#1.34.162 os/linux#6.8.11-amd64 md/distrib#kali lang/python#3.11.9'
const UA_CONSOLE = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.0.0 Safari/537.36'

function prng(seed) {
  let s = seed >>> 0
  return () => {
    s = (Math.imul(s, 1664525) + 1013904223) >>> 0
    return s / 4294967296
  }
}

const pad = (n) => String(n).padStart(2, '0')
const time = (sec) => `2026-11-03T${pad(Math.floor(sec / 3600))}:${pad(Math.floor((sec % 3600) / 60))}:${pad(sec % 60)}Z`
const h = (hh, mm, ss = 0) => hh * 3600 + mm * 60 + ss

const ciUser = (key = LEAKED) => ({ type: 'IAMUser', principalId: 'AIDAEXAMPLECIDEPLOY1', arn: `arn:aws:iam::${ACCOUNT}:user/ci-deploy`, accountId: ACCOUNT, accessKeyId: key, userName: 'ci-deploy' })
const sessUser = () => ({ ...ciUser(SESSION), sessionContext: { attributes: { creationDate: time(h(2, 19, 40)), mfaAuthenticated: 'false' } } })
const alice = () => ({ type: 'IAMUser', principalId: 'AIDAEXAMPLEALICE0001', arn: `arn:aws:iam::${ACCOUNT}:user/alice.admin`, accountId: ACCOUNT, userName: 'alice.admin' })
const hrRole = () => ({ type: 'AssumedRole', principalId: 'AROAEXAMPLEHREXPORT1:hr-export-fn', arn: `arn:aws:sts::${ACCOUNT}:assumed-role/hr-export-role/hr-export-fn`, accountId: ACCOUNT, accessKeyId: 'ASIAEXAMPLEHRFN00001' })
const anon = () => ({ type: 'AWSAccount', principalId: '', accountId: 'anonymous' })

function trail() {
  const rand = prng(3333)
  const hex = (n) => Array.from({ length: n }, () => '0123456789abcdef'[Math.floor(rand() * 16)]).join('')
  const uuid = () => `${hex(8)}-${hex(4)}-4${hex(3)}-a${hex(3)}-${hex(12)}`
  const rows = []
  const ev = (sec, src, name, who, ip, ua, req, resp = null, extra = {}) => {
    const data = src === 's3.amazonaws.com' && ['GetObject', 'PutObject', 'ListObjects'].includes(name)
    const readOnly = /^(Get|List|Describe|Head)/.test(name)
    rows.push({
      sec, n: rows.length,
      line: JSON.stringify({
        eventVersion: data ? '1.09' : '1.10', userIdentity: who, eventTime: time(sec), eventSource: src, eventName: name,
        awsRegion: 'us-east-1', sourceIPAddress: ip, userAgent: ua, requestParameters: req, responseElements: resp, ...extra,
        eventID: uuid(), readOnly, eventType: 'AwsApiCall', managementEvent: !data, recipientAccountId: ACCOUNT, eventCategory: data ? 'Data' : 'Management',
      }),
    })
  }

  // ---- Normal activity ----
  // CI pipeline (GitHub runner) publishes build artifacts with the ci-deploy key
  for (const start of [h(0, 12, 4), h(1, 31, 40), h(4, 5, 12)]) {
    ev(start, 'sts.amazonaws.com', 'GetCallerIdentity', ciUser(), CI_IP, UA_CI, null, null)
    ev(start + 3, 'ecr.amazonaws.com', 'GetAuthorizationToken', ciUser(), CI_IP, UA_CI, null, null)
    for (let i = 0; i < 3; i++) {
      ev(start + 20 + i * 7, 's3.amazonaws.com', 'PutObject', ciUser(), CI_IP, UA_CI, { bucketName: ARTIFACTS, key: `builds/web/${start + i}/bundle-${hex(7)}.tar.gz`, Host: `${ARTIFACTS}.s3.amazonaws.com` })
    }
  }
  // The HR export function reads its own bucket through a VPC endpoint
  for (let i = 0; i < 6; i++) {
    ev(h(0, 30) + i * 1800 + Math.floor(rand() * 60), 's3.amazonaws.com', 'GetObject', hrRole(), '10.0.12.34', '[aws-sdk-java/2.28.11]', { bucketName: BUCKET, key: `exports/2026-11/headcount_${pad(i + 1)}.csv`, Host: `${BUCKET}.s3.amazonaws.com` }, null, { vpcEndpointId: 'vpce-0a1b2c3d4e5f60718' })
  }
  // An admin works in the console, including a legitimate bucket policy change
  ev(h(1, 2, 13), 'signin.amazonaws.com', 'ConsoleLogin', alice(), '192.0.2.10', UA_CONSOLE, null, { ConsoleLogin: 'Success' }, { additionalEventData: { MFAUsed: 'Yes', MobileVersion: 'No' } })
  ev(h(1, 4, 40), 'ec2.amazonaws.com', 'DescribeInstances', alice(), '192.0.2.10', UA_CONSOLE, { maxResults: 1000, instancesSet: {} })
  ev(h(1, 6, 2), 's3.amazonaws.com', 'PutBucketPolicy', alice(), '192.0.2.10', UA_CONSOLE, {
    bucketName: ARTIFACTS,
    bucketPolicy: { Version: '2012-10-17', Statement: [{ Sid: 'DenyOutsideVpce', Effect: 'Deny', Principal: '*', Action: 's3:*', Resource: [`arn:aws:s3:::${ARTIFACTS}`, `arn:aws:s3:::${ARTIFACTS}/*`], Condition: { StringNotEquals: { 'aws:SourceVpce': 'vpce-0a1b2c3d4e5f60718' } } }] },
    policy: '', Host: `${ARTIFACTS}.s3.amazonaws.com`,
  })
  ev(h(1, 9, 30), 'iam.amazonaws.com', 'ListUsers', alice(), '192.0.2.10', UA_CONSOLE, null)

  // ---- The intrusion: leaked ci-deploy key used from a VPS ----
  ev(h(2, 14, 7), 'sts.amazonaws.com', 'GetCallerIdentity', ciUser(), BAD_IP, UA_BAD, null)
  ev(h(2, 14, 31), 's3.amazonaws.com', 'ListBuckets', ciUser(), BAD_IP, UA_BAD, { Host: 's3.amazonaws.com' })
  ev(h(2, 15, 2), 'iam.amazonaws.com', 'ListAttachedUserPolicies', ciUser(), BAD_IP, UA_BAD, { userName: 'ci-deploy' })
  ev(h(2, 16, 40), 'iam.amazonaws.com', 'CreateAccessKey', ciUser(), BAD_IP, UA_BAD, { userName: 'ci-deploy' }, { accessKey: { userName: 'ci-deploy', accessKeyId: NEWKEY, status: 'Active', createDate: 'Nov 3, 2026, 2:16:40 AM' } })
  ev(h(2, 18, 12), 'cloudtrail.amazonaws.com', 'StopLogging', ciUser(), BAD_IP, UA_BAD, { name: `arn:aws:cloudtrail:us-east-1:${ACCOUNT}:trail/acct-trail` })
  ev(h(2, 19, 40), 'sts.amazonaws.com', 'GetSessionToken', ciUser(), BAD_IP, UA_BAD, { durationSeconds: 129600 }, { credentials: { accessKeyId: SESSION, sessionToken: 'HIDDEN_DUE_TO_SECURITY_REASONS', expiration: 'Nov 4, 2026, 2:19:40 PM' } })
  ev(h(2, 21, 5), 's3.amazonaws.com', 'DeleteBucketPublicAccessBlock', ciUser(), BAD_IP, UA_BAD, { bucketName: BUCKET, publicAccessBlock: '', Host: `${BUCKET}.s3.amazonaws.com` })
  ev(h(2, 21, 33), 's3.amazonaws.com', 'PutBucketPolicy', ciUser(), BAD_IP, UA_BAD, {
    bucketName: BUCKET,
    bucketPolicy: { Version: '2012-10-17', Statement: [{ Sid: 'PublicRead', Effect: 'Allow', Principal: '*', Action: 's3:GetObject', Resource: `arn:aws:s3:::${BUCKET}/*` }] },
    policy: '', Host: `${BUCKET}.s3.amazonaws.com`,
  })
  ev(h(2, 22, 10), 's3.amazonaws.com', 'ListObjects', sessUser(), BAD_IP, UA_BAD, { bucketName: BUCKET, prefix: '', Host: `${BUCKET}.s3.amazonaws.com` })
  // Bulk download with the temporary session credentials
  const folders = ['payroll/2026-09', 'payroll/2026-10', 'employees', 'benefits', 'exports/2026-10']
  let t = h(2, 22, 40)
  for (let i = 0; i < 34; i++) {
    const f = folders[i % folders.length]
    ev(t, 's3.amazonaws.com', 'GetObject', sessUser(), BAD_IP, UA_BAD, { bucketName: BUCKET, key: `${f}/${f.split('/')[0]}_${pad(i + 1)}.csv`, Host: `${BUCKET}.s3.amazonaws.com` })
    t += 9 + Math.floor(rand() * 25)
  }
  // Anyone on the internet can now read it: anonymous downloads from another address
  for (let i = 0; i < 5; i++) {
    ev(h(2, 49, 3) + i * 41, 's3.amazonaws.com', 'GetObject', anon(), ANON_IP, 'curl/8.9.1', { bucketName: BUCKET, key: `employees/employees_${pad(3 + i * 5)}.csv`, Host: `${BUCKET}.s3.amazonaws.com` })
  }

  rows.sort((a, b) => a.sec - b.sec || a.n - b.n)
  return `${rows.map((r) => r.line).join('\n')}\n`
}

const LOG = trail()
const PATH = '/home/analyst/cloudtrail/org-trail_2026-11-03.jsonl'
const badGets = LOG.split('\n').filter((l) => l.includes(`"sourceIPAddress":"${BAD_IP}"`) && l.includes('"eventName":"GetObject"')).length

export default {
  id: 'cloud-trail',
  title: 'Leaked AWS key in CloudTrail',
  objectives: ['1.2', '3.3'],
  difficulty: 'Advanced',
  minutes: 20,
  scenario: `GuardDuty raised "PenTest:IAMUser/KaliLinux" and "Stealth:IAMUser/CloudTrailLoggingDisabled" for account ${ACCOUNT}. The account trail was stopped, but the organization trail (which member accounts cannot modify) kept recording, including S3 data events. You have its log for 3 Nov, one JSON event per line. Normal context: the CI pipeline runs from ${CI_IP} as IAM user ci-deploy, the admins sign in to the console from 192.0.2.10, and the HR export function reads ${BUCKET} through a VPC endpoint. Tip: \`grep -o '"field":"[^"]*"'\` pulls out a single field.`,
  files: { [PATH]: LOG },
  extra: {
    [`whois ${BAD_IP}`]: `NetRange:       198.51.100.192 - 198.51.100.223\nCIDR:           198.51.100.192/27\nNetName:        FASTVPS-EXAMPLE\nOriginAS:       AS64500\nOrganization:   FastVPS Hosting (FVH-EX)\nComment:        Virtual private servers, hourly billing\nCountry:        XX\n`,
    [`whois ${CI_IP}`]: 'NetRange:       192.0.2.32 - 192.0.2.63\nNetName:        EXAMPLE-CI-RUNNERS\nOriginAS:       AS64496\nOrganization:   Example Code Hosting, Inc.\nComment:        Hosted CI runners (allow-listed by Corp Security)\n',
    [`whois ${ANON_IP}`]: 'NetRange:       203.0.113.128 - 203.0.113.191\nNetName:        RESIDENTIAL-PROXY-EXAMPLE\nOriginAS:       AS64510\nOrganization:   Example Residential Proxy Network\n',
  },
  artifacts: [{ id: 'ct', title: 'org-trail_2026-11-03.jsonl', file: PATH }],
  hints: [
    `grep -o '"sourceIPAddress":"[^"]*"' ${PATH} | sort | uniq -c | sort -rn`,
    `grep ${BAD_IP} ${PATH} | grep -o '"eventName":"[^"]*"' | uniq -c`,
    `grep -o '"accessKeyId":"[^"]*"' ${PATH} | sort | uniq -c`,
    `whois ${BAD_IP}`,
  ],
  tasks: [
    {
      id: 'ip', type: 'input',
      prompt: 'Which source IP address is the attacker?',
      answer: [BAD_IP],
      cmd: `grep -o '"sourceIPAddress":"[^"]*"' ${PATH} | sort | uniq -c | sort -rn`,
      explain: `${BAD_IP} is the busiest source, and it is new: ci-deploy normally calls AWS only from ${CI_IP}, the CI provider's runner range. \`whois\` shows a VPS host on a different ASN (AS64500), and the User-Agent reports Kali Linux, which is what triggered the GuardDuty finding. A known identity on an unfamiliar IP or ASN is the core signal for a leaked key. ${ANON_IP} also downloaded files, but only after the bucket was made public, and anonymously.`,
    },
    {
      id: 'key', type: 'input',
      prompt: 'Which long-term access key ID (AKIA...) did the attacker use?',
      answer: [LEAKED],
      cmd: `grep ${BAD_IP} ${PATH} | grep -o '"accessKeyId":"AKIA[^"]*"' | sort | uniq -c`,
      explain: `${LEAKED}, ci-deploy's CI key. The same key is used legitimately from ${CI_IP}, which is why IP context matters. ${NEWKEY} shows up only in the responseElements of CreateAccessKey. That is the persistence key the attacker MADE, not the one they came in with. ${SESSION} (ASIA prefix) is a temporary credential minted from the leaked key with GetSessionToken.`,
    },
    {
      id: 'bucket', type: 'input',
      prompt: 'Which bucket did the attacker make public?',
      answer: [BUCKET, `arn:aws:s3:::${BUCKET}`],
      cmd: `grep PutBucketPolicy ${PATH} | grep -o '"bucketName":"[^"]*"'`,
      explain: `There are two PutBucketPolicy events. alice.admin's change to ${ARTIFACTS} is a Deny statement that restricts access to the VPC endpoint, which tightens security. The attacker's, from ${BAD_IP}, grants "Effect":"Allow","Principal":"*" s3:GetObject on ${BUCKET}/*, which means anyone on the internet. It was preceded by DeleteBucketPublicAccessBlock, because Block Public Access would otherwise have overridden the policy.`,
    },
    {
      id: 'gets', type: 'input',
      prompt: `How many GetObject calls did ${BAD_IP} make?`,
      answer: [String(badGets)],
      cmd: `grep ${BAD_IP} ${PATH} | grep -c '"eventName":"GetObject"'`,
      explain: `${badGets} objects from the payroll, employee, benefits and export folders: that is your data-breach scope, so preserve the list of object keys for legal and privacy notification. Those reads used the ASIA session key, so a hunt that only searches for the AKIA key would miss every one of them. Search by IP and by every key derived from the compromised identity. Also scope the anonymous reads from ${ANON_IP}.`,
    },
    {
      id: 'contain', type: 'order',
      prompt: 'Put the containment and recovery steps in the right order.',
      items: [
        `Deactivate both ci-deploy access keys (${LEAKED} and ${NEWKEY})`,
        'Revoke active sessions: attach a deny-all policy with an aws:TokenIssueTime condition to ci-deploy',
        `Remove the public policy from ${BUCKET} and re-enable Block Public Access`,
        'Restart logging on acct-trail and confirm delivery',
        'Preserve evidence: export the trail logs, record the object keys taken, snapshot affected resources',
        'Rotate: issue a new key to CI through a secrets manager (or move CI to OIDC roles) and delete the old keys',
      ],
      explain: 'Cut off the attacker\'s control plane first. Deactivating the keys stops new API calls, but the temporary session credentials (valid up to 36 hours) keep working until you deny tokens issued before now. Next, close the data leak: the bucket is public, so revoking keys alone doesn\'t stop anonymous downloads. Then restore visibility and preserve evidence. CloudTrail has already captured the malicious policy and calls, so containment doesn\'t destroy evidence here. Finally, rotate and harden. Long-lived CI keys are the root cause, and federated short-lived roles remove them.',
    },
    {
      id: 'ioc', type: 'multi',
      prompt: 'Which events are indicators of this compromise? Select all that apply.',
      options: [
        `API calls by ci-deploy from ${BAD_IP} (new ASN, Kali User-Agent)`,
        'GetCallerIdentity followed by ListBuckets and ListAttachedUserPolicies from that source',
        'CreateAccessKey for ci-deploy',
        'StopLogging on acct-trail',
        `DeleteBucketPublicAccessBlock and PutBucketPolicy with Principal "*" on ${BUCKET}`,
        `PutObject calls from ${CI_IP} to ${ARTIFACTS}`,
        'ConsoleLogin by alice.admin with MFA from 192.0.2.10',
        `GetObject on ${BUCKET} from 10.0.12.34 through the VPC endpoint`,
      ],
      answer: [0, 1, 2, 3, 4],
      explain: 'The attack chain: discovery ("whoami" with GetCallerIdentity, then listing buckets and permissions), persistence (a second access key), defense evasion (StopLogging), then exposing and taking the data. The CI uploads, alice\'s MFA console login and the HR function\'s reads through its VPC endpoint are the baseline you compared against.',
    },
  ],
}
