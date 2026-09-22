---
name: msg
description: Generate a Work at a Startup "Reach out" message for one job, by index or job id from out/jobs-index.json, tailored to the CV in the project root. Usage: /msg <index|id> [founder name or extra instructions]
---

# /msg — reach-out text for one YC job

Arguments: `$ARGUMENTS`. First token is the job index (the `#` column in `out/match-*.md`) or the WaaS job id. Anything after it is extra instruction: the founder's name, a tone note, a language, a max length.

## Steps

1. Read `out/jobs-index.json` and find the entry whose `idx` or `id` equals the first token. If none matches, print the five closest by index and stop.
2. Read the CV in the project root (a file whose name contains "resume", "CV" or "curriculum"; `.md`, `.pdf` or `.docx`). Every fact in the message must come from it: name, location, timezone, years of experience, stack, achievements with numbers.
3. Use the entry's `description`, `techStack`, `skills`, `location`, `sponsorsVisa`, `minExperience`, `salaryRange`, `why`, `gaps`.
4. If the description says AI-written applications or cover letters are rejected, do not write prose. Give 4-6 bullet points for the candidate to write in their own words, and say why.
5. Otherwise write the message:
   - Under 900 characters, plain text, no markdown, no bullet lists, no em-dashes.
   - Opens with `Hi [name],`, or the founder's name if given in the arguments.
   - One sentence: who the candidate is, where they are based with timezone, and how they work (remote, hours overlap) when the CV supports it.
   - One concrete reason for this company, drawn from the description (a product detail or a phrase from the posting), not generic praise.
   - One or two proof points from the CV with numbers, chosen to match what the posting asks for.
   - If `gaps` names a stack mismatch, acknowledge it honestly in one clause.
   - One ask: a call, a take-home, or a direct question when `gaps` mentions unclear remote scope or pay.
   - Never invent facts, names, or company details.
6. Output the message in a fenced code block, then one line with job id, URL, and any warning from `gaps`. Append the message to `out/messages-<today>.md` under `## <idx>. <company> — <title> (<id>)`, creating the file if needed, and say so.
