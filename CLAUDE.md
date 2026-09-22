# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## What this is

crosscheck: interactive CLI that pulls open jobs at hiring Y Combinator startups from Work at a Startup (WaaS), filters them, and writes a JSON + Markdown list. Matching against the CV in this folder is done by Claude after the script runs, not by the script.

## Commands

```sh
npm start                    # interactive run (prompts for filters)
node crosscheck.mjs --last      # replay filters from .last-filters.json, no prompts
node crosscheck.mjs --refresh   # ignore the 24h cache
node crosscheck.mjs --no-details
npm test                     # node --test (lib.test.mjs)
node --test --test-name-pattern="inferRole"   # single test
```

Node 24, ESM, single dependency `@inquirer/prompts`.

## Data flow

1. `fetchHiringCompanies`: YC directory's public Algolia index `YCCompany_production` with `isHiring:true`. Algolia caps one query at 1000 hits, so it queries once per `industry` facet value (single-valued, each bucket < 1000). Gives company-level facets: regions (incl. `Remote`/`Fully Remote`/`Partly Remote`), industries, team_size, batch.
2. Company-level prompts narrow the list, then `fetchCompanyPage` hits `workatastartup.com/companies/<slug>` for each. Jobs live in the Inertia.js `data-page` JSON (`props.company.jobs`), no login. Job fields there: id, title, location, jobType, salaryRange, equityRange, sponsorsVisa, minExperience. No role type, so `inferRole` guesses from the title.
3. Job-level prompts filter, then optionally `fetchJobDetail` hits `workatastartup.com/jobs/<id>` for description, skills, applyUrl.
4. Output to `out/jobs-<stamp>.json` and `.md`; chosen filters saved to `.last-filters.json`.
5. CV matching is done by Claude, not the script: read the CV (`*Resume*.md` in the root) and the jobs JSON, score each job, write `out/match-<date>.md` (tiered table, `#` column is the job index) and `out/jobs-index.json` (full job rows sorted by score, with `idx`, `score`, `tier`, `why`, `gaps`).
6. `/msg <index|id> [founder name]` (skill in `.claude/skills/msg/`) generates a WaaS "Reach out" message for one job from `out/jobs-index.json` and appends it to `out/messages-<date>.md`.

Logged-out `/companies?...` and `/jobs` pages only expose ~30 featured jobs, so they are not used.

## Layout

- `lib.mjs`: pure helpers (parsing, role inference, filters, markdown). Unit-tested.
- `crosscheck.mjs`: I/O, caching (`.cache/`, 24h TTL), prompts, orchestration.
