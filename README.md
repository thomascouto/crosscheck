# crosscheck

Cross-check your CV against every open job at hiring Y Combinator startups.

An interactive CLI pulls the jobs from [Work at a Startup](https://www.workatastartup.com) without logging in, lets you filter them, and writes a JSON + Markdown list. The matching and the outreach messages are done by an AI coding agent reading your CV (a Claude Code skill is included), not by the script, so there is no API key to configure.

## How it works

1. The public Algolia index behind the YC company directory lists every company flagged as hiring (about 1,500). It also carries company-level facets: regions (including Remote / Fully Remote / Partly Remote), industries, team size, batch.
2. Each `workatastartup.com/companies/<slug>` page embeds its open jobs as Inertia.js JSON. No login needed. That gives title, location, job type, salary, equity, visa policy and minimum experience.
3. Each `workatastartup.com/jobs/<id>` page adds the full description, skills and apply link.

The logged-out listing and `/jobs` pages only show about 30 featured jobs, which is why the tool goes company by company. Everything is cached for 24 hours in `.cache/`, so re-runs with new filters are instant. A cold run over all companies takes about a minute at 8 concurrent requests.

Role type is not exposed publicly, so it is inferred from the title (frontend, fullstack, backend, mobile, devops, ml-ai, data, security, ...). Check the counts in the "Role" prompt and widen with "software" if titles in your area are generic.

## Requirements

Node 22 or newer. One dependency, `@inquirer/prompts`.

## Install

```sh
git clone https://github.com/thomascouto/crosscheck
cd crosscheck
npm install
```

## Usage

```sh
npm start                      # interactive: prompts for filters
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
npm test                                        # unit tests for lib.mjs
node --test --test-name-pattern="inferRole"     # one test
```

`lib.mjs` holds the pure helpers (Inertia parsing, role inference, filters, Markdown). `crosscheck.mjs` holds fetching, caching, prompts and orchestration.

## Notes

- The Algolia key in the source is the public, search-only key shipped in the YC directory page, restricted to that index.
- This is an unofficial tool. Keep the request rate modest (the defaults are 8 concurrent requests and a 24-hour cache) and apply through Work at a Startup itself.
- Nothing personal is committed: the CV, cache, outputs and saved filters are all git-ignored.

## License

MIT
