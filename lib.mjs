const ENTITIES = { quot: '"', amp: "&", lt: "<", gt: ">", apos: "'", nbsp: " " };

function decodeEntities(s) {
  return s.replace(/&(#x?[0-9a-f]+|[a-z]+);/gi, (m, e) => {
    if (e[0] === "#") return String.fromCodePoint(parseInt(e[1] === "x" || e[1] === "X" ? e.slice(2) : e.slice(1), e[1] === "x" || e[1] === "X" ? 16 : 10));
    return ENTITIES[e.toLowerCase()] ?? m;
  });
}

/** Extracts the Inertia.js page object embedded in a Work at a Startup HTML page. */
export function parseDataPage(html) {
  const m = html.match(/data-page="([^"]+)"/);
  return m ? JSON.parse(decodeEntities(m[1])) : null;
}

/** Converts an HTML fragment into plain text, one line per block element. */
export function htmlToText(html) {
  if (!html) return "";
  return decodeEntities(
    html
      .replace(/<br\s*\/?>/gi, "\n")
      .replace(/<\/(p|div|h[1-6]|li|tr)>/gi, "\n")
      .replace(/<[^>]+>/g, ""),
  )
    .split("\n")
    .map((l) => l.replace(/\s+/g, " ").trim())
    .filter(Boolean)
    .join("\n");
}

const ROLE_RULES = [
  ["eng-manager", /\b(engineering manager|head of engineering|vp of engineering|director of engineering|cto)\b/],
  ["product", /\b(product manager|product lead|head of product|product owner|group pm|\bpm\b)/],
  ["design", /\b(designer|design lead|head of design|ux|ui\/ux)\b/],
  ["frontend", /\b(front[- ]?end|react|angular|vue|web engineer|ui engineer)\b/],
  ["fullstack", /\b(full[- ]?stack)\b/],
  ["mobile", /\b(mobile|ios|android|react native|flutter)\b/],
  ["devops", /\b(devops|sre|site reliability|infrastructure|platform engineer|cloud engineer)\b/],
  ["ml-ai", /\b(machine learning|ml|ai engineer|ai research|llm|applied ai|deep learning|research scientist|research engineer)\b/],
  ["data", /\b(data engineer|data scientist|analytics engineer|data analyst)\b/],
  ["security", /\bsecurity\b/],
  ["backend", /\b(back[- ]?end|server[- ]?side|api engineer)\b/],
  ["qa", /\b(qa|quality assurance|test engineer|sdet)\b/],
  ["hardware", /\b(mechanical|electrical|hardware|firmware|embedded|robotics|manufacturing|chemical|process engineer)\b/],
  ["sales", /\b(sales|account executive|account manager|ae|sdr|bdr|business development)\b/],
  ["marketing", /\b(marketing|growth|content|brand|communications)\b/],
  ["software", /\b(software|engineer|developer|swe|programmer|architect)\b/],
  ["ops", /\b(operations|ops|chief of staff|recruit|people|hr\b|finance|legal|accountant|support|customer success|program manager|project manager|analyst|coordinator|assistant|manager)\b/],
];

/** Guesses a coarse role bucket from a job title. */
export function inferRole(title) {
  const t = (title || "").toLowerCase();
  for (const [role, re] of ROLE_RULES) if (re.test(t)) return role;
  return "other";
}

/** "3+ years" -> 3, "Any (new grads ok)" -> 0, unknown -> null. */
export function parseMinYears(s) {
  if (!s) return null;
  const m = s.match(/(\d+)\s*\+?\s*year/i);
  if (m) return Number(m[1]);
  return /any|new grad/i.test(s) ? 0 : null;
}

export const SIZE_BUCKETS = ["1-10", "11-50", "51-200", "201-1000", "1000+"];

export function sizeBucket(n) {
  if (n == null) return "unknown";
  if (n <= 10) return "1-10";
  if (n <= 50) return "11-50";
  if (n <= 200) return "51-200";
  if (n <= 1000) return "201-1000";
  return "1000+";
}

export function isRemoteLocation(loc) {
  return /\bremote\b/i.test(loc || "");
}

export const REMOTE_REGIONS = ["Remote", "Fully Remote", "Partly Remote"];

export function applyCompanyFilters(companies, f = {}) {
  return companies.filter((c) => {
    const regions = c.regions || [];
    if (f.remote && f.remote !== "any" && !regions.includes(f.remote)) return false;
    if (f.regions?.length && !regions.some((r) => f.regions.includes(r))) return false;
    if (f.industries?.length && !(c.industries || []).some((i) => f.industries.includes(i))) return false;
    if (f.sizes?.length && !f.sizes.includes(sizeBucket(c.team_size))) return false;
    return true;
  });
}

export function applyJobFilters(jobs, f = {}) {
  const kw = (f.keyword || "").trim().toLowerCase();
  return jobs.filter((j) => {
    if (f.roles?.length && !f.roles.includes(j.role)) return false;
    if (f.jobTypes?.length && !f.jobTypes.includes(j.jobType)) return false;
    if (f.maxMinYears != null && j.minYears != null && j.minYears > f.maxMinYears) return false;
    if (f.visa?.length && !f.visa.includes(j.sponsorsVisa)) return false;
    if (f.remoteOnly && !j.remote) return false;
    if (kw && !(j.title || "").toLowerCase().includes(kw)) return false;
    return true;
  });
}

/** Counts items by key (arrays count once per element), sorted by count desc. */
export function countBy(items, keyFn) {
  const m = new Map();
  for (const it of items) {
    const k = keyFn(it);
    for (const v of Array.isArray(k) ? k : [k]) m.set(v, (m.get(v) || 0) + 1);
  }
  return new Map([...m].sort((a, b) => b[1] - a[1]));
}

const cell = (v) => String(v ?? "-").replace(/\|/g, "\\|").replace(/\s+/g, " ").trim() || "-";

export function toMarkdown(jobs) {
  const head = "| # | Company | Title | Location | Type | Salary | Equity | Exp | Visa | Link |\n|---|---|---|---|---|---|---|---|---|---|\n";
  return head + jobs.map((j, i) => `| ${i + 1} | ${[j.company, j.title, j.location, j.jobType, j.salaryRange, j.equityRange, j.minExperience, j.sponsorsVisa, j.url].map(cell).join(" | ")} |`).join("\n") + "\n";
}
