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
- **Career arc** — Assistant Director → interim WPA, each stage giving more
  authority and harder problems (reuses the "eras" idea from
  Retention.edu). See "Arcs" for the standard arc.
- **Annual report** — at year end the player assembles a report from their
  own data; this doubles as practice for a real WPA genre.
- **Decision log export** — CSV/PDF for instructors running a seminar.

### Arcs

A playthrough follows an **arc**: a fixed length, a calendar of which
scenarios can arrive when, recurring events, and an ending. Arcs are content
(YAML in `src/content/arcs/`), so other arcs (a one-semester seminar unit,
an assistant-director arc, an open-ended sandbox) can be added later without
code changes.

**The standard arc** (decided): 3 years, 6 terms, Fall Y1 through Spring Y3.
The capstone is the **Year 3 annual report**, followed by an end-of-arc
debrief.

**Player role** (decided): the player is a rhetoric and composition PhD
student serving as Assistant Director, starting in their second year of the
PhD (a common pattern: first year in the writing center or another
assignment, then an administrative role). Year 3 of the arc is their fourth
PhD year, when they go on the job market.

- Years 1–2: Assistant Director under the WPA, **Dr. Nora Cherry**,
  Director of First-Year Writing and the player's supervisor (a new cast
  member; adding her needs a new stakeholder id, so a save-version bump).
  Proposed profile: a mentor who wants the player to succeed, so a low bar
  with evidence and a moderate one without (15 / 55), and trust with her
  shapes the recommendation letter behind the ending. Scenarios reach the player the way they would reach
  an AD; e.g., the WPA forwards the dean's cap request and asks the player to
  run the numbers and draft the response.
- Year 3 (decided): Dr. Cherry goes on sabbatical and the player serves as
  **interim director** (career stage `wpa`), with more authority and harder
  problems. Fall Y3 also brings the job market, which competes for admin
  hours.
- **Dissertation progress** (decided): a meter fed by hours not spent on
  admin work, so over-committing has a personal cost. It feeds the
  ending (a finished or nearly finished dissertation matters on the
  market).

**Annual reports** (decided): the report goes to the chair, Dr. Hale, who
forwards it to the dean. Reports are reflective only: they are saved to the
case files and exported, for instructors to evaluate, and never scored.

- Years 1–2: the supervisor writes the report and the player writes one
  section. Proposed: Y1 program data (enrollment, sections, staffing, D/F/W,
  and what they mean); Y2 assessment and outcomes (the accreditation year).
  The supervisor's sections are generated from the player's program data,
  and the player sees the assembled report with their section in place.
- Year 3: the player writes the entire report with the memo composer: data,
  outcomes, initiatives, next year's requests, and a three-year look back,
  with evidence attached from their own data and a recap of commitments.

**Endings** (decided: scored from three years of results, shown alongside
the Year 3 report; presentation to be designed later). Job-market
outcomes:

1. Tenure-track assistant professor at a university, with a WPA role.
2. Full-time faculty position at a two-year college (written as a real,
   good outcome, not a consolation prize).
3. Rotated out: the AD appointment goes to another graduate student and the
   player goes on the market without a strong administrative record.

Proposed score inputs: program outcomes against Midland's baseline (D/F/W,
staffing stability, budget), trust with characters (Dr. Cherry's especially),
commitments kept versus missed, instructor morale, and dissertation
progress. The ending screen explains why, like a
debrief, rather than showing a bare grade.

Built so far (`src/content/arcs/standard.yaml`, `src/training/arc.ts`):

- **Placement lives in the arc; conditions live in the scenario.** A
  scenario's `trigger` says what must be true for it to make sense. The
  arc's `calendar` says *when* it may arrive (`from`/`until` terms); a
  scenario not in the calendar never arrives in that arc. The same scenario
  can sit at different points in different arcs.
- **Role changes** — `startStage` plus `stageChanges` (term, stage, note);
  the note appears under "Since last term".
- **Final term** — the term can't advance past `terms`.
- **Free play** — a session started without an arc has no calendar and
  runs on triggers alone (used by most model tests).
- **Richer triggers**, in scenario YAML:

  ```yaml
  trigger:
    after:                       # a follow-up to an earlier decision
      scenario: cap-memo
      options: [counter-with-data]   # optional: only these choices
      persuaded: true                # optional: only if the memo landed
      inTerms: 2                     # optional: at least 2 terms later
    conditions:                  # every one must hold
      - { measure: trust, stakeholder: dean, below: 40 }
      - { measure: morale, rank: adjunct, below: 45 }
      - { measure: dfw, courseId: ENGL101, atLeast: 0.2 }  # fraction
      - { measure: politicalCapital, atLeast: 10 }
      - { measure: budgetBalance, below: 0 }
      - { measure: cap, courseId: ENGL101, below: 27 }
  ```

  `after` references are checked across files on load.

- **Term history** — a record of the program's numbers at the start of
  play (`baseline`) and at the end of every term (`history`), used by
  reports and the ending.
- **Year-end reports** (`yearEnd` in the arc; `src/training/report.ts`) —
  due in a set term, they block the term until submitted and cost admin
  hours (a shortfall comes out of dissertation time as overtime). The
  supervisor's sections are generated from the player's recorded data; the
  player's sections keep drafting history. A data panel and appendix show
  the year's numbers, decisions, and commitments.
- **Time costs** (`timeCosts`) — hours taken from a term up front (job
  applications, Fall Y3).
- **Dissertation** (`dissertation`) — unspent admin hours accumulate toward
  `hoursToFinish`; `onTrackAt` is the share needed to defend by summer.
  Shown in the status bar during play.
- **Endings** (`endings`; `src/training/ending.ts`) — submitting the
  capstone scores the record out of 100: program outcomes 20 (fall D/F/W
  against the baseline, terms where students couldn't get a section,
  budget over the final year), the
  recommender's trust 15, campus relationships 15, instructors' trust and
  morale 15, commitments kept 15, dissertation 20. Thresholds and outcome
  text live in the arc; weights in `ENDING_RULES`. The tenure-track outcome
  also needs the dissertation finished or on track, and the ending screen
  says so when that gate is what held it back. Reports and the ending are
  in the dossier and the Markdown export.
- **Honest feedback** (`src/training/feedback.ts`) — the ending screen leads
  with "What you need to work on", weakest area first, before the score.
  Each point names the player's own decisions and numbers (the choices that
  cost the most trust, memos that failed and why, missed or absent
  commitments, the terms that starved the dissertation) and says what to do
  differently. The dissertation gate states the hours short and that it's
  why the offer didn't come. "What you did well" follows, and doesn't
  flatter: a finished dissertation next to a weak record is named for what
  it is. Feedback is in the case files and export, so instructors see what
  the student was told.
- **Routine staffing** (`routineStaffing`; `src/training/staffing.ts`) —
  whenever a term has sections without an instructor and no scenario is
  handling it (The Late Hire), the director decides before the term (or the
  capstone) can close: hire adjuncts (2 hours), teach one section yourself
  (20 hours, overtime comes out of the dissertation; earns instructor
  trust), or cancel (students lose seats; restored next term). Decisions go
  in the case files.
- **Political capital is earned by delivering**: a memo that persuades its
  reader returns +2, and each kept commitment +1. Without this, careful
  players ran out by Year 3 and only expedient choices earned capital back.
- **Calibration** (12 scenarios, whole-arc test runs): thoughtful play
  with evidence scores about 72 (tenure track); adding kept commitments
  raises it to about 78 with the dissertation still on track; also teaching
  the extra sections yourself scores about 76 but leaves the dissertation
  behind (two-year college, held back by the dissertation gate); expedient
  play scores about 44 (rotated out). Recheck when scenarios change.

Still to design and build:

- **Recurring events** — each year has a rhythm even between scripted
  scenarios: a budget cycle in fall, staffing and hiring in spring.
- **Inbox density** — about 2 major scenarios per term, plus short minor
  items (one email, a choice, no memo) to reach the 3–5 in the core loop.

Draft standard-arc calendar (the accreditation visit is in year 2 at
Midland):

| Term | Scenarios |
|---|---|
| Fall Y1 | The Cap Memo · The Syllabus Holdout |
| Spring Y1 | The Late Hire (if triggered) · The Grade Appeal Escalation |
| Fall Y2 | The Accreditation Ask · The Dual-Enrollment Drop |
| Spring Y2 | The DSP Pilot · The Detector · Cap Memo follow-up |
| Fall Y3 | The GTA Stipend Campaign · The Writing Center Budget Swap |
| Spring Y3 | The Handoff · Year 3 annual report (capstone) |

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
  carry an effort estimate in admin hours. Delivering spends those hours in
  the term you do it (early is allowed) and earns trust with the memo's
  reader (+3). One extension is allowed (−1). Anything still open when its
  term ends is missed (−6), so over-promising in memos taxes future terms.
  Submitting the capstone ends the final term, so it misses them too.
- **Dossier (case files)** — one self-contained case file per decision:
  what arrived (documents as they read at the time), the decision, the memo
  with evidence and commitment status, what happened (narrative, reply,
  persuasion explanation, trust and program changes), the debrief, and a
  reflection. Snapshots are stored at decision time because documents,
  replies, and numbers depend on state that later changes. Exports as a
  printable page (browser print → PDF) or Markdown, with a cover page
  (author, course) and a notice that the institution and scenarios are
  fictional while the writing is the author's own.
- **Drafting and revision history** — kept for instructors and for teaching
  recursive process. Recorded as snapshots, not keystrokes: saved drafts
  (with optional revision notes), a snapshot after a 20-second pause, large
  insertions (≥25 words at once, labeled neutrally), quoted evidence, and
  the sent version, which is fixed. After sending, memos can be revised for
  the portfolio; revisions are added after the sent version. Reflections
  keep their versions too. Case files show a timeline (with time from
  opening the memo to sending it) and word-level changes between versions,
  punctuation compared separately. Writers are told in the composer that
  history is kept and exported. Unsent drafts are saved with the session.
- **Reflection** — after each debrief, a prompt ("What would you do
  differently, and what did you learn about the people involved?"). Saved
  to the case file; editable later; never affects outcomes.
- **Self-assessment** — a short checklist after writing (audience, ask,
  evidence, tone). Reflective only; it does not affect scores.
- **Pacing** — memos are required on only one or two major decisions per
  term; other scenarios use option choices, so writing never feels like
  busywork.
- **Later, optional:** AI replies in the stakeholder's voice (the dean writes
  back and pushes back), never AI grading.

### Characters and relationships

Stakeholders with a single decision-maker have a named character, authored
in `src/content/cast/*.yaml` (content, not program data, so the model can
hold real programs). Midland's cast: Dean Elena Alvarez, Dr. Marcus Hale
(chair), Dr. Nora Cherry (Director of First-Year Writing), Associate
Provost Grace Okafor, Dr. Priya Raman (writing center).
Groups (adjuncts, GTAs, students, senate, accreditor) remain groups.

Relationships have mechanical weight:

- **Persuasion needs trust.** Each character has two thresholds: trust needed
  when a memo carries the evidence they need, and a much higher bar to take
  your word without it. The outcome screen says which rule decided it.
- **Replies vary with trust** (`warm` / `cool` variants in scenario YAML).
- **Options can require a relationship** (`requires: { stakeholder, minTrust }`),
  shown disabled with the reason, so trust built in one scenario opens doors
  in another.
- **Morale drives turnover.** Adjunct or lecturer morale below 40 costs one
  person per term, which can bring on staffing crises later.

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
  `{{deficit}}`, `{{surplus}}`, `{{term}}`, `{{sections}}`,
  `{{sections_gta}}`, `{{headcount_gta}}`, `{{pay_gta}}`, `{{cap_ENGL101}}`;
  full list in `src/training/template.ts`) state the real numbers earlier
  decisions produced.
- `cancelUnstaffed` — a scenario-only change resolved at decision time to
  cancel exactly the sections still uncovered.
- `setPolicy` sets a program policy: on/off (`commonSyllabus`,
  `portfolioAssessment`) or a named value (`placement`: test_scores,
  directed_self_placement, multiple_measures; `aiPolicy`: none,
  instructor_choice, program_guidance, detector). See
  `syllabus-holdout.yaml`, `dsp-pilot.yaml`, `detector.yaml`.
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

### Class settings and variation (designed, not yet built)

A fixed, deterministic game can be passed down as a walkthrough ("attach a
cap analysis on The Cap Memo…"). How much that matters depends on what's
evaluated:

- **The writing is the student's own.** Memos, annual reports, and
  reflections can't be copied from a walkthrough, and drafting history makes
  pasted text visible in instructor review.
- **Outcomes are exposed.** Choices and the ending score can be copied. So
  **the ending is never meant to be a grade**; instructors evaluate the
  writing, the reasoning, and the process. The instructor guide and review
  mode should say so.
- **Some sharing is the lesson.** "Bring the numbers the dean cares about"
  is what the game teaches.

Planned instructor settings, cheapest first:

1. **Scenario selection** — which scenarios are included, and which require
   a memo.
2. **Difficulty** — hide persuasion thresholds and exact trust numbers; hide
   or skip the ending; admin hours per term.
3. **Starting-condition presets** — Midland variants (a bigger deficit, a new
   dean with a different persuasion profile, a GTA-heavy staff, a union
   contract).
4. **Seeded variation** — per-student numbers within plausible ranges
   (deficit, headcounts, starting trust, enrollment drop) and scenario timing
   within calendar windows, reproducible from a seed.
5. **Scenario variants** — the same scenario with different facts (e.g., in
   one grade appeal the GTA contradicted the syllabus; in another the GTA was
   right), so a walkthrough can't say which one a student got.

Settings travel as a **class settings file** that an instructor creates in
instructor mode and students load when starting a session (a class code in
the hosted version). Each session stores its settings (`session.settings`,
defaults for now), so review mode can flag saves made with other settings.

Groundwork already in place:

- **Placeholders, not fixed numbers.** Scenario prose states the program's
  numbers through `{{placeholders}}` (documents, consequence narratives,
  replies, and delayed notes), so text stays true when starting conditions
  vary. Fixed numbers are fine for a scenario's own parameters when they
  match its changes ("caps of 27", "$20,000 a term").
- **Relative scoring.** The ending compares against the session's own
  baseline, so varied starting points don't need separate calibration.
- **Everything is data.** Program, cast, arcs, and scenarios are content, so
  presets and variants are content too.

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
   aggregate staffing numbers? (Decision-makers are now named characters;
   instructors are still pools. A few named instructors is a possible next step.)
3. Should seminar instructors be able to author scenarios in-app, or only via
   files?
4. Is the adjunct-to-WPA path itself a playable arc (starting as a contingent
   instructor with an administrative role)?
5. ~~New repository or folder?~~ Decided: new repository, `wpa-desk`.
