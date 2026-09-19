// tests/scan-prior-application.test.mjs — prior-application cross-check
// never filters, only annotates (2026-09-19, born from a real morning-triage
// run where two postings from companies with an existing tracker row scored
// a plain YAY — the fit checklist has no way to know "I already applied
// here").
//
// Coverage:
//   1. loadAppliedCompanies parses applications.md, normalizes company keys
//      the same way every other tracker consumer does, and sorts each
//      company's rows most-recent-first.
//   2. An absent tracker file is a no-op (empty Map), same contract as
//      loadBlacklist — a career-ops install with no tracker in use (e.g. one
//      pointed only at a personal git-branch workflow) must not error.
//   3. priorApplicationLabel returns null for a company with no history and
//      a stable label for one with history.
//   4. annotatePriorApplications (scan-ats-full.mjs's flat-array pass) only
//      touches matching offers — a non-matching offer comes back byte-
//      identical (no `note`/`priorApplication` keys added), matching the
//      "byte-identical when absent" contract the blacklist filter uses.
//   5. formatPipelineOffer renders the note as a clean `note:` segment, not
//      a raw embedded markdown link (the report cell is `[N](reports/...)`;
//      the label must reduce that to `report #N`).
import { pass, fail } from './helpers.mjs';
import { mkdtempSync, writeFileSync, rmSync } from 'fs';
import { tmpdir } from 'os';
import { join } from 'path';
import { loadAppliedCompanies, priorApplicationLabel, formatPipelineOffer } from '../scan.mjs';
import { annotatePriorApplications } from '../scan-ats-full.mjs';

console.log('\nPrior-application cross-check — annotate, never filter');

const TRACKER = `# Applications Tracker

| # | Date | Company | Role | Score | Status | PDF | Report | Notes |
|---|------|---------|------|-------|--------|-----|--------|-------|
| 12 | 2026-08-01 | Riot Games | QA Engineer | 4.2/5 | Applied | ✅ | [12](reports/012-riot-games-2026-08-01.md) | strong fit |
| 45 | 2026-08-20 | Riot Games | Senior QA Engineer | 4.0/5 | Rejected | ✅ | [45](reports/045-riot-games-2026-08-20.md) | second req |
`;

const dir = mkdtempSync(join(tmpdir(), 'co-priorapp-'));
const trackerPath = join(dir, 'applications.md');
writeFileSync(trackerPath, TRACKER);

// ── 1. Parsing, normalization, most-recent-first ordering ──────────────────
{
  const map = loadAppliedCompanies(trackerPath);
  if (map.size === 1) pass('one company key for two rows under the same company');
  else fail(`expected 1 company key, got ${map.size}`);

  const entry = map.get('riotgames'); // normalizeCompany("Riot Games") strips space+case
  if (entry && entry.rows.length === 2) pass('both rows collected under the normalized key');
  else fail(`expected 2 rows under "riotgames", got ${entry?.rows.length}`);

  if (entry && entry.rows[0].num === 45) pass('rows sorted most-recent (#45) first');
  else fail(`expected row[0].num === 45, got ${entry?.rows[0]?.num}`);
}

// ── 2. Absent tracker file is a no-op ───────────────────────────────────────
{
  const map = loadAppliedCompanies(join(dir, 'no-such-file.md'));
  if (map.size === 0) pass('absent tracker file yields an empty Map (no-op)');
  else fail(`expected empty Map for a missing file, got size ${map.size}`);
}

// ── 3. priorApplicationLabel ─────────────────────────────────────────────
{
  const map = loadAppliedCompanies(trackerPath);

  const noMatch = priorApplicationLabel('Some Other Co', map);
  if (noMatch === null) pass('no label for a company with no tracker history');
  else fail(`expected null, got ${JSON.stringify(noMatch)}`);

  // Provider casing/spacing ("riotgames") must still match the tracker's
  // human-written "Riot Games" — this is the exact mismatch a real ATS feed
  // produces vs. a hand-written tracker row.
  const label = priorApplicationLabel('riotgames', map);
  if (label && label.includes('2 total') && label.includes('Senior QA Engineer') && label.includes('Rejected') && label.includes('report #45')) {
    pass('label surfaces count, most-recent role/status, and a clean report number');
  } else {
    fail(`unexpected label: ${JSON.stringify(label)}`);
  }

  if (label && !label.includes('reports/045-riot-games')) {
    pass('label does not leak the raw markdown report-link target');
  } else {
    fail('label embedded the raw report-cell markdown instead of a clean "report #N"');
  }
}

// ── 4. annotatePriorApplications only touches matching offers ──────────────
{
  const map = loadAppliedCompanies(trackerPath);
  const offers = [
    { company: 'riotgames', title: 'QA Engineer III', url: 'https://x/1' },
    { company: 'somewhereelse', title: 'QA Engineer', url: 'https://x/2' },
  ];
  const result = annotatePriorApplications(offers, map);

  if (result.annotatedPriorApplication === 1) pass('exactly one offer annotated');
  else fail(`expected annotatedPriorApplication === 1, got ${result.annotatedPriorApplication}`);

  const matched = result.offers.find(o => o.company === 'riotgames');
  const unmatched = result.offers.find(o => o.company === 'somewhereelse');

  if (matched?.priorApplication === true && typeof matched?.note === 'string') {
    pass('matching offer gets priorApplication + note');
  } else {
    fail(`matching offer missing annotation: ${JSON.stringify(matched)}`);
  }

  if (unmatched && !('note' in unmatched) && !('priorApplication' in unmatched)) {
    pass('non-matching offer is byte-identical (no note/priorApplication keys added)');
  } else {
    fail(`non-matching offer was mutated: ${JSON.stringify(unmatched)}`);
  }

  // Empty/absent map must be a true no-op, not just a same-length pass —
  // matches loadBlacklist's empty-Map contract exactly.
  const emptyResult = annotatePriorApplications(offers, new Map());
  if (emptyResult.offers === offers && emptyResult.annotatedPriorApplication === 0) {
    pass('empty appliedCompanies map returns the original array unchanged');
  } else {
    fail('empty map should short-circuit to the original offers array');
  }
}

// ── 5. formatPipelineOffer renders a clean note: segment ────────────────────
{
  const line = formatPipelineOffer({
    company: 'riotgames',
    title: 'QA Engineer III, Accessibility',
    url: 'https://job-boards.greenhouse.io/riotgames/jobs/123',
    location: 'Los Angeles, USA',
    note: priorApplicationLabel('riotgames', loadAppliedCompanies(trackerPath)),
  });

  if (line.includes('note: prior application on file') && line.includes('report #45')) {
    pass('pipeline.md line carries the prior-application note cleanly');
  } else {
    fail(`unexpected pipeline line: ${line}`);
  }
}

rmSync(dir, { recursive: true, force: true, maxRetries: 10, retryDelay: 100 });
