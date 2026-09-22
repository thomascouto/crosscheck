#!/usr/bin/env node
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { existsSync } from "node:fs";
import { parseArgs } from "node:util";
import { checkbox, confirm, input, select } from "@inquirer/prompts";
import {
  REMOTE_REGIONS, SIZE_BUCKETS, applyCompanyFilters, applyJobFilters, countBy, htmlToText,
  inferRole, isRemoteLocation, parseDataPage, parseMinYears, sizeBucket, toMarkdown,
} from "./lib.mjs";

const ALGOLIA = {
  url: "https://45BWZJ1SGC-dsn.algolia.net/1/indexes/*/queries",
  appId: "45BWZJ1SGC",
  // Public search-only key shipped in ycombinator.com/companies; restricted to the YCCompany index.
  key: "NzJmMWExZWYxYzY5OGYwN2VkYWM5YzRiM2VlNDFlM2I0ODU2YjQ2Yjg0MTFiNWE5NzY0NTMyZGI1OWEwMzVjY2FuYWx5dGljc1RhZ3M9eWNkYyZyZXN0cmljdEluZGljZXM9WUNDb21wYW55X3Byb2R1Y3Rpb24lMkNZQ0NvbXBhbnlfQnlfTGF1bmNoX0RhdGVfcHJvZHVjdGlvbiZ0YWdGaWx0ZXJzPSU1QiUyMnljZGNfcHVibGljJTIyJTVE",
  index: "YCCompany_production",
};
const WAAS = "https://www.workatastartup.com";
const UA = "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/128.0 Safari/537.36";
const CACHE_DIR = ".cache";
const OUT_DIR = "out";
const LAST_FILTERS = ".last-filters.json";
const TTL_MS = 24 * 60 * 60 * 1000;
const CONCURRENCY = 8;

const { values: flags } = parseArgs({
  options: {
    refresh: { type: "boolean", default: false },
    last: { type: "boolean", default: false },
    "no-details": { type: "boolean", default: false },
    help: { type: "boolean", short: "h", default: false },
  },
});
if (flags.help) {
  console.log(`Usage: node crosscheck.mjs [--refresh] [--last] [--no-details]
  --refresh      ignore the 24h cache and refetch everything
  --last         reuse the filters saved in ${LAST_FILTERS} (no prompts)
  --no-details   skip fetching full job descriptions`);
  process.exit(0);
}

async function readCache(file) {
  if (flags.refresh || !existsSync(file)) return null;
  const data = JSON.parse(await readFile(file, "utf8"));
  return Date.now() - data.fetchedAt < TTL_MS ? data.value : null;
}
async function writeCache(file, value) {
  await mkdir(file.slice(0, file.lastIndexOf("/")), { recursive: true });
  await writeFile(file, JSON.stringify({ fetchedAt: Date.now(), value }));
}

async function fetchWithRetry(url, init, tries = 3) {
  for (let i = 1; ; i++) {
    // /jobs/<id> answers 406 unless the request explicitly accepts HTML.
    const res = await fetch(url, { ...init, headers: { "User-Agent": UA, Accept: "text/html", ...init?.headers } });
    if (res.ok) return res;
    if (i >= tries || (res.status < 500 && res.status !== 429)) throw new Error(`${res.status} ${url}`);
    await new Promise((r) => setTimeout(r, 1000 * i));
  }
}

async function algolia(params) {
  const body = { requests: [{ indexName: ALGOLIA.index, params: new URLSearchParams(params).toString() }] };
  const res = await fetchWithRetry(ALGOLIA.url, {
    method: "POST",
    headers: { "Content-Type": "application/json", Accept: "application/json", "X-Algolia-Application-Id": ALGOLIA.appId, "X-Algolia-API-Key": ALGOLIA.key },
    body: JSON.stringify(body),
  });
  return (await res.json()).results[0];
}

// Algolia caps a query at 1000 hits; `industry` is single-valued and every bucket is under that.
async function fetchHiringCompanies() {
  const file = `${CACHE_DIR}/companies.json`;
  const cached = await readCache(file);
  if (cached) return cached;
  process.stdout.write("Fetching hiring companies from YC directory... ");
  const base = { query: "", hitsPerPage: "1000", attributesToHighlight: "[]",
    attributesToRetrieve: JSON.stringify(["name", "slug", "batch", "team_size", "industries", "regions", "tags", "one_liner", "website", "all_locations"]) };
  const facets = await algolia({ ...base, hitsPerPage: "0", facetFilters: JSON.stringify(["isHiring:true"]), facets: JSON.stringify(["industry"]) });
  const companies = [];
  for (const industry of Object.keys(facets.facets.industry)) {
    const r = await algolia({ ...base, facetFilters: JSON.stringify(["isHiring:true", `industry:${industry}`]) });
    companies.push(...r.hits);
  }
  console.log(companies.length);
  await writeCache(file, companies);
  return companies;
}

async function fetchCompanyPage(slug) {
  const file = `${CACHE_DIR}/pages/${slug}.json`;
  const cached = await readCache(file);
  if (cached) return cached;
  const res = await fetchWithRetry(`${WAAS}/companies/${slug}`);
  const company = parseDataPage(await res.text())?.props?.company ?? null;
  await writeCache(file, company);
  return company;
}

async function fetchJobDetail(id) {
  const file = `${CACHE_DIR}/jobs/${id}.json`;
  const cached = await readCache(file);
  if (cached) return cached;
  const res = await fetchWithRetry(`${WAAS}/jobs/${id}`);
  const props = parseDataPage(await res.text())?.props ?? {};
  const detail = { description: htmlToText(props.job?.descriptionHtml), skills: props.job?.skills ?? [], applyUrl: props.applyUrl ?? null };
  await writeCache(file, detail);
  return detail;
}

async function pool(items, worker, label) {
  const results = new Array(items.length);
  let next = 0, done = 0, failed = 0, lastError = null;
  const run = async () => {
    while (next < items.length) {
      const i = next++;
      try { results[i] = await worker(items[i]); } catch (e) { failed++; lastError = e; results[i] = null; }
      process.stdout.write(`\r${label} ${++done}/${items.length}${failed ? ` (${failed} failed)` : ""}`);
    }
  };
  await Promise.all(Array.from({ length: Math.min(CONCURRENCY, items.length) }, run));
  console.log(failed ? `\n  last error: ${lastError?.message}` : "");
  return results;
}

const choicesFrom = (counts, selected = []) =>
  [...counts].map(([value, n]) => ({ value, name: `${value} (${n})`, checked: selected.includes(value) }));
const many = (message, counts, selected) =>
  checkbox({ message: `${message} (space = toggle, enter = skip/any)`, choices: choicesFrom(counts, selected), pageSize: 15, loop: false });

async function promptCompanyFilters(companies) {
  const remote = await select({
    message: "Remote policy",
    choices: [{ value: "any", name: "Any" }, ...REMOTE_REGIONS.map((r) => ({ value: r, name: `${r} (${companies.filter((c) => c.regions?.includes(r)).length})` }))],
  });
  const regionCounts = countBy(companies, (c) => (c.regions || []).filter((r) => !REMOTE_REGIONS.includes(r)));
  const regions = await many("Company region", regionCounts);
  const industries = await many("Industry", countBy(companies, (c) => c.industries || []));
  const sizeCounts = countBy(companies, (c) => sizeBucket(c.team_size));
  const sizes = await many("Company size", new Map(SIZE_BUCKETS.map((b) => [b, sizeCounts.get(b) || 0])));
  return { remote, regions, industries, sizes };
}

async function promptJobFilters(jobs) {
  const roles = await many("Role", countBy(jobs, (j) => j.role));
  const jobTypes = await many("Job type", countBy(jobs, (j) => j.jobType || "unknown"));
  const yearsSeen = [...new Set(jobs.map((j) => j.minYears).filter((y) => y != null))].sort((a, b) => a - b);
  const maxMinYears = await select({
    message: "Max required experience",
    choices: [{ value: null, name: "Any" }, ...yearsSeen.map((y) => ({ value: y, name: `up to ${y}+ years (${jobs.filter((j) => j.minYears == null || j.minYears <= y).length})` }))],
  });
  const visa = await many("Visa", countBy(jobs, (j) => j.sponsorsVisa || "unknown"));
  const remoteOnly = await confirm({ message: `Only jobs whose location mentions Remote? (${jobs.filter((j) => j.remote).length})`, default: false });
  const keyword = await input({ message: "Keyword in title (empty = any)" });
  return { roles, jobTypes, maxMinYears, visa, remoteOnly, keyword };
}

function flattenJobs(companies, pages) {
  const jobs = [];
  companies.forEach((c, i) => {
    const page = pages[i];
    if (!page) return;
    for (const j of page.jobs || []) {
      jobs.push({
        id: j.id,
        url: `${WAAS}/jobs/${j.id}`,
        title: j.title?.trim(),
        role: inferRole(j.title),
        company: c.name,
        slug: c.slug,
        batch: c.batch,
        teamSize: page.teamSize ?? c.team_size ?? null,
        industries: c.industries || [],
        regions: c.regions || [],
        companyLocation: page.location || c.all_locations || null,
        companyOneLiner: c.one_liner || page.description || null,
        website: page.url || c.website || null,
        techStack: htmlToText(page.techDescriptionHtml),
        location: j.location,
        remote: isRemoteLocation(j.location),
        jobType: j.jobType,
        salaryRange: j.salaryRange,
        equityRange: j.equityRange,
        sponsorsVisa: j.sponsorsVisa,
        minExperience: j.minExperience,
        minYears: parseMinYears(j.minExperience),
      });
    }
  });
  return jobs;
}

async function main() {
  const saved = flags.last && existsSync(LAST_FILTERS) ? JSON.parse(await readFile(LAST_FILTERS, "utf8")) : null;
  if (flags.last && !saved) console.log(`No ${LAST_FILTERS} found, prompting instead.`);

  const all = await fetchHiringCompanies();
  const companyFilters = saved?.company ?? (await promptCompanyFilters(all));
  const companies = applyCompanyFilters(all, companyFilters);
  console.log(`${companies.length} of ${all.length} hiring companies match.`);
  if (!companies.length) return;
  if (!saved && !(await confirm({ message: `Fetch job listings for ${companies.length} companies?`, default: true }))) return;

  const pages = await pool(companies, (c) => fetchCompanyPage(c.slug), "Company pages");
  const allJobs = flattenJobs(companies, pages);
  console.log(`${allJobs.length} open jobs.`);
  const jobFilters = saved?.job ?? (await promptJobFilters(allJobs));
  const jobs = applyJobFilters(allJobs, jobFilters);
  console.log(`${jobs.length} jobs match.`);
  if (!jobs.length) return;

  const wantDetails = flags["no-details"] ? false : saved?.details ?? (await confirm({ message: `Fetch full descriptions for ${jobs.length} jobs?`, default: jobs.length <= 300 }));
  if (wantDetails) {
    const details = await pool(jobs, (j) => fetchJobDetail(j.id), "Job details");
    jobs.forEach((j, i) => Object.assign(j, details[i] || {}));
  }

  await writeFile(LAST_FILTERS, JSON.stringify({ company: companyFilters, job: jobFilters, details: wantDetails }, null, 2));
  await mkdir(OUT_DIR, { recursive: true });
  const stamp = new Date().toISOString().slice(0, 16).replace("T", "-").replace(":", "");
  const base = `${OUT_DIR}/jobs-${stamp}`;
  await writeFile(`${base}.json`, JSON.stringify({ filters: { company: companyFilters, job: jobFilters }, jobs }, null, 2));
  await writeFile(`${base}.md`, `# YC jobs ${stamp}\n\nFilters: \`${JSON.stringify({ ...companyFilters, ...jobFilters })}\`\n\n${toMarkdown(jobs)}`);
  console.log(`Wrote ${base}.json and ${base}.md`);
}

main().catch((e) => {
  if (e?.name === "ExitPromptError") process.exit(130);
  console.error(e);
  process.exit(1);
});
