// A small, pure-JS analyst shell over a lab's virtual files. No React here, so labs can be
// tested from Node: new Shell(files).run('grep -c Failed /var/log/auth.log').

const HOME = '/home/analyst'

export class Shell {
  constructor(files = {}, { cwd = HOME, extra = {} } = {}) {
    this.files = {}
    for (const [p, c] of Object.entries(files)) this.files[normalize(p.startsWith('/') ? p : `${HOME}/${p}`)] = c
    this.cwd = cwd
    this.extra = extra // exact command line -> canned output (whois, dig, etc.)
    this.history = []
  }

  // Returns { out, err }. Output is a single string (may be empty).
  run(line) {
    const trimmed = line.trim()
    if (!trimmed) return { out: '' }
    this.history.push(trimmed)
    if (this.extra[trimmed] !== undefined) return { out: this.extra[trimmed] }
    let segments
    try {
      segments = splitPipes(trimmed).map(tokenize)
    } catch (e) {
      return { err: e.message }
    }
    let input = null
    for (const argv of segments) {
      if (!argv.length) return { err: 'syntax error near unexpected token `|\'' }
      const [cmd, ...args] = argv
      const fn = COMMANDS[cmd]
      if (!fn) return { err: `${cmd}: command not found. Type "help" for available commands.` }
      try {
        input = fn.call(this, args, input)
      } catch (e) {
        return { err: e instanceof ShellError ? e.message : `${cmd}: ${e.message}` }
      }
    }
    return { out: input ?? '' }
  }

  resolve(p) {
    if (p === '~' || p.startsWith('~/')) p = HOME + p.slice(1)
    return normalize(p.startsWith('/') ? p : `${this.cwd}/${p}`)
  }

  isDir(p) {
    const d = p === '/' ? '/' : `${p}/`
    return p === '/' || Object.keys(this.files).some((f) => f.startsWith(d))
  }

  read(cmd, p) {
    const full = this.resolve(p)
    if (this.files[full] !== undefined) return this.files[full]
    if (this.isDir(full)) throw new ShellError(`${cmd}: ${p}: Is a directory`)
    throw new ShellError(`${cmd}: ${p}: No such file or directory`)
  }

  // Expand * and ? in path arguments against the virtual file system
  glob(args) {
    const out = []
    for (const a of args) {
      if (!/[*?]/.test(a)) { out.push(a); continue }
      const full = this.resolve(a)
      const re = new RegExp(`^${full.split('*').map((s) => s.split('?').map(escapeRe).join('[^/]')).join('[^/]*')}$`)
      const hits = [...new Set(Object.keys(this.files).flatMap((f) => {
        const parts = f.split('/')
        const depth = full.split('/').length
        const cand = parts.slice(0, depth).join('/')
        return re.test(cand) ? [cand] : []
      }))].sort()
      if (!hits.length) out.push(a)
      else out.push(...hits.map((h) => (a.startsWith('/') ? h : relative(this.cwd, h))))
    }
    return out
  }
}

class ShellError extends Error {}
const fail = (msg) => { throw new ShellError(msg) }

function normalize(p) {
  const out = []
  for (const part of p.split('/')) {
    if (!part || part === '.') continue
    if (part === '..') out.pop()
    else out.push(part)
  }
  return `/${out.join('/')}`
}

function relative(cwd, p) {
  const base = cwd === '/' ? '/' : `${cwd}/`
  return p.startsWith(base) ? p.slice(base.length) : p
}

const escapeRe = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')

function splitPipes(line) {
  const parts = []
  let cur = ''
  let q = null
  for (let i = 0; i < line.length; i++) {
    const c = line[i]
    if (q) {
      if (c === q) q = null
      else if (c === '\\' && q === '"' && i + 1 < line.length) { cur += c + line[++i]; continue }
      cur += c
    } else if (c === "'" || c === '"') { q = c; cur += c }
    else if (c === '\\' && i + 1 < line.length) { cur += c + line[++i] }
    else if (c === '|') { parts.push(cur); cur = '' }
    else cur += c
  }
  if (q) fail('unexpected EOF while looking for matching quote')
  parts.push(cur)
  return parts
}

function tokenize(seg) {
  const out = []
  let cur = null
  let q = null
  for (let i = 0; i < seg.length; i++) {
    const c = seg[i]
    if (q === "'") {
      if (c === "'") q = null
      else cur += c
    } else if (q === '"') {
      if (c === '"') q = null
      else if (c === '\\' && '"\\$`'.includes(seg[i + 1])) cur += seg[++i]
      else cur += c
    } else if (c === "'" || c === '"') { q = c; cur = cur ?? '' }
    else if (c === '\\' && i + 1 < seg.length) { cur = (cur ?? '') + seg[++i] }
    else if (/\s/.test(c)) { if (cur !== null) { out.push(cur); cur = null } }
    else if (c === '>' || c === '<') fail('redirection is not supported here: use pipes instead')
    else cur = (cur ?? '') + c
  }
  if (cur !== null) out.push(cur)
  return out
}

// Turn "-in" into ['i','n'], keeping options that take values (e.g. -n 5, -n5, -A2)
function parseOpts(args, withValue = '', { numericShort = false } = {}) {
  const opts = {}
  const rest = []
  for (let i = 0; i < args.length; i++) {
    const a = args[i]
    if (a === '--') { rest.push(...args.slice(i + 1)); break }
    if (numericShort && /^-\d+$/.test(a)) { opts.n = a.slice(1); continue }
    if (a.startsWith('--') && a.length > 2) {
      const [k, v] = a.slice(2).split('=')
      opts[k] = v ?? true
      continue
    }
    if (a.startsWith('-') && a.length > 1 && !/^-\d/.test(a)) {
      for (let j = 1; j < a.length; j++) {
        const f = a[j]
        if (withValue.includes(f)) {
          const v = a.slice(j + 1) || args[++i]
          if (v === undefined) fail(`option requires an argument -- '${f}'`)
          opts[f] = v
          break
        }
        opts[f] = true
      }
      continue
    }
    rest.push(a)
  }
  return { opts, rest }
}

const lines = (text) => (text === '' ? [] : text.replace(/\n$/, '').split('\n'))
const joinLines = (arr) => (arr.length ? `${arr.join('\n')}\n` : '')

function inputs(sh, cmd, files, stdin) {
  const list = sh.glob(files)
  if (!list.length) {
    if (stdin === null) fail(`${cmd}: missing file operand (pipe something in, or name a file)`)
    return [{ name: '(standard input)', text: stdin }]
  }
  return list.map((f) => ({ name: f, text: sh.read(cmd, f) }))
}

// POSIX bracket classes and GNU word anchors -> JS regex syntax
function posixClasses(p) {
  return p
    .replace(/\[:digit:\]/g, '0-9').replace(/\[:alpha:\]/g, 'A-Za-z').replace(/\[:alnum:\]/g, 'A-Za-z0-9')
    .replace(/\[:upper:\]/g, 'A-Z').replace(/\[:lower:\]/g, 'a-z').replace(/\[:space:\]/g, '\\s')
    .replace(/\[:xdigit:\]/g, '0-9A-Fa-f').replace(/\[:punct:\]/g, '!-\\/:-@\\[-`{-~')
}

export function toRegex(pattern, { extended = true, fixed = false, ignoreCase = false, word = false } = {}) {
  let src
  if (fixed) src = escapeRe(pattern)
  else {
    let p = posixClasses(pattern)
    if (!extended) {
      // Basic regex: \| \( \) \{ \} \+ \? are operators, the bare characters are literals
      let out = ''
      for (let i = 0; i < p.length; i++) {
        const c = p[i]
        if (c === '\\' && i + 1 < p.length) {
          const n = p[++i]
          out += '|(){}+?'.includes(n) ? n : `\\${n}`
        } else out += '|(){}+?'.includes(c) ? `\\${c}` : c
      }
      p = out
    }
    src = p.replace(/\\[<>]/g, '\\b')
  }
  if (word) src = `\\b(?:${src})\\b`
  try {
    return new RegExp(src, ignoreCase ? 'i' : '')
  } catch {
    fail(`grep: invalid regular expression: ${pattern}`)
  }
}

const COMMANDS = {
  help() {
    return `Commands (pipes with | work; redirection does not):
  ls [-l] [dir]      cd <dir>        pwd           cat <file...>
  head [-n N]        tail [-n N]     wc [-l|-w|-c] less <file>
  grep [-i -v -c -n -o -E -F -w -l -h -r -A N -B N] <pattern> [file...]
  sort [-n -r -u -k N -t C]   uniq [-c -d -u]   cut -d C -f LIST
  awk [-F sep] 'program'      tr [-d -s] SET1 [SET2]
  base64 -d   sha256sum <file>   strings [-n N] <file>   find [dir] [-name GLOB] [-type f]
  echo   history   clear
Example: grep "Failed password" /var/log/auth.log | awk '{print $11}' | sort | uniq -c | sort -rn
`
  },
  pwd() { return `${this.cwd}\n` },
  cd(args) {
    const target = this.resolve(args[0] ?? HOME)
    if (!this.isDir(target)) fail(`cd: ${args[0]}: No such file or directory`)
    this.cwd = target
    return ''
  },
  ls(args) {
    const { opts, rest } = parseOpts(args)
    const dir = this.resolve(rest[0] ?? '.')
    if (this.files[dir] !== undefined) return `${rest[0]}\n`
    if (!this.isDir(dir)) fail(`ls: cannot access '${rest[0]}': No such file or directory`)
    const base = dir === '/' ? '/' : `${dir}/`
    const entries = new Map()
    for (const f of Object.keys(this.files)) {
      if (!f.startsWith(base)) continue
      const [name, ...more] = f.slice(base.length).split('/')
      entries.set(name, more.length ? 'dir' : f)
    }
    const names = [...entries.keys()].sort()
    if (!opts.l) return joinLines(names.map((n) => (entries.get(n) === 'dir' ? `${n}/` : n)))
    return joinLines(names.map((n) => {
      const e = entries.get(n)
      return e === 'dir'
        ? `drwxr-xr-x  analyst analyst        - ${n}/`
        : `-rw-r--r--  analyst analyst ${String(new TextEncoder().encode(this.files[e]).length).padStart(8)} ${n}`
    }))
  },
  cat(args, stdin) { return inputs(this, 'cat', args, stdin).map((x) => x.text).join('') },
  less(args, stdin) { return COMMANDS.cat.call(this, args, stdin) },
  more(args, stdin) { return COMMANDS.cat.call(this, args, stdin) },
  head(args, stdin) {
    const { opts, rest } = parseOpts(args, 'n', { numericShort: true })
    const n = parseInt(opts.n ?? '10', 10)
    return inputs(this, 'head', rest, stdin).map((x) => joinLines(lines(x.text).slice(0, n))).join('')
  },
  tail(args, stdin) {
    const { opts, rest } = parseOpts(args, 'n', { numericShort: true })
    const raw = String(opts.n ?? '10')
    return inputs(this, 'tail', rest, stdin).map((x) => {
      const ls = lines(x.text)
      return joinLines(raw.startsWith('+') ? ls.slice(parseInt(raw.slice(1), 10) - 1) : ls.slice(-parseInt(raw, 10)))
    }).join('')
  },
  wc(args, stdin) {
    const { opts, rest } = parseOpts(args)
    const all = !opts.l && !opts.w && !opts.c
    const ins = inputs(this, 'wc', rest, stdin)
    const row = (t, name) => {
      const parts = []
      if (opts.l || all) parts.push(lines(t).length)
      if (opts.w || all) parts.push(t.split(/\s+/).filter(Boolean).length)
      if (opts.c || all) parts.push(new TextEncoder().encode(t).length)
      return `${parts.map((n) => String(n).padStart(all ? 7 : 1)).join(' ')}${name && name !== '(standard input)' ? ` ${name}` : ''}`
    }
    return joinLines(ins.map((x) => row(x.text, x.name)))
  },
  grep(args, stdin) {
    const { opts, rest } = parseOpts(args, 'eABC')
    let pattern = opts.e
    if (pattern === undefined) {
      if (!rest.length) fail('grep: usage: grep [options] PATTERN [FILE...]')
      pattern = rest.shift()
    }
    const re = toRegex(pattern, { extended: !!opts.E || !!opts.P, fixed: !!opts.F, ignoreCase: !!opts.i, word: !!opts.w })
    let files = rest
    if ((opts.r || opts.R) && files.length) {
      files = files.flatMap((f) => {
        const full = this.resolve(f)
        if (this.files[full] !== undefined) return [f]
        const base = full === '/' ? '/' : `${full}/`
        return Object.keys(this.files).filter((p) => p.startsWith(base)).sort()
      })
    }
    const ins = inputs(this, 'grep', files, stdin)
    const multi = ins.length > 1 && !opts.h
    const after = parseInt(opts.A ?? opts.C ?? '0', 10)
    const before = parseInt(opts.B ?? opts.C ?? '0', 10)
    const out = []
    for (const { name, text } of ins) {
      const ls = lines(text)
      const hit = ls.map((l) => re.test(l) !== !!opts.v)
      const count = hit.filter(Boolean).length
      if (opts.l) { if (count) out.push(name); continue }
      if (opts.c) { out.push(multi ? `${name}:${count}` : String(count)); continue }
      const show = new Set()
      hit.forEach((h, i) => { if (h) for (let k = i - before; k <= i + after; k++) if (k >= 0 && k < ls.length) show.add(k) })
      let last = -2
      for (const i of [...show].sort((a, b) => a - b)) {
        if ((after || before) && last >= 0 && i > last + 1) out.push('--')
        last = i
        const prefix = `${multi ? `${name}${hit[i] ? ':' : '-'}` : ''}${opts.n ? `${i + 1}${hit[i] ? ':' : '-'}` : ''}`
        if (opts.o && !opts.v) {
          if (!hit[i]) continue
          const g = new RegExp(re.source, re.flags + 'g')
          for (const m of ls[i].matchAll(g)) if (m[0]) out.push(prefix + m[0])
        } else out.push(prefix + ls[i])
      }
    }
    return joinLines(out)
  },
  sort(args, stdin) {
    const { opts, rest } = parseOpts(args, 'kt')
    const ls = inputs(this, 'sort', rest, stdin).flatMap((x) => lines(x.text))
    const [k1, k2] = String(opts.k ?? '').split(',').map((s) => parseInt(s, 10))
    const numeric = opts.n || /n/.test(String(opts.k ?? ''))
    const key = (l) => {
      if (!opts.k) return l
      const f = opts.t ? l.split(opts.t) : l.trim().split(/\s+/)
      return f.slice(k1 - 1, k2 ? k2 : opts.t ? k1 : f.length).join(opts.t ?? ' ')
    }
    const num = (s) => { const m = s.trim().match(/^-?\d+(\.\d+)?/); return m ? parseFloat(m[0]) : 0 }
    let sorted = ls.map((l, i) => ({ l, i, k: key(l) })).sort((a, b) => {
      let c = numeric ? num(a.k) - num(b.k) : a.k < b.k ? -1 : a.k > b.k ? 1 : 0
      if (c === 0 && !opts.u) c = a.l < b.l ? -1 : a.l > b.l ? 1 : a.i - b.i
      return opts.r ? -c : c
    }).map((x) => x.l)
    if (opts.u) sorted = sorted.filter((l, i) => i === 0 || key(l) !== key(sorted[i - 1]))
    return joinLines(sorted)
  },
  uniq(args, stdin) {
    const { opts, rest } = parseOpts(args)
    const ls = inputs(this, 'uniq', rest, stdin).flatMap((x) => lines(x.text))
    const groups = []
    for (const l of ls) {
      const g = groups[groups.length - 1]
      const same = g && (opts.i ? g.l.toLowerCase() === l.toLowerCase() : g.l === l)
      if (same) g.n++
      else groups.push({ l, n: 1 })
    }
    return joinLines(groups.filter((g) => (opts.d ? g.n > 1 : opts.u ? g.n === 1 : true))
      .map((g) => (opts.c ? `${String(g.n).padStart(7)} ${g.l}` : g.l)))
  },
  cut(args, stdin) {
    const { opts, rest } = parseOpts(args, 'dfc')
    const spec = opts.f ?? opts.c
    if (!spec) fail('cut: you must specify a list of fields (-f) or characters (-c)')
    const ranges = spec.split(',').map((r) => {
      const [a, b] = r.split('-')
      return r.includes('-') ? [a ? parseInt(a, 10) : 1, b ? parseInt(b, 10) : Infinity] : [parseInt(a, 10), parseInt(a, 10)]
    })
    const want = (i) => ranges.some(([a, b]) => i >= a && i <= b)
    const d = opts.d ?? '\t'
    return joinLines(inputs(this, 'cut', rest, stdin).flatMap((x) => lines(x.text)).map((l) => {
      if (opts.c) return [...l].filter((_, i) => want(i + 1)).join('')
      if (!l.includes(d)) return l
      return l.split(d).filter((_, i) => want(i + 1)).join(d)
    }))
  },
  tr(args, stdin) {
    const { opts, rest } = parseOpts(args)
    if (stdin === null) fail('tr: reads from a pipe, e.g. cat file | tr -s " "')
    const expand = (s) => {
      s = s.replace(/\\n/g, '\n').replace(/\\t/g, '\t').replace(/\[:upper:\]/g, 'A-Z').replace(/\[:lower:\]/g, 'a-z').replace(/\[:space:\]/g, ' \t\n')
      let out = ''
      for (let i = 0; i < s.length; i++) {
        if (s[i + 1] === '-' && i + 2 < s.length) {
          for (let c = s.charCodeAt(i); c <= s.charCodeAt(i + 2); c++) out += String.fromCharCode(c)
          i += 2
        } else out += s[i]
      }
      return out
    }
    const set1 = expand(rest[0] ?? '')
    let text = stdin
    if (opts.d) text = [...text].filter((c) => !set1.includes(c)).join('')
    else if (rest[1] !== undefined) {
      const set2 = expand(rest[1])
      text = [...text].map((c) => { const i = set1.indexOf(c); return i < 0 ? c : set2[Math.min(i, set2.length - 1)] }).join('')
    }
    if (opts.s) {
      const sq = rest[1] !== undefined && !opts.d ? expand(rest[1]) : set1
      text = [...text].filter((c, i, a) => !(i > 0 && c === a[i - 1] && sq.includes(c))).join('')
    }
    return text
  },
  awk(args, stdin) {
    const { opts, rest } = parseOpts(args, 'Fv')
    if (!rest.length) fail('awk: usage: awk [-F sep] \'program\' [file...]')
    const prog = parseAwk(rest.shift())
    const ins = inputs(this, 'awk', rest, stdin)
    return runAwk(prog, ins.flatMap((x) => lines(x.text)), opts.F)
  },
  echo(args) {
    const { opts, rest } = parseOpts(args)
    return opts.n ? rest.join(' ') : `${rest.join(' ')}\n`
  },
  base64(args, stdin) {
    const { opts, rest } = parseOpts(args)
    const text = inputs(this, 'base64', rest, stdin).map((x) => x.text).join('')
    if (!opts.d && !opts.decode) return `${btoa(unescape(encodeURIComponent(text)))}\n`
    let bin
    try {
      bin = atob(text.replace(/\s+/g, ''))
    } catch {
      fail('base64: invalid input')
    }
    // PowerShell -EncodedCommand is UTF-16LE: show it readable by dropping the zero bytes
    const bytes = Uint8Array.from(bin, (c) => c.charCodeAt(0))
    const utf16 = bytes.length > 3 && bytes[1] === 0 && bytes[3] === 0
    const decoded = utf16 ? String.fromCharCode(...bytes.filter((_, i) => i % 2 === 0)) : new TextDecoder().decode(bytes)
    return decoded.endsWith('\n') ? decoded : `${decoded}\n`
  },
  sha256sum(args, stdin) {
    return joinLines(inputs(this, 'sha256sum', args, stdin).map((x) => `${sha256(x.text)}  ${x.name === '(standard input)' ? '-' : x.name}`))
  },
  strings(args, stdin) {
    const { opts, rest } = parseOpts(args, 'n', { numericShort: true })
    const n = parseInt(opts.n ?? '4', 10)
    const text = inputs(this, 'strings', rest, stdin).map((x) => x.text).join('')
    return joinLines(text.match(new RegExp(`[\\x20-\\x7e\\t]{${n},}`, 'g')) ?? [])
  },
  find(args) {
    const start = args[0] && !args[0].startsWith('-') ? args.shift() : '.'
    const root = this.resolve(start)
    let name = null
    for (let i = 0; i < args.length; i++) {
      if (args[i] === '-name' || args[i] === '-iname') name = toGlobRe(args[++i] ?? '', args[i - 1] === '-iname')
      else if (args[i] === '-type') i++
    }
    const base = root === '/' ? '/' : `${root}/`
    const found = Object.keys(this.files).filter((f) => (f === root || f.startsWith(base)) && (!name || name.test(f.split('/').pop()))).sort()
    return joinLines(found.map((f) => (start.startsWith('/') ? f : `./${relative(this.cwd === root ? root : this.cwd, f)}`)))
  },
  history() { return joinLines(this.history.map((h, i) => `${String(i + 1).padStart(5)}  ${h}`)) },
  whoami() { return 'analyst\n' },
  hostname() { return 'soc-workstation\n' },
}

const toGlobRe = (g, ci) => new RegExp(`^${g.split('*').map((s) => s.split('?').map(escapeRe).join('.')).join('.*')}$`, ci ? 'i' : '')

/* ---------------- awk subset ----------------
   Rules: BEGIN{...}  END{...}  pattern{...}  pattern  {...}
   Patterns: /re/, expr ~ /re/, comparisons, && || !, NR, NF, $N
   Statements: print a, b ; x += expr ; x++ ; arr[$1]++ ; for (k in arr) print k, arr[k] ; if (cond) stmt
   Functions: length() tolower() toupper() substr() */

function lexAwk(src) {
  const toks = []
  let i = 0
  const prevAllowsRegex = () => {
    const p = toks[toks.length - 1]
    return !p || (p.t === 'op' && !')]'.includes(p.v)) || p.t === 'kw'
  }
  while (i < src.length) {
    const c = src[i]
    if (c === '\n' || c === ';') { toks.push({ t: 'op', v: ';' }); i++; continue }
    if (/\s/.test(c)) { i++; continue }
    if (c === '"') {
      let s = ''
      i++
      while (i < src.length && src[i] !== '"') {
        if (src[i] === '\\') { const n = src[++i]; s += n === 'n' ? '\n' : n === 't' ? '\t' : n } else s += src[i]
        i++
      }
      i++
      toks.push({ t: 'str', v: s })
      continue
    }
    if (c === '/' && prevAllowsRegex()) {
      let s = ''
      i++
      while (i < src.length && src[i] !== '/') { if (src[i] === '\\') s += src[i++]; s += src[i++] }
      i++
      toks.push({ t: 're', v: s })
      continue
    }
    const num = src.slice(i).match(/^\d+(\.\d+)?/)
    if (num) { toks.push({ t: 'num', v: parseFloat(num[0]) }); i += num[0].length; continue }
    const id = src.slice(i).match(/^[A-Za-z_]\w*/)
    if (id) {
      const w = id[0]
      toks.push({ t: ['BEGIN', 'END', 'print', 'if', 'else', 'for', 'in', 'printf'].includes(w) ? 'kw' : 'id', v: w })
      i += w.length
      continue
    }
    const op = src.slice(i).match(/^(\+\+|--|\+=|-=|\*=|\/=|==|!=|>=|<=|!~|&&|\|\||[-+*/%<>=!~(){}[\],$])/)
    if (op) { toks.push({ t: 'op', v: op[0] }); i += op[0].length; continue }
    fail(`awk: syntax error at '${src.slice(i, i + 10)}'`)
  }
  return toks
}

function parseAwk(src) {
  const toks = lexAwk(src)
  let p = 0
  const peek = (v) => toks[p] && toks[p].v === v
  const eat = (v) => { if (!peek(v)) fail(`awk: syntax error: expected '${v}'${toks[p] ? ` near '${toks[p].v}'` : ''}`); return toks[p++] }
  const skipSemis = () => { while (peek(';')) p++ }

  function block() {
    eat('{')
    const stmts = []
    skipSemis()
    while (!peek('}')) {
      if (p >= toks.length) fail('awk: missing }')
      stmts.push(statement())
      skipSemis()
    }
    eat('}')
    return stmts
  }
  function statement() {
    if (peek('{')) return { k: 'block', body: block() }
    if (peek('print') || peek('printf')) {
      const isF = toks[p++].v === 'printf'
      const argsList = []
      if (!peek(';') && !peek('}')) {
        argsList.push(expr())
        while (peek(',')) { p++; argsList.push(expr()) }
      }
      return { k: isF ? 'printf' : 'print', args: argsList }
    }
    if (peek('if')) {
      p++
      eat('(')
      const cond = expr()
      eat(')')
      skipSemis()
      const then = statement()
      let els = null
      skipSemis()
      if (peek('else')) { p++; skipSemis(); els = statement() }
      return { k: 'if', cond, then, els }
    }
    if (peek('for')) {
      p++
      eat('(')
      const v = toks[p++].v
      eat('in')
      const arr = toks[p++].v
      eat(')')
      skipSemis()
      return { k: 'forin', v, arr, body: statement() }
    }
    return { k: 'expr', e: expr() }
  }
  function expr() { return assign() }
  function assign() {
    const left = or()
    if (toks[p] && ['=', '+=', '-=', '*=', '/='].includes(toks[p].v) && (left.k === 'var' || left.k === 'idx' || left.k === 'field')) {
      const op = toks[p++].v
      return { k: 'assign', op, target: left, value: assign() }
    }
    return left
  }
  function or() { let l = and(); while (peek('||')) { p++; l = { k: 'bin', op: '||', l, r: and() } } return l }
  function and() { let l = match(); while (peek('&&')) { p++; l = { k: 'bin', op: '&&', l, r: match() } } return l }
  function match() {
    let l = compare()
    while (peek('~') || peek('!~')) {
      const op = toks[p++].v
      const r = toks[p] && toks[p].t === 're' ? { k: 'relit', v: toks[p++].v } : compare()
      l = { k: 'match', neg: op === '!~', l, r }
    }
    return l
  }
  function compare() {
    const l = concat()
    if (toks[p] && ['==', '!=', '<', '>', '<=', '>='].includes(toks[p].v)) {
      const op = toks[p++].v
      return { k: 'cmp', op, l, r: concat() }
    }
    return l
  }
  function startsPrimary() {
    const t = toks[p]
    if (!t) return false
    if (['num', 'str', 'id', 're'].includes(t.t)) return true
    return t.t === 'op' && ['$', '(', '!', '-'].includes(t.v) && t.v !== '-'
  }
  function concat() {
    let l = add()
    while (startsPrimary() && !peek('in')) l = { k: 'cat', l, r: add() }
    return l
  }
  function add() { let l = mul(); while (peek('+') || peek('-')) { const op = toks[p++].v; l = { k: 'bin', op, l, r: mul() } } return l }
  function mul() { let l = unary(); while (peek('*') || peek('/') || peek('%')) { const op = toks[p++].v; l = { k: 'bin', op, l, r: unary() } } return l }
  function unary() {
    if (peek('!')) { p++; return { k: 'not', e: unary() } }
    if (peek('-')) { p++; return { k: 'neg', e: unary() } }
    return postfix()
  }
  function postfix() {
    const e = primary()
    if ((peek('++') || peek('--')) && (e.k === 'var' || e.k === 'idx')) { const op = toks[p++].v; return { k: 'incr', op, target: e } }
    return e
  }
  function primary() {
    const t = toks[p++]
    if (!t) fail('awk: unexpected end of program')
    if (t.t === 'num') return { k: 'num', v: t.v }
    if (t.t === 'str') return { k: 'str', v: t.v }
    if (t.t === 're') return { k: 'match', neg: false, l: { k: 'field', e: { k: 'num', v: 0 } }, r: { k: 'relit', v: t.v } }
    if (t.v === '$') return { k: 'field', e: primary() }
    if (t.v === '(') { const e = expr(); eat(')'); return e }
    if (t.v === '++' || t.v === '--') { const target = primary(); return { k: 'incr', op: t.v, target, pre: true } }
    if (t.t === 'id') {
      if (peek('(')) {
        p++
        const a = []
        if (!peek(')')) { a.push(expr()); while (peek(',')) { p++; a.push(expr()) } }
        eat(')')
        return { k: 'call', name: t.v, args: a }
      }
      if (peek('[')) { p++; const key = expr(); eat(']'); return { k: 'idx', name: t.v, key } }
      return { k: 'var', name: t.v }
    }
    fail(`awk: syntax error near '${t.v}'`)
  }

  const rules = []
  skipSemis()
  while (p < toks.length) {
    if (peek('BEGIN')) { p++; rules.push({ type: 'BEGIN', body: block() }) }
    else if (peek('END')) { p++; rules.push({ type: 'END', body: block() }) }
    else if (peek('{')) rules.push({ type: 'main', pattern: null, body: block() })
    else {
      const pattern = expr()
      rules.push({ type: 'main', pattern, body: peek('{') ? block() : null })
    }
    skipSemis()
  }
  return rules
}

function runAwk(rules, input, fs) {
  const vars = { NR: 0, NF: 0, FS: fs ?? ' ', OFS: ' ' }
  const arrays = {}
  let fields = []
  let out = ''
  const isNum = (v) => typeof v === 'number' || (typeof v === 'string' && /^\s*-?\d+(\.\d+)?([eE][-+]?\d+)?\s*$/.test(v))
  const toNum = (v) => (typeof v === 'number' ? v : parseFloat(v) || 0)
  const toStr = (v) => (typeof v === 'number' ? (Number.isInteger(v) ? String(v) : String(+v.toPrecision(6))) : String(v ?? ''))
  const truthy = (v) => (typeof v === 'number' ? v !== 0 : v !== '' && v !== undefined)
  const split = (line) => {
    if (vars.FS === ' ') return line.trim() ? line.trim().split(/\s+/) : []
    if (vars.FS.length === 1) return line.split(vars.FS)
    return line.split(new RegExp(vars.FS))
  }
  const getField = (n) => (n === 0 ? fields.line : fields[n - 1] ?? '')

  function lval(t, value) {
    if (t.k === 'var') vars[t.name] = value
    else if (t.k === 'idx') { arrays[t.name] = arrays[t.name] ?? {}; arrays[t.name][toStr(ev(t.key))] = value }
    else if (t.k === 'field') { const n = toNum(ev(t.e)); if (n === 0) fields.line = toStr(value); else fields[n - 1] = toStr(value) }
  }
  function ev(e) {
    switch (e.k) {
      case 'num': return e.v
      case 'str': return e.v
      case 'field': return getField(toNum(ev(e.e)))
      case 'var':
        if (e.name === 'NF') return fields.length
        return vars[e.name] ?? ''
      case 'idx': return (arrays[e.name] ?? {})[toStr(ev(e.key))] ?? ''
      case 'cat': return toStr(ev(e.l)) + toStr(ev(e.r))
      case 'not': return truthy(ev(e.e)) ? 0 : 1
      case 'neg': return -toNum(ev(e.e))
      case 'relit': return e.v
      case 'match': {
        const re = new RegExp(e.r.k === 'relit' ? e.r.v : toStr(ev(e.r)))
        return re.test(toStr(ev(e.l))) !== e.neg ? 1 : 0
      }
      case 'cmp': {
        const a = ev(e.l)
        const b = ev(e.r)
        const both = isNum(a) && isNum(b)
        const x = both ? toNum(a) : toStr(a)
        const y = both ? toNum(b) : toStr(b)
        return { '==': x === y, '!=': x !== y, '<': x < y, '>': x > y, '<=': x <= y, '>=': x >= y }[e.op] ? 1 : 0
      }
      case 'bin': {
        if (e.op === '&&') return truthy(ev(e.l)) && truthy(ev(e.r)) ? 1 : 0
        if (e.op === '||') return truthy(ev(e.l)) || truthy(ev(e.r)) ? 1 : 0
        const a = toNum(ev(e.l))
        const b = toNum(ev(e.r))
        return { '+': a + b, '-': a - b, '*': a * b, '/': b ? a / b : fail('awk: division by zero'), '%': a % b }[e.op]
      }
      case 'assign': {
        const cur = toNum(ev(e.target))
        const v = ev(e.value)
        const next = e.op === '=' ? v : { '+=': cur + toNum(v), '-=': cur - toNum(v), '*=': cur * toNum(v), '/=': cur / toNum(v) }[e.op]
        lval(e.target, next)
        return next
      }
      case 'incr': {
        const cur = toNum(ev(e.target))
        const next = e.op === '++' ? cur + 1 : cur - 1
        lval(e.target, next)
        return e.pre ? next : cur
      }
      case 'call': {
        const a = e.args.map(ev)
        if (e.name === 'length') return toStr(a.length ? a[0] : fields.line).length
        if (e.name === 'tolower') return toStr(a[0]).toLowerCase()
        if (e.name === 'toupper') return toStr(a[0]).toUpperCase()
        if (e.name === 'substr') return toStr(a[0]).substr(toNum(a[1]) - 1, a[2] === undefined ? undefined : toNum(a[2]))
        fail(`awk: function ${e.name} is not supported here`)
      }
      // falls through
      default: fail('awk: unsupported expression')
    }
  }
  function exec(stmts) {
    for (const s of stmts) {
      if (s.k === 'print') out += `${(s.args.length ? s.args.map((a) => toStr(ev(a))) : [fields.line]).join(vars.OFS)}\n`
      else if (s.k === 'printf') {
        const [fmt, ...rest] = s.args.map(ev)
        let i = 0
        out += toStr(fmt).replace(/%(-?\d*)(\.\d+)?([sdf%])/g, (_, w, prec, c) => {
          if (c === '%') return '%'
          const v = rest[i++]
          let str = c === 'd' ? String(Math.trunc(toNum(v))) : c === 'f' ? toNum(v).toFixed(prec ? parseInt(prec.slice(1), 10) : 6) : toStr(v)
          const width = parseInt(w || '0', 10)
          if (Math.abs(width) > str.length) str = width < 0 ? str.padEnd(-width) : str.padStart(width)
          return str
        })
      } else if (s.k === 'expr') ev(s.e)
      else if (s.k === 'block') exec(s.body)
      else if (s.k === 'if') { if (truthy(ev(s.cond))) exec([s.then]); else if (s.els) exec([s.els]) }
      else if (s.k === 'forin') for (const key of Object.keys(arrays[s.arr] ?? {})) { vars[s.v] = key; exec([s.body]) }
    }
  }

  fields = Object.assign([], { line: '' })
  for (const r of rules) if (r.type === 'BEGIN') exec(r.body)
  for (const line of input) {
    vars.NR++
    fields = Object.assign(split(line), { line })
    for (const r of rules) {
      if (r.type !== 'main') continue
      if (r.pattern && !truthy(ev(r.pattern))) continue
      if (r.body) exec(r.body)
      else out += `${line}\n`
    }
  }
  for (const r of rules) if (r.type === 'END') exec(r.body)
  return out
}

/* ---------------- SHA-256 (sync, UTF-8) ---------------- */
const K = new Uint32Array([
  0x428a2f98, 0x71374491, 0xb5c0fbcf, 0xe9b5dba5, 0x3956c25b, 0x59f111f1, 0x923f82a4, 0xab1c5ed5, 0xd807aa98, 0x12835b01, 0x243185be, 0x550c7dc3,
  0x72be5d74, 0x80deb1fe, 0x9bdc06a7, 0xc19bf174, 0xe49b69c1, 0xefbe4786, 0x0fc19dc6, 0x240ca1cc, 0x2de92c6f, 0x4a7484aa, 0x5cb0a9dc, 0x76f988da,
  0x983e5152, 0xa831c66d, 0xb00327c8, 0xbf597fc7, 0xc6e00bf3, 0xd5a79147, 0x06ca6351, 0x14292967, 0x27b70a85, 0x2e1b2138, 0x4d2c6dfc, 0x53380d13,
  0x650a7354, 0x766a0abb, 0x81c2c92e, 0x92722c85, 0xa2bfe8a1, 0xa81a664b, 0xc24b8b70, 0xc76c51a3, 0xd192e819, 0xd6990624, 0xf40e3585, 0x106aa070,
  0x19a4c116, 0x1e376c08, 0x2748774c, 0x34b0bcb5, 0x391c0cb3, 0x4ed8aa4a, 0x5b9cca4f, 0x682e6ff3, 0x748f82ee, 0x78a5636f, 0x84c87814, 0x8cc70208,
  0x90befffa, 0xa4506ceb, 0xbef9a3f7, 0xc67178f2,
])

export function sha256(text) {
  const msg = new TextEncoder().encode(text)
  const len = msg.length
  const total = (((len + 9) >> 6) + 1) << 6
  const buf = new Uint8Array(total)
  buf.set(msg)
  buf[len] = 0x80
  const view = new DataView(buf.buffer)
  view.setUint32(total - 4, (len * 8) >>> 0)
  view.setUint32(total - 8, Math.floor(len / 0x20000000))
  const H = new Uint32Array([0x6a09e667, 0xbb67ae85, 0x3c6ef372, 0xa54ff53a, 0x510e527f, 0x9b05688c, 0x1f83d9ab, 0x5be0cd19])
  const W = new Uint32Array(64)
  const rotr = (x, n) => (x >>> n) | (x << (32 - n))
  for (let off = 0; off < total; off += 64) {
    for (let i = 0; i < 16; i++) W[i] = view.getUint32(off + i * 4)
    for (let i = 16; i < 64; i++) {
      const s0 = rotr(W[i - 15], 7) ^ rotr(W[i - 15], 18) ^ (W[i - 15] >>> 3)
      const s1 = rotr(W[i - 2], 17) ^ rotr(W[i - 2], 19) ^ (W[i - 2] >>> 10)
      W[i] = (W[i - 16] + s0 + W[i - 7] + s1) >>> 0
    }
    let [a, b, c, d, e, f, g, h] = H
    for (let i = 0; i < 64; i++) {
      const t1 = (h + (rotr(e, 6) ^ rotr(e, 11) ^ rotr(e, 25)) + ((e & f) ^ (~e & g)) + K[i] + W[i]) >>> 0
      const t2 = ((rotr(a, 2) ^ rotr(a, 13) ^ rotr(a, 22)) + ((a & b) ^ (a & c) ^ (b & c))) >>> 0
      h = g; g = f; f = e; e = (d + t1) >>> 0; d = c; c = b; b = a; a = (t1 + t2) >>> 0
    }
    H[0] += a; H[1] += b; H[2] += c; H[3] += d; H[4] += e; H[5] += f; H[6] += g; H[7] += h
  }
  return [...H].map((x) => x.toString(16).padStart(8, '0')).join('')
}
