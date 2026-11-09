import { lazy, Suspense, useEffect, useState } from 'react'
import './App.css'
import './labs.css'
import Sidebar from './components/Sidebar.jsx'
import Home from './components/Home.jsx'
import { useStored } from './hooks/useStored.js'
import { KEYS } from './progress.js'

// Notes, the question bank, flashcards and lab evidence are large, so each section loads on demand
const Guide = lazy(() => import('./components/Guide.jsx'))
const Labs = lazy(() => import('./components/Labs.jsx'))
const Practice = lazy(() => import('./components/Practice.jsx'))
const Exam = lazy(() => import('./components/Exam.jsx'))
const Flashcards = lazy(() => import('./components/Flashcards.jsx'))
const Cvss = lazy(() => import('./components/Cvss.jsx'))
const Reference = lazy(() => import('./components/Reference.jsx'))

export const SECTIONS = [
  { id: 'home', label: 'Dashboard', view: Home },
  { id: 'guide', label: 'Study guide', view: Guide },
  { id: 'labs', label: 'PBQ labs', view: Labs },
  { id: 'practice', label: 'Practice questions', view: Practice },
  { id: 'exam', label: 'Exam simulator', view: Exam },
  { id: 'cards', label: 'Flashcards', view: Flashcards },
  { id: 'cvss', label: 'CVSS calculator', view: Cvss },
  { id: 'reference', label: 'Reference', view: Reference },
]

// Routes live in the hash (#/practice?f=2.3) so refresh and back button work on any static host
function parseHash() {
  const [path, query = ''] = window.location.hash.replace(/^#\/?/, '').split('?')
  const view = SECTIONS.some((s) => s.id === path) ? path : 'home'
  return { view, params: Object.fromEntries(new URLSearchParams(query)) }
}

export function navigate(view, params = {}) {
  const q = new URLSearchParams(params).toString()
  window.location.hash = `/${view}${q ? `?${q}` : ''}`
}

export default function App() {
  const [route, setRoute] = useState(parseHash)
  const [theme] = useStored(KEYS.theme, 'system')

  useEffect(() => {
    const onHash = () => {
      setRoute(parseHash())
      window.scrollTo({ top: 0 })
    }
    window.addEventListener('hashchange', onHash)
    return () => window.removeEventListener('hashchange', onHash)
  }, [])

  useEffect(() => {
    const root = document.documentElement
    if (theme === 'system') root.removeAttribute('data-theme')
    else root.setAttribute('data-theme', theme)
  }, [theme])

  const section = SECTIONS.find((s) => s.id === route.view)
  const View = section.view
  useEffect(() => {
    document.title = route.view === 'home' ? 'CySA+ Study' : `${section.label} · CySA+ Study`
  }, [route.view, section.label])

  return (
    <div className="shell">
      <Sidebar active={route.view} />
      <div className="main-col">
        {/* key resets per-view state when the route's params change */}
        <main className={`content ${route.view === 'labs' && route.params.lab ? 'wide' : ''}`} key={window.location.hash}>
          <Suspense fallback={<p className="muted">Loading…</p>}>
            <View params={route.params} />
          </Suspense>
        </main>
        <footer className="foot">
          Unofficial study aid for CompTIA CySA+ (CS0-004). All notes, questions and labs are original. Not affiliated with or
          endorsed by CompTIA. Progress is stored only in this browser.
        </footer>
      </div>
    </div>
  )
}
