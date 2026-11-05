import { useEffect, useRef, useState } from 'react'

const COMMAND_NAMES = ['awk', 'base64', 'cat', 'cd', 'clear', 'cut', 'echo', 'find', 'grep', 'head', 'help', 'history', 'less', 'ls', 'pwd', 'sha256sum', 'sort', 'strings', 'tail', 'tr', 'uniq', 'wc']

// Interactive terminal over a Shell instance (src/lib/shell.js)
export default function Terminal({ shell, intro }) {
  const [log, setLog] = useState(() => [{ kind: 'out', text: intro }])
  const [line, setLine] = useState('')
  const [hist, setHist] = useState({ list: [], pos: -1 })
  const endRef = useRef(null)
  const inputRef = useRef(null)

  useEffect(() => {
    endRef.current?.scrollIntoView({ block: 'nearest' })
  }, [log])

  const prompt = () => `analyst@soc:${shell.cwd.replace(/^\/home\/analyst/, '~')}$`

  function submit(e) {
    e.preventDefault()
    const cmd = line
    setLine('')
    setHist({ list: cmd.trim() ? [...hist.list, cmd] : hist.list, pos: -1 })
    if (cmd.trim() === 'clear') { setLog([]); return }
    const p = prompt()
    const r = shell.run(cmd)
    const add = [{ kind: 'cmd', text: `${p} ${cmd}` }]
    if (r.err) add.push({ kind: 'err', text: r.err })
    else if (r.out) {
      // Long outputs are capped so the page stays responsive; pipe to head/tail/grep to narrow it
      const ls = r.out.replace(/\n$/, '').split('\n')
      add.push({ kind: 'out', text: ls.length > 400 ? `${ls.slice(0, 400).join('\n')}\n… ${ls.length - 400} more lines (pipe to head, tail or grep)` : ls.join('\n') })
    }
    setLog((l) => [...l, ...add].slice(-300))
  }

  function onKey(e) {
    if (e.key === 'ArrowUp' || e.key === 'ArrowDown') {
      e.preventDefault()
      const { list, pos } = hist
      if (!list.length) return
      const next = e.key === 'ArrowUp' ? (pos < 0 ? list.length - 1 : Math.max(0, pos - 1)) : pos < 0 ? -1 : pos + 1
      if (next >= list.length || next < 0) { setHist({ list, pos: -1 }); setLine(''); return }
      setHist({ list, pos: next })
      setLine(list[next])
    } else if (e.key === 'Tab') {
      e.preventDefault()
      setLine(complete(line, shell))
    } else if (e.key === 'l' && e.ctrlKey) {
      e.preventDefault()
      setLog([])
    }
  }

  return (
    <div className="terminal" onClick={() => window.getSelection()?.isCollapsed && inputRef.current?.focus()}>
      <div className="term-scroll" aria-live="polite">
        {log.map((x, i) => <pre key={i} className={`term-${x.kind}`}>{x.text}</pre>)}
        <form onSubmit={submit} className="term-line">
          <label htmlFor="term-input" className="term-prompt">{prompt()}</label>
          <input
            id="term-input"
            ref={inputRef}
            value={line}
            onChange={(e) => setLine(e.target.value)}
            onKeyDown={onKey}
            autoComplete="off"
            autoCapitalize="off"
            autoCorrect="off"
            spellCheck={false}
            aria-label="Terminal command"
          />
        </form>
        <div ref={endRef} />
      </div>
    </div>
  )
}

// Tab completion: command names for the first word, file and directory paths after that
function complete(line, shell) {
  const m = line.match(/^(.*?)(\S*)$/)
  const before = m[1]
  const word = m[2]
  if (!before.trim() || /\|\s*$/.test(before)) {
    const hits = COMMAND_NAMES.filter((c) => c.startsWith(word))
    return hits.length === 1 ? `${before}${hits[0]} ` : line
  }
  const slash = word.lastIndexOf('/')
  const dirPart = slash >= 0 ? word.slice(0, slash + 1) : ''
  const namePart = word.slice(slash + 1)
  const dirAbs = shell.resolve(dirPart || '.')
  const base = dirAbs === '/' ? '/' : `${dirAbs}/`
  const names = new Map()
  for (const f of Object.keys(shell.files)) {
    if (!f.startsWith(base)) continue
    const [name, ...more] = f.slice(base.length).split('/')
    if (name.startsWith(namePart)) names.set(name, more.length > 0)
  }
  if (names.size === 1) {
    const [[name, isDir]] = [...names]
    return `${before}${dirPart}${name}${isDir ? '/' : ' '}`
  }
  if (names.size > 1) {
    const list = [...names.keys()]
    let prefix = list[0]
    for (const n of list) while (!n.startsWith(prefix)) prefix = prefix.slice(0, -1)
    return `${before}${dirPart}${prefix}`
  }
  return line
}
