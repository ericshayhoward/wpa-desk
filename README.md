# WPA Desk

A training simulator for aspiring and new Writing Program Administrators,
built on a program model that can grow into a planning tool for working WPAs.

**Play it:** <https://ericshayhoward.com/wpa-desk/> ·
**About the project:** <https://ericshayhoward.com/projects/wpa-desk/> ·
**For instructors:** <https://ericshayhoward.com/projects/wpa-desk/teaching/>

Training mode puts you at the desk of a fictional writing program for three
years: memos, staffing gaps, budget pressure, and stakeholders with their own
priorities. The same tools you use to respond (cap/cost calculator, staffing
planner, stakeholder map) are the ones a working WPA would use on real data.
A live campus map in the corner shows the same state as a place: the day runs
on your admin hours, envelopes mark who's waiting on you, and Founders Hall's
windows are the term's sections. Instructors can open students' save files in
a read-only review mode.

Status: early and changing quickly. Design notes are in
[docs/DESIGN.md](docs/DESIGN.md) and plans in [docs/ROADMAP.md](docs/ROADMAP.md).

## Running it locally

```bash
npm install
npm run dev
```

`npm test` runs the model tests and full playthroughs; `npm run build`
type-checks and builds the site into `dist/`.

## License

WPA Desk is by Eric Shay Howard. You're welcome to use it, fork it, and adapt
it, with credit.

- **Code:** [GNU AGPL 3.0](LICENSE), with an added term that keeps the
  "WPA Desk by Eric Shay Howard" credit visible in the app.
- **Scenarios, cast, and other writing** (`src/content/`):
  [CC BY-NC-SA 4.0](src/content/LICENSE.md).

See [NOTICE.md](NOTICE.md) for the details, including how to ask about uses
these licenses don't cover.
