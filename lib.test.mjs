import { test } from "node:test";
import assert from "node:assert/strict";
import {
  parseDataPage, htmlToText, inferRole, parseMinYears, sizeBucket,
  isRemoteLocation, applyCompanyFilters, applyJobFilters, countBy, toMarkdown,
} from "./lib.mjs";

test("parseDataPage decodes the escaped Inertia payload", () => {
  const html = `<div id="app" data-page="{&quot;component&quot;:&quot;X&quot;,&quot;props&quot;:{&quot;a&quot;:&quot;b &amp; c&quot;}}"></div>`;
  assert.deepEqual(parseDataPage(html), { component: "X", props: { a: "b & c" } });
  assert.equal(parseDataPage("<html>no app</html>"), null);
});

test("htmlToText strips tags and decodes entities", () => {
  assert.equal(htmlToText("<h2>What</h2>\n<p>We&#39;re <b>fixing</b>&nbsp;it &amp; more</p>"), "What\nWe're fixing it & more");
  assert.equal(htmlToText(null), "");
});

test("inferRole classifies engineering titles", () => {
  const cases = {
    "Senior Frontend Engineer": "frontend",
    "Front-End Developer (React)": "frontend",
    "Full Stack Engineer": "fullstack",
    "Fullstack Software Engineer": "fullstack",
    "Backend Engineer": "backend",
    "iOS Engineer": "mobile",
    "Site Reliability Engineer": "devops",
    "Machine Learning Engineer": "ml-ai",
    "AI Engineer": "ml-ai",
    "Data Engineer": "data",
    "Security Engineer": "security",
    "Engineering Manager": "eng-manager",
    "Founding Engineer": "software",
    "Software Engineer": "software",
    "Product Engineer": "software",
    "Product Manager": "product",
    "Product Designer": "design",
    "Account Executive": "sales",
    "Founding AE": "sales",
    "Growth Marketing Lead": "marketing",
    "Technical Program Manager - Implementation": "ops",
    "Mechanical Engineer": "hardware",
    "Chief of Staff": "ops",
  };
  for (const [title, role] of Object.entries(cases)) assert.equal(inferRole(title), role, title);
});

test("parseMinYears reads the minExperience string", () => {
  assert.equal(parseMinYears("3+ years"), 3);
  assert.equal(parseMinYears("Any (new grads ok)"), 0);
  assert.equal(parseMinYears("11+ years"), 11);
  assert.equal(parseMinYears(null), null);
});

test("sizeBucket", () => {
  assert.equal(sizeBucket(1), "1-10");
  assert.equal(sizeBucket(10), "1-10");
  assert.equal(sizeBucket(11), "11-50");
  assert.equal(sizeBucket(200), "51-200");
  assert.equal(sizeBucket(1000), "201-1000");
  assert.equal(sizeBucket(1001), "1000+");
  assert.equal(sizeBucket(null), "unknown");
});

test("isRemoteLocation", () => {
  assert.equal(isRemoteLocation("San Francisco, CA, US / Remote (US)"), true);
  assert.equal(isRemoteLocation("Remote"), true);
  assert.equal(isRemoteLocation("New York, NY, US"), false);
  assert.equal(isRemoteLocation(null), false);
});

test("applyCompanyFilters matches regions, industries and size", () => {
  const cs = [
    { slug: "a", regions: ["Remote", "Fully Remote", "Latin America"], industries: ["B2B", "Fintech"], team_size: 5 },
    { slug: "b", regions: ["United States of America"], industries: ["Healthcare"], team_size: 300 },
  ];
  assert.deepEqual(applyCompanyFilters(cs, {}).map((c) => c.slug), ["a", "b"]);
  assert.deepEqual(applyCompanyFilters(cs, { remote: "Fully Remote" }).map((c) => c.slug), ["a"]);
  assert.deepEqual(applyCompanyFilters(cs, { regions: ["Latin America", "Europe"] }).map((c) => c.slug), ["a"]);
  assert.deepEqual(applyCompanyFilters(cs, { industries: ["Healthcare"] }).map((c) => c.slug), ["b"]);
  assert.deepEqual(applyCompanyFilters(cs, { sizes: ["201-1000"] }).map((c) => c.slug), ["b"]);
});

test("applyJobFilters matches role, type, experience, visa, remote, keyword", () => {
  const js = [
    { id: 1, title: "Frontend Engineer", role: "frontend", jobType: "Full-time", minYears: 3, sponsorsVisa: "Will sponsor", location: "Remote", remote: true },
    { id: 2, title: "Backend Engineer", role: "backend", jobType: "Contract", minYears: 6, sponsorsVisa: "US citizen/visa only", location: "NYC", remote: false },
    { id: 3, title: "Founding Engineer", role: "software", jobType: "Full-time", minYears: null, sponsorsVisa: null, location: "Berlin", remote: false },
  ];
  const ids = (f) => applyJobFilters(js, f).map((j) => j.id);
  assert.deepEqual(ids({}), [1, 2, 3]);
  assert.deepEqual(ids({ roles: ["frontend", "software"] }), [1, 3]);
  assert.deepEqual(ids({ jobTypes: ["Contract"] }), [2]);
  assert.deepEqual(ids({ maxMinYears: 3 }), [1, 3]);
  assert.deepEqual(ids({ visa: ["Will sponsor"] }), [1]);
  assert.deepEqual(ids({ remoteOnly: true }), [1]);
  assert.deepEqual(ids({ keyword: "founding" }), [3]);
});

test("countBy returns counts sorted desc", () => {
  const m = countBy([{ k: "a" }, { k: "b" }, { k: "a" }], (x) => x.k);
  assert.deepEqual([...m], [["a", 2], ["b", 1]]);
  const multi = countBy([{ k: ["x", "y"] }, { k: ["y"] }], (x) => x.k);
  assert.deepEqual([...multi], [["y", 2], ["x", 1]]);
});

test("toMarkdown renders a table row per job", () => {
  const md = toMarkdown([{ id: 9, title: "FE | Eng", company: "Acme", location: "Remote", jobType: "Full-time", salaryRange: "$1", equityRange: null, minExperience: "3+ years", sponsorsVisa: "Will sponsor", url: "https://x/9" }]);
  assert.match(md, /\| Company \| Title \|/);
  assert.match(md, /\| Acme \| FE \\\| Eng \| Remote \| Full-time \| \$1 \| - \| 3\+ years \| Will sponsor \| https:\/\/x\/9 \|/);
});
