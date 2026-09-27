# CLAUDE.md

WPA Desk: a training simulator for Writing Program Administrators, built on a
program model that should also serve a future working-WPA planning tool.
Design: `docs/DESIGN.md`.

## Commands

```bash
npm run dev        # Vite dev server
npm test           # Vitest (model tests)
npm run typecheck  # core (model + training, no DOM) + app
npm run build
```

## Architecture rules

- Layers: `src/model/` (program model) ← `src/training/` (scenarios,
  evidence, memos, session) ← `src/content/` (YAML loader) ← `src/app/` (React).
  Each imports only from layers to its left, via their `index.ts`.
- `src/model/` and `src/training/` are pure TypeScript: no React, no DOM.
  `tsconfig.core.json` compiles them with only the ES library to enforce this.
  The model must not assume training mode.
- Every numeric relationship lives in `src/model/assumptions.ts` with a
  range, a confidence label, and sources. Don't hide magic numbers in
  calculations.
- Projections report ranges (`Range`), never a lone number.
- State changes go through `ProgramChange` + `applyChanges()` (immutable).
  Scenario effects and what-if tools share this vocabulary.
- D/F/W is calibrated to each course's observed `baselineDfw` at
  `baselineSectionSize`; only the change from baseline moves it.
- Scenarios are YAML in `src/content/scenarios/`, validated by
  `parseScenario()` on load (errors name the exact field). Delayed effects
  belong to a specific consequence, not to the option.
- Persuasion is decided mechanically by attached evidence kinds plus the
  reader's trust against their persuasion profile (`src/content/cast/`),
  never by grading memo prose. Pass `CAST` to `resolveScenario`; without it
  the default profile applies.
- `src/app/__tests__/` has jsdom playthrough tests; add one per scenario.
- Scenario prose states the program's numbers through `{{placeholders}}`
  (see `src/training/template.ts`), never as fixed values, so text stays true
  under varied starting conditions (planned class settings; see "Class
  settings and variation" in DESIGN.md). Fixed numbers are fine only for a
  scenario's own parameters that match its changes.
- A YAML error makes every test file that imports content fail to load, so
  check the "Test Files" line, not just "Tests". Quote YAML strings that
  contain ": ".
- Saves: `src/training/save.ts` defines a versioned format (`SAVE_VERSION`)
  and validates untrusted input with player-readable errors. If you change
  the shape of `TrainingSession` or `Program`, bump the version and add a
  migration in `parseSave`. Browser storage lives in `src/app/storage.ts`
  (all access guarded; autosave + 3 slots + file export/import).
- UI tests must `localStorage.clear()` in `beforeEach` (autosave persists
  across renders). `src/test-setup.ts` restores jsdom's localStorage, which
  Node 25's built-in stub otherwise shadows.
- Instructor review (`src/app/ReviewMode.tsx`, summaries in
  `src/training/review.ts`) opens student saves read-only and in memory; it
  must never call the game's session setters or write storage. `Dossier`
  is read-only when given no edit handlers.
- `src/test-fixtures/` holds reusable student sessions for tests.
- Long-term goal: a hosted multi-user version; see `docs/ROADMAP.md` before
  making choices that would only work local-only.
- Arcs (`src/content/arcs/*.yaml`, parsed by `parseArc()`) set a
  playthrough's length, role changes, and scenario calendar. The app plays
  `STANDARD_ARC`; pass the session's arc to `advanceTerm` (it checks). A
  session without an arc is free play: triggers only, no calendar. New
  scenarios must be added to the arc's calendar or they never arrive.
- The player's supervisor, Dr. Nora Cherry, is stakeholder `fyw_director`.
- Character pronouns: Dean Alvarez he/him; Dr. Cherry she/her. Don't
  guess others; write around pronouns until they're confirmed.
- In the standard arc a year-end report is due every spring, and uncovered
  sections need a staffing decision (`routineStaffing`); both block the
  term. Engine tests use `closeOutTerm` (`src/test-fixtures/reports.ts`),
  which hires for gaps and submits due reports; UI tests use
  `resolveUrgent` and `submitYearEndReport` (`src/app/__tests__/helpers.ts`).
- Urgent scenarios block the term: The Grade Appeal Escalation and The Late
  Hire (if triggered) in Spring Y1, The Accreditation Ask in Fall Y2, The
  Cap Review in Spring Y2 (only after a Cap Memo compromise or reprieve),
  The Writing Center Budget Swap in Fall Y3.
  Engine tests pass only the scenarios they cover; UI playthroughs call
  `resolveUrgent` from the helpers (add new urgent scenarios to its list)
  and advance with `getByRole("button", { name: /advance/i })`, since
  non-urgent items left waiting change the button's label.
  Submitting the Spring Y3 capstone sets `session.ending` and ends play.
- Scenarios interact (e.g., holding caps at 24 makes The Late Hire arrive in
  Spring Y1; raising them to 27 drives adjuncts away so it arrives in Spring
  Y2). Multi-term tests must resolve urgent scenarios before advancing, or
  pass only the scenarios they need.

## Environment notes

- Remote: `origin` is the private GitHub repo `ericshayhoward/wpa-desk`.
- The desktop app's preview server can't access Google Drive folders
  (EPERM on cwd), so browser previews of this repo fail there. Verify UI
  with the jsdom playthrough tests instead.
