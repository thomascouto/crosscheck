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
