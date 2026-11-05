// Every PBQ lab, in the order they appear on the Labs page (roughly by domain).
// Add a new lab file here to publish it, then run: node scripts/validate-labs.mjs
import sshBruteforce from './ssh-bruteforce.js'
import phishHeaders from './phish-headers.js'
import webAttackLogs from './web-attack-logs.js'
import beaconZeek from './beacon-zeek.js'
import dnsTunnel from './dns-tunnel.js'
import psEdr from './ps-edr.js'
import cloudTrail from './cloud-trail.js'
import firewallRules from './firewall-rules.js'
import soarPlaybook from './soar-playbook.js'
import aiSoc from './ai-soc.js'
import nmapScan from './nmap-scan.js'
import vulnPrioritize from './vuln-prioritize.js'
import webVulnFix from './web-vuln-fix.js'
import winLateral from './win-lateral.js'
import ransomwareIr from './ransomware-ir.js'
import irMetrics from './ir-metrics.js'

export const LABS = [
  // Domain 1: Security Operations
  sshBruteforce,
  phishHeaders,
  webAttackLogs,
  beaconZeek,
  dnsTunnel,
  psEdr,
  cloudTrail,
  firewallRules,
  soarPlaybook,
  aiSoc,
  // Domain 2: Vulnerability Management
  nmapScan,
  vulnPrioritize,
  webVulnFix,
  // Domains 3 and 4: Incident Response, Reporting
  winLateral,
  ransomwareIr,
  irMetrics,
]
