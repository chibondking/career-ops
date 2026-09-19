---
name: career-scan-mine
description: >-
  Run a reverse-ATS sweep tuned to the user's real QA/IT job search history
  (~/career's ~90 ROLE branches), surfacing new Greenhouse/Lever/Ashby/etc.
  postings into data/pipeline.md. Use when the user asks to scan for new QA or IT
  leads, check for new roles, or refresh the pipeline shortlist. Sourcing
  only -- never writes to ~/career or any tracker.
arguments: since ats
user_invocable: true
argument-hint: "[since-days=3] [ats=greenhouse,lever,ashby]"
license: MIT
---

# career-scan-mine -- personal QA/IT sourcing sweep

This is a thin, personal wrapper around `scan-ats-full.mjs`, kept separate
from the main `career-ops` skill/router so it isn't touched by
`update-system.mjs` and doesn't need any of career-ops's onboarding
(no `cv.md`, `config/profile.yml`, or tracker required -- this repo is used
here purely as a sourcing feed).

## Project Root Resolution

Start at this file's directory and walk upward until the nearest directory
containing both `AGENTS.md` and `modes/` -- that's `CODE_ROOT`, where
`scan-ats-full.mjs` itself lives. Resolve the *code* against `CODE_ROOT`.

**Data does not live in `CODE_ROOT`.** `portals.yml` and `data/pipeline.md`
resolve against `DATA_ROOT`, which is `$CAREER_OPS_DATA_DIR` if that env var
is set (it is, on the user's machines: `~/career/.career-ops-data/` -- inside the
*private* `~/career` repo, so this data syncs across machines via that
repo's own git, not this one). If the env var is unset, ask the user rather than
assuming `CODE_ROOT` -- guessing wrong means editing/reading the wrong
`portals.yml`. See `getCareerOpsRoot()` in `path-resolver.mjs` for the exact
resolution order.

## What this scope covers

`portals.yml`'s `title_filter`/`location_filter` (in `DATA_ROOT`, see above)
were derived directly from the user's real branch history in `~/career`
(`git branch -a`, surveyed 2026-09-18), not guessed:

- QA/QE track: QA, Quality Assurance/Engineer/Analyst, SQA, SDET, Test
  Engineer, UAT, Manual QA/Tester, QA Automation, Business Analyst, etc.
- IT track: IT Support, Help Desk, IT Systems, Systems Administrator, NOC,
  Data Center Tech, ITAM, etc. (kept in the same feed -- QA vs. IT
  classification happens in ~/career's own intake Step 1, not here)
- Geography: US remote + a specific home-metro radius the user has defined
  in `~/career/CLAUDE.md` (private repo -- see that file for the exact
  cities/zip, not repeated here)

Deliberately NOT filtered out: "Lead" and "Staff" level titles. The user's
own branch history includes real applications at both levels despite
`~/career/CLAUDE.md`'s "Senior IC only" default -- the level call belongs
to ~/career's triage step, not this filter.

**Do not re-tune `title_filter`/`location_filter` from a hunch.** If the user
asks for a refresh, re-derive it the same way: `git -C ~/career branch -a`
and re-survey the branch names, then ask the user to confirm before changing
`portals.yml`.

## Steps

1. Parse `$since` (default `3`) and `$ats` (default `greenhouse,lever,ashby`
   -- Workday and iCIMS are slower/heavier; only include them if the user asks or
   it's been a while since the last sweep).
2. From `CODE_ROOT`, run:
   ```
   node scan-ats-full.mjs --since {since} --ats {ats}
   ```
   (this reads/writes `DATA_ROOT`, i.e. `$CAREER_OPS_DATA_DIR`, automatically
   -- no `cd` into that directory needed). If a prior run for this scope was
   interrupted, `DATA_ROOT/data/cache/ats-full-checkpoint.json` will exist --
   offer `--resume` in that case instead of starting over.
3. After it completes, read `DATA_ROOT/data/pipeline.md` and summarize just
   the entries this run added (title, company, link) -- not the whole
   file's history.
4. Remind the user (briefly, not every time -- once per session is enough):
   `data/pipeline.md` is a shortlist to hand-pick from. Nothing here
   writes to `~/career`, ClickUp, or any tracker. To act on an entry, copy
   its JD text into `~/career/Tex/job_description.md` on `CLAUDE-StartHere`
   and continue with the existing intake workflow there, exactly as today
   -- or, for the full daily routine including triage, use the
   `morning-triage` skill in `~/career` instead of this one directly.
5. Never auto-select an entry, draft anything, or touch `~/career` from
   this skill -- it only sources and lists.
