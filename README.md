# CySA+ Study

A study companion for the CompTIA CySA+ **CS0-004** (V4) exam, which launched on 23 June 2026. It's built with Vite + React and is a static site, so Vercel can host it without a server.

```
npm install
npm run dev
```

## What's in it

| Section | What it does |
|---|---|
| Dashboard | Exam-day countdown, what to study and which lab to do next, weakest objective, progress per domain, exam history. |
| Study guide | All 15 V4 objectives across the 4 domains (34 / 26 / 24 / 16%), with CompTIA's scope line, topics, original notes and exam tips. |
| **PBQ labs** | Hands-on performance-based questions. Investigate in a simulated Linux terminal, click suspicious log lines, configure firewall rules, order IR steps and classify findings in drag-and-drop style grids. Partial-credit scoring, explanations and a full solution for each lab. |
| Practice questions | Scenario MCQs tagged by objective, many with log, packet, header or scan exhibits. |
| Exam simulator | A timed run that opens with PBQ labs, like the real exam, then MCQs weighted by domain. Flagging, a question grid and a review of every PBQ and MCQ. |
| Flashcards | Terms and acronyms with "Again" / "Got it" tracking, plus a searchable glossary. |
| CVSS calculator | CVSS v3.1 base score (FIRST spec), vector paste, and a severity drill. |
| Reference | Kill Chain, Diamond Model, ATT&CK tactics, NIST IR life cycle, order of volatility, control types, ports, Windows Event IDs, command sheets. |

Progress is stored in `localStorage`. Nothing is sent anywhere.

## About the CS0-004 objective list

CompTIA's V4 page lists the 15 objectives in order, with a one-line scope each but no numbers or sub-bullets. The site numbers them in that order (1.1–1.6, 2.1–2.4, 3.1–3.3, 4.1–4.2). The topic lists under each objective are built from CompTIA's scope lines plus the CS0-003 outline they replace. They are not CompTIA's wording. Check them against the official objectives PDF when you have it, and edit `src/data/objectives.js`.

## The PBQ labs (`src/data/labs/`, `src/lib/`)

| File | Role |
|---|---|
| `src/lib/shell.js` | A pure-JS analyst shell over each lab's virtual files. It supports pipes plus `grep` (BRE/ERE, `-i -v -c -n -o -w -l -r -A -B`), `awk` (patterns, fields, arrays, `END`, `printf`), `sort`, `uniq -c`, `cut`, `tr`, `head`, `tail`, `wc`, `base64 -d` (including PowerShell UTF-16LE), `sha256sum`, `strings` and `find`. |
| `src/lib/grade.js` | Task types (`input`, `single`, `multi`, `lines`, `order`, `grid`), partial-credit scoring, and `validateLab`. |
| `src/data/labs/*.js` | One file per lab: scenario, evidence `files` / `artifacts`, `hints`, and `tasks`. Add the file to `index.js`. |
| `scripts/validate-labs.mjs` | `node scripts/validate-labs.mjs` checks every lab: answer keys are consistent, the solution scores 100%, and every terminal task's `cmd` really prints its answer from the evidence. |

## Content

All study content is plain data in `src/data/`: `objectives.js`, `notes.js`, `questions.js`, `terms.js`, `reference.js` and `labs/`. Add an item with the right `objective` and it shows up in the filters, the dashboard and the exam simulator.

## Deploy to Vercel

1. Push this folder to a GitHub repo.
2. In Vercel, choose **Add New → Project** and import the repo. Vercel detects Vite (and `vercel.json` pins the build `npm run build` and output `dist`).
3. Deploy.

Or from the terminal: `npx vercel`, then `npx vercel --prod`. Routing uses the URL hash, so no rewrite rules are needed.

## Note

This site is unofficial and not affiliated with CompTIA. All notes, questions, labs and definitions are original.
