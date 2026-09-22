# crosscheck

[![License: MIT](https://img.shields.io/badge/license-MIT-blue.svg)](LICENSE)
[![Node 22+](https://img.shields.io/badge/node-%3E%3D22-brightgreen.svg)](https://nodejs.org)
[![Claude Code skill](https://img.shields.io/badge/Claude%20Code-skill%20included-orange.svg)](#matching-against-your-cv)

Cross-check your CV against every open job at hiring Y Combinator startups.

A **Work at a Startup scraper and YC jobs CLI**: fetches all open roles from [workatastartup.com](https://www.workatastartup.com) without a login or API key, filters them interactively (remote, region, industry, company size, role, experience, visa), and scores them against your resume with an AI coding agent. Think of it as a job-search tool for the whole YC startup directory: `yc jobs` + `resume match` + outreach drafts, from the terminal.

An interactive CLI pulls the jobs from [Work at a Startup](https://www.workatastartup.com) without logging in, lets you filter them, and writes a JSON + Markdown list. The matching and the outreach messages are done by an AI coding agent reading your CV (a Claude Code skill is included), not by the script, so there is no API key to configure.

## How it works

1. The public Algolia index behind the YC company directory lists every company flagged as hiring (about 1,500). It also carries company-level facets: regions (including Remote / Fully Remote / Partly Remote), industries, team size, batch.
2. Each `workatastartup.com/companies/<slug>` page embeds its open jobs as Inertia.js JSON. No login needed. That gives title, location, job type, salary, equity, visa policy and minimum experience.
3. Each `workatastartup.com/jobs/<id>` page adds the full description, skills and apply link.

The logged-out listing and `/jobs` pages only show about 30 featured jobs, which is why the tool goes company by company. Everything is cached for 24 hours in `.cache/`, so re-runs with new filters are instant. A cold run over all companies takes about a minute at 8 concurrent requests.

Role type is not exposed publicly, so it is inferred from the title (frontend, fullstack, backend, mobile, devops, ml-ai, data, security, ...). Check the counts in the "Role" prompt and widen with "software" if titles in your area are generic.

## Requirements

Node 22 or newer and pnpm (pinned via `packageManager`; `corepack enable` gets it). One dependency, `@inquirer/prompts`.

## Install

```sh
git clone https://github.com/thomascouto/crosscheck
cd crosscheck
pnpm install
```

## Usage

```sh
pnpm start                      # interactive: prompts for filters
node crosscheck.mjs --last     # replay the filters saved in .last-filters.json
node crosscheck.mjs --refresh  # ignore the cache
node crosscheck.mjs --no-details
```

Prompts, all with live counts and Enter meaning "any":

- company level, before fetching pages: remote policy, region, industry, team size
- job level: role, job type, max required experience, visa policy, remote-only, keyword in title

Output goes to `out/jobs-<timestamp>.json` and `.md`.

## Example

A run with "Remote policy: Any", no region/industry/size filter, then roles `frontend` + `fullstack` and visa `not required` or `Will sponsor`:

```text
$ pnpm start
Fetching hiring companies from YC directory... 1481
? Remote policy Any
? Company region (space = toggle, enter = skip/any)
? Industry (space = toggle, enter = skip/any)
? Company size (space = toggle, enter = skip/any)
1481 of 1481 hiring companies match.
? Fetch job listings for 1481 companies? Yes
Company pages 1481/1481
6035 open jobs.
? Role frontend (103), fullstack (320)
? Job type
? Max required experience Any
? Visa US citizenship/visa not required (769), Will sponsor (669)
? Only jobs whose location mentions Remote? No
? Keyword in title (empty = any)
134 jobs match.
? Fetch full descriptions for 134 jobs? Yes
Job details 134/134
Wrote out/jobs-2026-09-22-1454.json and out/jobs-2026-09-22-1454.md
```

`out/jobs-<timestamp>.md` (first rows):

| # | Company | Title | Location | Type | Salary | Equity | Exp | Visa | Link |
|---|---|---|---|---|---|---|---|---|---|
| 1 | Streak | Staff UI Engineer | US / CA / MX / Remote (US; CA; MX) | Full-time | $150K - $300K | - | 6+ years | not required | https://www.workatastartup.com/jobs/66000 |
| 2 | Rhizome AI | Founding Full Stack AI Engineer | BR / CO / AR / MX / PE / CL / CR… / Remote | Full-time | $70K - $140K | 0.50% - 2.00% | 6+ years | not required | https://www.workatastartup.com/jobs/95289 |
| 3 | kapa.ai | Software Engineer (Full-stack) | GB / EG / RU / UA / TR / FR / IT… / Remote | Full-time | $100K - $150K | 0.10% - 0.30% | 3+ years | not required | https://www.workatastartup.com/jobs/76640 |
| 4 | Runway | Full Stack Engineer | US / GB / AU / ES / FR / MX / DK… / Remote | Full-time | $80K - $150K | 0.05% - 0.15% | 6+ years | not required | https://www.workatastartup.com/jobs/46511 |

One object from `out/jobs-<timestamp>.json` (description trimmed):

```json
{
  "id": 95289,
  "url": "https://www.workatastartup.com/jobs/95289",
  "title": "Founding Full Stack AI Engineer",
  "role": "fullstack",
  "company": "Rhizome AI",
  "slug": "rhizome-ai",
  "batch": "Winter 2026",
  "teamSize": 1,
  "industries": ["B2B"],
  "regions": ["United States of America", "America / Canada", "Remote", "Fully Remote"],
  "companyLocation": "New York City, NY",
  "companyOneLiner": "Agent Platform for Life Sciences",
  "website": "https://rhizomeai.com/",
  "location": "BR / CO / AR / MX / PE / CL / CR / UY / EC / GT / DO / BO / PY / PA / SV / HN / VE / Remote (BR; CO; AR; MX; ...)",
  "remote": true,
  "jobType": "Full-time",
  "salaryRange": "$70K - $140K",
  "equityRange": "0.50% - 2.00%",
  "sponsorsVisa": "US citizenship/visa not required",
  "minExperience": "6+ years",
  "minYears": 6,
  "skills": ["Python", "TypeScript", "Next.js"],
  "techStack": "We're deployed on DigitalOcean, using Next.js, TypeScript, FastAPI, Python, Postgres, ...",
  "description": "Rhizome AI (YC W26) is building Glean for life sciences. ...",
  "applyUrl": "https://account.ycombinator.com/authenticate?continue=..."
}
```

After matching with Claude Code, `out/match-<date>.md` looks like this (scores and notes depend on the CV):

| # | Score | Company | Title | Location | Pay | Exp | Visa | Why it fits | Gaps / risks | Link |
|---|---|---|---|---|---|---|---|---|---|---|
| 1 | 86 A | Lightdash | Full Stack Software Engineer | GB / ES / PT / IT / DE / FR / SE… / Remote | $100K - $170K · 0.10% - 0.30% | 3+ years | not required | GMT±3 requirement fits the candidate's timezone; React/TS/Node/Postgres; open-source BI with heavy UI | Community/content duties; data-viz domain new | [42246](https://www.workatastartup.com/jobs/42246) |
| 2 | 81 A | Rhizome AI | Founding Full Stack AI Engineer | BR / CO / AR / MX / PE / CL / CR… / Remote | $70K - $140K · 0.50% - 2.00% | 6+ years | not required | Remote LATAM; Next.js/TS/Tailwind; founding role, 6+ yrs | Backend is FastAPI/Python | [95289](https://www.workatastartup.com/jobs/95289) |

And `/msg 2` produces a message like:

```text
Hi [name], I'm <name>, a senior full-stack engineer in <city> (UTC-3). The founding role at
Rhizome stood out because regulated, high-stakes domains are where I do my best work ...
```

## Matching against your CV

Drop your CV in the project root (a file name containing `resume`, `CV` or `curriculum`; `.md`, `.pdf` or `.docx`). It is git-ignored, as is everything under `out/`.

With [Claude Code](https://claude.com/claude-code) open in the folder:

1. Run the CLI, then ask: "match the jobs in out/ against my CV". Claude writes `out/match-<date>.md` (a tiered table, 0-100 score, the `#` column is the job index) and `out/jobs-index.json`.
2. `/msg <index>` writes a Work at a Startup "Reach out" message for one job, under 900 characters, using only facts from the CV, and appends it to `out/messages-<date>.md`. Add the founder's name after the index to address it.

Rewrite at least a sentence yourself before sending. Work at a Startup says human-written messages get more replies, and some postings reject AI-written applications outright.

## Development

```sh
pnpm test                                        # unit tests for lib.mjs
node --test --test-name-pattern="inferRole"     # one test
```

`lib.mjs` holds the pure helpers (Inertia parsing, role inference, filters, Markdown). `crosscheck.mjs` holds fetching, caching, prompts and orchestration.

## Notes

- The Algolia key in the source is the public, search-only key shipped in the YC directory page, restricted to that index.
- This is an unofficial tool. Keep the request rate modest (the defaults are 8 concurrent requests and a 24-hour cache) and apply through Work at a Startup itself.
- Nothing personal is committed: the CV, cache, outputs and saved filters are all git-ignored.

## FAQ

**Does Work at a Startup have a public API?**
Not anymore. The old public Algolia job index (`WaaSPublicCompanyJob`) was retired. This tool uses the still-public YC company index for the list of hiring companies and reads the job data each company page embeds for its own frontend.

**Do I need a Y Combinator or Work at a Startup account?**
No, not to fetch or filter. You need one to apply, and the output links go straight to each job page.

**Can I get YC jobs as JSON or CSV?**
Yes. Every run writes `out/jobs-<timestamp>.json` with one object per job (title, company, batch, team size, location, remote flag, job type, salary, equity, visa policy, minimum experience, inferred role, description, skills, apply URL). Convert to CSV with any JSON tool.

**Can I filter YC jobs by remote, region, industry or company size?**
Yes, those are the company-level prompts, applied before any company page is fetched. Region includes "Fully Remote", "Partly Remote", "Latin America", "Europe", "India" and so on.

**How is this different from other Work at a Startup scrapers?**
It is interactive, cached, dependency-light (one package), and built to feed an AI agent that reads your CV: the matching table and the outreach messages are produced by Claude Code through the included skill, so you are not pasting job descriptions into a chat window one by one.

**Does it work with ChatGPT, Cursor or another agent?**
The CLI is agent-agnostic. The `/msg` skill is written for Claude Code, but `.claude/skills/msg/SKILL.md` is plain Markdown instructions you can paste into any agent.

## Related projects

- [disamee/yc-talent-radar](https://github.com/disamee/yc-talent-radar): Apify actor for YC hiring signals, same Algolia + Inertia approach, Python.
- [jwc20/waasuapi](https://github.com/jwc20/waasuapi): Selenium-based Work at a Startup scraper API that logs in.
- [nicobrenner/commandjobs](https://github.com/nicobrenner/commandjobs): terminal job hunter with resume matching across several boards.

## License

MIT
