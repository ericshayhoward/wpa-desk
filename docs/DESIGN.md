# WPA Desk — Design Draft

_Status: draft v0.1 · 2026-09-27_

## 1. Purpose

A professional training environment for aspiring and new Writing Program
Administrators, built on a program model that can later power a real planning
tool for working WPAs.

**Core principle:** training mode *is* the real tool, running on a fictional
program with scenarios injected. The trainee uses the same staffing planner,
budget view, and stakeholder map a working WPA would use — so skills transfer,
and every tool built for training is already a tool for practice.

```
┌──────────────────────────────────────────────────────────┐
│  UI                                                      │
│   Training mode: scenario inbox, debrief, career arc     │
│   Working mode (later): dashboards, reports, data import │
├──────────────────────────────────────────────────────────┤
│  Tools (shared by both modes)                            │
│   Staffing & schedule planner · Cap/cost calculator      │
│   Stakeholder map · Assessment tracker · Report builder  │
├──────────────────────────────────────────────────────────┤
│  Scenario layer (training only)                          │
│   Authored scenario files · triggers · effects · debrief │
├──────────────────────────────────────────────────────────┤
│  Program model (pure logic, no UI)                       │
│   Entities · assumptions · term projection · history     │
└──────────────────────────────────────────────────────────┘
```

Rule: nothing below the UI layer knows whether it is in training or working
mode. The scenario layer only *reads* the model and *proposes changes* to it.

## 2. Audience

| Priority | User | Needs |
|---|---|---|
| Primary (v1) | Aspiring WPAs, WPA-seminar grad students, new assistant directors | Rehearse hard decisions safely; learn the systems; debrief |
| Secondary (v1) | Faculty running WPA seminars / teaching centers | Assign scenarios, review decision logs, discuss |
| Future | Working WPAs | Plug in real program data, run what-ifs, produce memos and reports |

## 3. The program model

A serializable (JSON) description of a writing program. The same schema holds
a fictional program or a real one.

### Entities

- **Program** — institution type, enrollment, fiscal calendar, reporting line
  (dean / chair), current policies.
- **Courses** — FYC sequence, developmental/co-requisite, advanced writing;
  outcomes mapped to the CWPA Outcomes Statement.
- **Sections** — per term: course, cap, modality, instructor, enrollment.
- **Instructors** — rank (TT, NTT full-time, adjunct, GTA), load, pay rate,
  training completed, morale, likelihood of leaving.
- **Students (aggregate, not individuals)** — incoming cohort size, placement
  mix, dual-enrollment/AP credit share, pass and DFW rates, equity gaps by
  group.
- **Policies** — class caps, placement method (test / DSP / multiple
  measures), common syllabus vs. autonomy, AI policy, portfolio assessment,
  training requirements.
- **Stakeholders** — dean, chair, provost's office, faculty senate, writing
  center, GTA cohort / union, adjunct faculty, students, accreditor. Each has
  *priorities* and *trust* (0–100).
- **Resources** — budget lines, admin time (hours/week), political capital.

### Assumptions (the honesty layer)

Every relationship the model uses (e.g., "raising the cap increases each
instructor's grading load linearly and nudges DFW upward") lives in an
editable **assumptions table**, with:

- a plain-language description,
- the parameter values,
- a confidence label (`illustrative` / `literature-informed` / `local data`),
- citations where they exist (e.g., CCCC's statement on class size).

Training mode ships with illustrative defaults. Working mode lets a WPA
replace them with local numbers. The UI always shows projections as ranges,
never as single confident numbers.

### Term projection

`project(program, changes, terms=1..N) → projected program + deltas + notes`

Pure function, deterministic with a seed. Used by scenarios *and* by the
what-if tools. Outputs cost, sections needed, instructor load, projected
pass/DFW ranges, stakeholder reactions, and a human-readable "why" trace.

## 4. Training mode

### Core loop (one term ≈ one session)

1. **Term briefing** — program snapshot, budget, what stakeholders want.
2. **Inbox** — 3–5 scenarios arrive as documents: a memo from the dean, an
   email from an instructor, a student complaint, a data report.
3. **Respond** — for each scenario, choose among options, and optionally use
   the tools (e.g., run the cap calculator before replying to the dean). Some
   responses ask the player to draft a short memo.
4. **Allocate attention** — limited admin hours per week; you cannot do
   everything well. Delegating, deferring, and ignoring are real options.
5. **Term close** — the model projects outcomes; delayed effects from earlier
   terms land.
6. **Debrief** — what changed, why (via the model's trace), how stakeholders
   read your choices, and "what experienced WPAs weigh here", with readings.
   No single right answer is ever declared.

### Gamified elements (kept professional)

- **Political capital & stakeholder trust** — the real currency of WPA work.
- **Delayed consequences** — a decision in fall shows up in spring's numbers
  or next year's program review.
- **Career arc** — Assistant Director → WPA → program builder, each stage
  giving more authority and harder problems (reuses the "eras" idea from
  Retention.edu).
- **Annual report** — at year end the player assembles a report from their
  own data; this doubles as practice for a real WPA genre.
- **Decision log export** — CSV/PDF for instructors running a seminar.

### Memos (v1)

WPA work is mostly writing, so memos are the most authentic part of the
simulation. The design keeps them meaningful without anything grading prose.

- **Decision and memo are separate.** The chosen option drives the model;
  the memo communicates it. Prose quality never changes the numbers.
- **Memo composer** — structured fields (audience, the ask, evidence,
  commitments) plus a free-text body.
- **Evidence** — tool outputs (cap calculator results, stakeholder trust,
  budget figures) can be attached. Options that depend on persuasion
  (e.g., "counter with data") work better with relevant evidence attached;
  this is checked mechanically.
- **Commitments** — promises made in a memo ("assessment data by March")
  become tracked obligations. Kept → trust gain; missed → trust loss.
- **Dossier** — every memo is filed in a persistent archive. Later scenarios
  can quote it back, the annual report draws from it, and it exports as a
  portfolio of administrative writing (for seminars, or for the player's own
  job materials).
- **Self-assessment** — a short checklist after writing (audience, ask,
  evidence, tone). Reflective only; it does not affect scores.
- **Pacing** — memos are required on only one or two major decisions per
  term; other scenarios use option choices, so writing never feels like
  busywork.
- **Later, optional:** AI replies in the stakeholder's voice (the dean writes
  back and pushes back), never AI grading.

### Starter program: "Midland State University" (fictional)

Regional public, ~9,000 undergrads. Two-course FYC sequence plus a
co-requisite option. ~120 FYC sections/year, cap 24. Staffing roughly 60%
adjunct, 25% GTA, 15% full-time. Placement by standardized test scores. No
program-wide assessment in three years. Accreditation visit in year 2.

### Scenario schema (authored as YAML, not code)

Scenarios live in `src/content/scenarios/*.yaml` and are validated on load.
See `cap-memo.yaml` for the full working example. Shape, abbreviated:

```yaml
id: cap-memo
title: The Cap Memo
stages: [assistant_director, wpa]
trigger: { minTerm: 1, requiresDeficit: true }
documents:
  - { from: dean, genre: memo, subject: "...", body: "..." }
suggestedTools: [cap_calculator]
options:
  - id: accept
    label: Accept the increase
    description: ...
    cost: { adminHours: 1 }
    memo: { required: false, audience: dean, prompt: "..." }
    consequence:
      narrative: ...
      changes:                       # ProgramChange objects
        - { kind: setCap, courseId: ENGL101, cap: 27 }
        - { kind: adjustTrust, stakeholder: dean, delta: 8 }
      response: { from: dean, body: "..." }   # in-character reply
      delayed:                       # belongs to this consequence only
        - { inTerms: 2, note: "...", changes: [...] }
  - id: counter-with-data
    memo: { required: true, audience: dean, prompt: "..." }
    persuasion:                      # decided by attached evidence, not prose
      evidenceKinds: [cap_analysis]
      persuaded:   { narrative: ..., changes: [...], delayed: [...] }
      unpersuaded: { narrative: ..., changes: [...] }
debrief:
  weighs: [...]
  perspectives: [{ stakeholder: dean, view: "..." }]
  readings: [...]
```

Other scenario features (see `late-hire.yaml`):

- `arrival` — ProgramChanges that happen when the scenario arrives, before
  any decision (e.g., three adjuncts resign). They apply only if the
  scenario actually arrives.
- `trigger.term` (fall/spring) and `trigger.requiresUnstaffed` — the latter
  is judged *after* arrival changes, so a scenario only fires if it really
  creates a crisis in the player's current program.
- `urgent: true` — the term can't advance until it's resolved.
- `{{placeholders}}` in document text (`{{unstaffed_sections}}`,
  `{{deficit}}`, `{{term}}`) state the real numbers earlier decisions
  produced.
- `cancelUnstaffed` — a scenario-only change resolved at decision time to
  cancel exactly the sections still uncovered.
- Relative changes (`adjustCap`, `adjustBudget`) compose with earlier
  decisions; prefer them over absolute ones (`setCap`) for temporary effects
  that revert later.

### v1 scenario set (~10)

1. The Cap Memo — the dean wants higher caps.
2. The Detector — the provost's office is ready to license AI detection.
3. The Dual-Enrollment Drop — incoming FYC students fall 30%.
4. The Syllabus Holdout — a tenured colleague refuses the common syllabus.
5. The DSP Pilot — results of directed self-placement are mixed.
6. The Grade Appeal Escalation — a parent contacts the president's office.
7. The Late Hire — three sections have no instructor two weeks before the term.
8. The Accreditation Ask — outcomes data for a visit, due in six weeks.
9. The GTA Stipend Campaign — graduate instructors are organizing.
10. The Writing Center Budget Swap — funding one means cutting the other.

## 5. Working mode (future, not v1)

Same tools with real data: import a section schedule (CSV), set local
assumptions, run what-ifs, and export memos, staffing plans and annual
reports. The scenario layer is simply turned off, or kept as an optional
"stress test" feature ("what if the dean asks for caps of 27?").

## 6. Tech approach (proposal)

- **Web app**, local-first: runs in the browser, no accounts or server for v1;
  save/load is a JSON file. Shareable by link; credible for teaching centers.
- **TypeScript** throughout. The program model and projection engine are a
  standalone, unit-tested package with no UI dependencies.
- **React + Vite** for the UI.
- **Content in data files** (YAML/JSON) so non-programmers can write scenarios.
- **Optional later:** LLM feedback on player-drafted memos (clearly labeled,
  opt-in).

What carries over from the earlier Retention.edu project: the semester loop, the
choice → bundled-effects pattern (`StatDelta`), save slots, the career-stage
("era") structure, and the idea of delayed consequences. The Pygame code
itself does not carry over.

## 7. MVP scope

- One fictional program (Midland State), two terms (one academic year).
- Program model + projection engine with an assumptions table.
- Three tools: cap/cost calculator, staffing planner, stakeholder map.
- ~10 scenarios, debrief screen, decision-log export.
- Save/load via JSON file.

Out of scope for MVP: real-data import, multi-user, accounts, LLM features.

## 8. Open questions

1. ~~Memos in v1?~~ Decided: structured memos + dossier (see "Memos (v1)"); AI replies later and optional.
2. How much should instructors (individual people with names) matter, versus
   aggregate staffing numbers?
3. Should seminar instructors be able to author scenarios in-app, or only via
   files?
4. Is the adjunct-to-WPA path itself a playable arc (starting as a contingent
   instructor with an administrative role)?
5. ~~New repository or folder?~~ Decided: new repository, `wpa-desk`.
