-- Audit Duration Engine -- update FEAT-007's tracker_items row now that
-- Guided Test Mode has been built and build-verified.
-- Migration: 010_feat007_status
-- Created: 2026-09-11
-- Author: Claude (dev session, 2026-09-11, fifty-second session)
--
-- Why this exists: FEAT-007 ("In-App Guided Acceptance Test Runner &
-- Report Exporter") was seeded as an open p1 backlog row by migration 005.
-- This session built it (src/frontend/src/data/acceptanceTests.ts +
-- src/frontend/src/screens/GuidedTestRunnerScreen.tsx, wired into
-- App.tsx/ProfileScreen.tsx behind manage_tracker) and fully build-verified
-- it (tsc clean, expo export 562 modules, make build-deploy 4/4,
-- check-repo-hygiene.sh 4/4, backend baseline unchanged at 24/24 + 107/107).
-- Same self-tracking convention as migration 006 (FEAT-010's own row):
-- update via a migration rather than the live API, since this repo's
-- migrations are what actually reach the real deployed DB.
--
-- Status is 'fixed_unverified', not 'verified' or 'closed' -- same
-- standing gap as every other frontend feature in this project's history:
-- no live device/browser click-through has ever been possible from this
-- sandboxed environment. Needs a real click-through from Mahdi (create a
-- run, mark a few items, generate + copy/share/download both export
-- formats) before this can be called closed.

UPDATE tracker_items
SET
  status = 'fixed_unverified',
  technical_description = CONCAT(
    technical_description,
    ' -- BUILT 2026-09-11 (fifty-second session): src/frontend/src/data/acceptanceTests.ts ',
    '(structured transcription of all 73 docs/TEST_CHECKLIST.md scenarios) + ',
    'src/frontend/src/screens/GuidedTestRunnerScreen.tsx (pass/fail/skip per scenario, ',
    'note field for fail/skip, live per-section progress via CollapsibleSection, ',
    'Markdown export matching TEST_CHECKLIST.md''s own Test History format + JSON export, ',
    'Copier/Partager/Telecharger reusing the AdminAnnotationsScreen.tsx export pattern). ',
    'Wired into App.tsx/ProfileScreen.tsx behind manage_tracker (no new permission). ',
    'v1 scope: results live in React state only, no backend persistence of in-progress runs.'
  ),
  dependencies = 'src/frontend/src/data/acceptanceTests.ts, src/frontend/src/screens/GuidedTestRunnerScreen.tsx, App.tsx, ProfileScreen.tsx',
  tests_to_do = 'Live device/browser click-through: work through several scenarios across different sections, confirm the note field only appears for fail/skip, generate both export formats, confirm Copier/Partager/Telecharger all work on a real device -- same standing sandbox limitation as every other frontend feature in this project, never yet verified live.',
  comments = 'Built and build-verified (tsc clean, expo export 562 modules, make build-deploy 4/4, check-repo-hygiene.sh 4/4) fifty-second session. Backend baseline unchanged: smoke_test.php 24/24, http_api_test.php 107/107. Needs a live click-through from Mahdi before this can be called verified/closed.'
WHERE code = 'FEAT-007';

INSERT INTO tracker_updates (item_code, done, next)
VALUES (
  'FEAT-007',
  'Built src/frontend/src/data/acceptanceTests.ts (all 73 docs/TEST_CHECKLIST.md scenarios, original stable IDs preserved) and src/frontend/src/screens/GuidedTestRunnerScreen.tsx (guided walkthrough, live progress, Markdown/JSON export reusing the AdminAnnotationsScreen.tsx export pattern), wired into App.tsx/ProfileScreen.tsx behind the existing manage_tracker permission. Full verification: tsc clean, expo export 562 modules (first confirmed export since the forty-fourth session -- five sessions of accumulated frontend changes had never been build-verified until this run), make build-deploy 4/4, check-repo-hygiene.sh 4/4, backend baseline unchanged (smoke_test.php 24/24, http_api_test.php 107/107). Version bumped 5.4.0 -> 5.5.0.',
  'Get a real live click-through from Mahdi (work through scenarios, confirm note field show/hide, generate + export both formats, confirm all three export actions on a real device) before calling this verified/closed. After that: FEAT-008/001/009 by priority, then DEBT-001/002/003/004.'
);
