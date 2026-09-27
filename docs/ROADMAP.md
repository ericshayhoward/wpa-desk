# WPA Desk — Roadmap

Living list of what's next and what's further out. Design details live in
`DESIGN.md`.

## Near term

- ~~**Instructor review mode**~~ — done: read-only review of student save
  files (class overview with CSV download, per-scenario choice summary,
  per-student case files). Follow-ups: sortable columns; remembering opened
  files between visits.
- **The standard arc** — 3 years ending in a Year 3 annual report (see
  "Arcs" in `DESIGN.md`). Order: arc format and richer triggers, then the
  ending and year-end structure, then the remaining v1 scenarios.
- **Instructor feedback round-trip** — comments on memos and reflections,
  saved as a feedback file the student imports and sees in their case files.
- **Memory** — characters quote the player's past memos and commitments back
  ("Last fall you told me caps above 25 would raise D/F/W…"). Commitments
  link to the memo they came from.
- **More scenarios** — The Detector, The Dual-Enrollment Drop, The DSP Pilot,
  The Accreditation Ask, and the rest of the v1 set in `DESIGN.md`.
- **Named instructors** — a small cast of individual instructors alongside
  the aggregate pools.

## Later: a hosted application

Goal: run WPA Desk as a website with accounts for three kinds of users:

- **Students** (GTA practicum, WPA seminar) — play training scenarios,
  build case files, submit work, receive feedback.
- **Instructors** — create classes, assign scenarios, review submissions and
  drafting history, give feedback, see class-level summaries.
- **Working WPAs** — use the tools (cap calculator, staffing planner, and
  future assessment and reporting tools) on their own program's data, in
  working mode, with no training layer.

Things to think through before building it:

- **Accounts and roles** — student, instructor, WPA; classes and rosters;
  institutional sign-in (SSO) vs. email accounts.
- **Server storage** — saves, case files, and drafting history stored
  server-side. This also solves save-file authenticity, which local files
  can't guarantee.
- **Student privacy** — student work and drafting history are education
  records; review institutional and legal requirements (e.g., FERPA in the
  US) before storing them, and minimize what's collected.
- **Course platform integration** — LTI so the tool can launch from Canvas,
  Blackboard, Moodle, etc., and return grades.
- **Working-mode data** — importing a real program's schedule and staffing
  data; keeping it private to that WPA or institution.
- **Content authoring** — letting instructors add or adapt scenarios and
  casts (the YAML formats were designed with this in mind).
- **Keeping local-first working** — the offline, file-based version should
  keep working for individual use.

Architecture already chosen with this in mind:

- The program model and training layer are pure TypeScript with no DOM or
  UI dependencies, so they can run on a server as well as in the browser.
- Browser storage is isolated in `src/app/storage.ts`, so a server-backed
  storage adapter can replace it.
- Saves are versioned with validation and migrations, which a server can
  reuse for stored sessions.
- Content (scenarios, casts) is data, not code.
