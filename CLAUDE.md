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
- Persuasion is decided mechanically by attached evidence kinds, never by
  grading memo prose.
- `src/app/__tests__/` has jsdom playthrough tests; add one per scenario.

## Environment notes

- On this Mac, `/usr/bin/git` is blocked by an unaccepted Xcode license; use
  `/Library/Developer/CommandLineTools/usr/bin/git` until it's accepted.
- The desktop app's preview server can't access Google Drive folders
  (EPERM on cwd), so browser previews of this repo fail there. Verify UI
  with the jsdom playthrough tests instead.
