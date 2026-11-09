import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { resolve } from 'node:path'
import { pathToFileURL } from 'node:url'

// `virtual:catalog` gives the sidebar and dashboard just the question ids and term names per objective,
// so the first page load doesn't pull in the full question bank, flashcards and notes (~1 MB of text).
function catalog() {
  const id = 'virtual:catalog'
  const files = ['questions.js', 'terms.js'].map((f) => resolve('src/data', f))
  return {
    name: 'cysa-catalog',
    resolveId: (source) => (source === id ? '\0' + id : null),
    async load(source) {
      if (source !== '\0' + id) return null
      files.forEach((f) => this.addWatchFile(f))
      const bust = `?t=${Date.now()}`
      const [{ QUESTIONS }, { TERMS }] = await Promise.all(files.map((f) => import(pathToFileURL(f).href + bust)))
      const group = (list, key, value) =>
        list.reduce((acc, x) => ((acc[x[key]] ??= []).push(x[value]), acc), {})
      return [
        `export const QUESTION_IDS = ${JSON.stringify(group(QUESTIONS, 'objective', 'id'))}`,
        `export const TERM_NAMES = ${JSON.stringify(group(TERMS, 'objective', 'term'))}`,
        `export const QUESTION_COUNT = ${QUESTIONS.length}`,
        `export const TERM_COUNT = ${TERMS.length}`,
      ].join('\n')
    },
  }
}

export default defineConfig({
  plugins: [react(), catalog()],
})
