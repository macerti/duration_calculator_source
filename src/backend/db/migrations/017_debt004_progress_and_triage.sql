-- Audit Duration Engine -- fifty-seventh session tracker updates:
-- DEBT-004's relocation half done (frontend unit tests half still open),
-- ANN-006 closed as a duplicate of DEBT-002, ANN-008 triaged into FEAT-013,
-- FEAT-012 verified against the real production server.
-- Migration: 017_debt004_progress_and_triage
-- Created: 2026-09-14
-- Author: Claude (dev session, 2026-09-14, fifty-seventh session)

-- DEBT-004: the tests/ relocation half is DONE this session -- properly,
-- not just a find/replace. Discovered along the way that
-- REPOSITORY_ARCHITECTURE.md/DEV_STATUS.md's ninth session had already
-- evaluated and deliberately deferred this exact move (relative-require
-- coupling, "lower-risk call") -- DEBT-004 itself (opened sessions
-- thirty-six through thirty-nine) never cross-referenced that decision,
-- so re-litigated it as plain oversight rather than a considered call.
-- Investigated the actual coupling (only 2 test files, only one -- 
-- smoke_test.php -- has any relative requires at all, 9 lines) and found
-- it more tractable than the ninth session's broader multi-tree-move
-- context suggested. Moved via `git mv` to tests/backend/, updated
-- Makefile + CI workflow + check-repo-hygiene.sh's stale-pattern list.
-- Along the way, caught and fixed a real bug this move introduced: a
-- naive single relative path is wrong in one of the two contexts this
-- file runs in (repo vs. deploy artifact), and check-deploy-artifact.sh's
-- own require-resolution check gave a FALSE PASS because it ran inside a
-- full checkout where the source tree happens to sit right next to
-- _deploy/ -- only caught by copying the artifact to a location with
-- nothing else around it and running it there directly, simulating a
-- real isolated deployment. Fixed smoke_test.php with a runtime-resolved
-- $backendRoot (works correctly in both contexts, verified in true
-- isolation both ways) and hardened check-deploy-artifact.sh itself to
-- also reject requires that resolve OUTSIDE the artifact, not just ones
-- that fail to resolve at all -- closing the exact blind spot that let
-- the introduced bug through undetected the first time.
UPDATE tracker_items
SET
  status = 'in_progress',
  technical_description = CONCAT(
    technical_description,
    ' -- RELOCATION HALF DONE 2026-09-14 (fifty-seventh session): moved to tests/backend/ via git mv, ',
    'Makefile/CI/hygiene-script paths updated. smoke_test.php (the only file with any relative-require ',
    'coupling) resolves via a runtime $backendRoot check rather than a single hardcoded path, since the ',
    'correct relative depth genuinely differs between the repo and the deploy artifact -- verified working ',
    'in both by copying the built artifact to a location with nothing else around it and running it there ',
    'directly (24/24), not just trusting check-deploy-artifact.sh''s static check, which was hardened this ',
    'same session after it gave a false pass on the first attempt (see DEBT-006, logged this session, for ',
    'the checker gap itself). Frontend unit-test half (Jest/Vitest for wizard calculation state) still fully open.'
  ),
  tests_to_do = 'Relocation half: DONE and verified (migrate.php 14/14, smoke_test.php 24/24, http_api_test.php 117/117, check-repo-hygiene.sh 4/4, make build-deploy + check-deploy-artifact.sh 4/4, PLUS a true-isolation run of the deploy artifact''s own smoke_test.php copy -- 24/24). Frontend unit-test half: not started -- choose Jest vs Vitest, scope an initial test target (wizard calculation state/hooks), then build out coverage incrementally.',
  comments = 'Relocation half closed out fifty-seventh session (2026-09-13) -- properly, including a bug introduced and caught within the same session (see DEBT-006). Frontend unit tests remain as their own, separately-scoped piece of this item.'
WHERE code = 'DEBT-004';

-- New debt item: check-deploy-artifact.sh's require-resolution check had a
-- real blind spot (passed a require that escaped the artifact entirely, as
-- long as something happened to exist at the resolved path) -- hardened
-- this session, but logging the finding itself for visibility, same as
-- DEBT-005 last session.
INSERT INTO tracker_items (
  code, type, title, user_description, technical_description, status,
  priority, dependencies, tests_to_do, comments
) VALUES (
  'DEBT-006',
  'techdebt',
  'check-deploy-artifact.sh gave a false pass for a require that escaped the artifact entirely',
  NULL,
  'Discovered fifty-seventh session while fixing DEBT-004: the require-resolution check only verified a required path resolved to SOME real file via realpath -m + -f, never that the resolved path stayed inside $DEPLOY_DIR. A require using enough ../ to climb out of the artifact and back into the source tree passed cleanly when run from inside a full checkout (where that source tree happens to still be sitting right there), but would fatal-error on a real isolated deployment. Fixed this session: added a check that the resolved path starts with the artifact''s own realpath, failing loudly (ESCAPING_REQUIRES) if not. Verified the fix actually catches this class of bug via a negative test (reintroduced the exact broken pattern in a scratch copy, confirmed it now fails).',
  'closed',
  'p2',
  'scripts/check-deploy-artifact.sh',
  'Negative test performed this session: reintroduced the escaping-require pattern in a scratch copy of the artifact, confirmed the hardened check fails on it as expected.',
  'Fixed and verified same session as found (fifty-seventh session, 2026-09-13) -- closed rather than left open since the fix was immediate, small, and confirmed by both a positive (real artifact passes) and negative (reintroduced bug fails) test.'
);

-- ANN-006: duplicate of DEBT-002 (same raw complaint, already fully
-- triaged into DEBT-002''s technical_description with a real remediation
-- plan) -- never marked closed when that triage happened. Closing now as
-- a duplicate rather than leaving it sitting in the open list forever.
UPDATE tracker_items
SET status = 'closed', comments = 'Closed as a duplicate of DEBT-002 (fifty-seventh session, 2026-09-13) -- same raw complaint, already fully triaged there with a real remediation plan. Never marked closed when that triage happened originally.'
WHERE code = 'ANN-006';

-- ANN-008: genuinely new feedback, not a duplicate of anything existing --
-- triaged into a proper feature entry (FEAT-013) with a real technical
-- description and priority, rather than left as a raw annotation.
UPDATE tracker_items
SET status = 'closed', comments = 'Triaged into FEAT-013 (fifty-seventh session, 2026-09-13) -- see that item for the actual technical scoping.'
WHERE code = 'ANN-008';

INSERT INTO tracker_items (
  code, type, title, user_description, technical_description, status,
  priority, dependencies, tests_to_do, comments
) VALUES (
  'FEAT-013',
  'feature',
  'Annotation capture: show more context about the pointed-at element, not just x/y',
  'for each annotation you show the x and y position its good it would also be good if you give more details regarding the element the user pointed at like its name its container or technical designation (ANN-008)',
  'AnnotationCapture.tsx''s resolveWebElementRef() currently walks the DOM/component tree looking for a testID, storing only that (as elementRef) plus raw x/y -- see DEBT-003, whose own finding is that testID coverage is near-zero app-wide, so elementRef comes back null for the large majority of real annotations today. This request is for a lower-effort fallback that does not depend on DEBT-003''s full testID rollout: when no testID is found, still capture and display whatever is cheaply available without new instrumentation -- the DOM tag name, any aria-label/accessible name, and the nearest ancestor with a recognizable role or heading text as a stand-in for "container". Purely additive to the annotation''s stored/displayed metadata; does not change x/y capture, the pin UI, or anything about how annotations are created or resolved into tracker_items today.',
  'open',
  'p2',
  'AnnotationCapture.tsx (resolveWebElementRef), AdminTrackerScreen.tsx (annotation detail display)',
  'Once built: capture an annotation on an untagged element, confirm the fallback fields (tag/aria-label/container) show up and read as genuinely useful, not just noisy DOM internals. Live click-through, same standing sandbox limitation as every other frontend feature in this project.',
  'Logged fifty-seventh session (2026-09-13), triaged from ANN-008. Not started -- P2, behind the P1 queue (DEBT-002, FEAT-001, FEAT-008 slice 2, FEAT-009).'
);

-- FEAT-012 (dev-export system, built and pushed last session as
-- fixed_unverified): verified this session -- manually dispatched the
-- workflow via the GitHub API against the REAL production server (run ID
-- 34714140136, conclusion: success), pulled the resulting commit, and
-- confirmed docs/TRACKER_SNAPSHOT.md/.json landed with real production
-- tracker data (this very update cycle''s own prior-session rows included).
-- This is what let a live-data question from Mahdi actually get answered
-- directly this session, which is the strongest possible confirmation
-- this system does what it was built for.
UPDATE tracker_items
SET
  status = 'verified',
  tests_to_do = 'DONE 2026-09-14 (fifty-seventh session): Mahdi completed the two one-time setup steps (dev_export_secret in live config.php, DEV_EXPORT_SECRET GitHub Actions secret). Manually dispatched the workflow via the GitHub API against the real production server -- run 34714140136, conclusion success -- pulled the resulting commit, confirmed docs/TRACKER_SNAPSHOT.md/.json contain real live production tracker data.',
  comments = CONCAT(
    comments,
    ' -- INDEPENDENTLY RE-CONFIRMED 2026-09-14 (fifty-seventh session, via a different path than migration 015''s own re-confirmation above): manually dispatched .github/workflows/dev-export-snapshot.yml via the GitHub API directly (run 34714140136, conclusion success), pulled the resulting commit, and read Mahdi''s own live tracker edits from it (BUG-051/052/DEBT-001 closed, ANN-006/ANN-008 added) -- which is exactly what this system was built to do.'
  )
WHERE code = 'FEAT-012';

INSERT INTO tracker_updates (item_code, done, next)
SELECT 'DEBT-004', 'Relocated src/backend/tests/ to top-level tests/backend/ (git mv, history preserved). Updated Makefile (test/test-http/build-deploy targets), .github/workflows/build-test-publish.yml (3 steps), check-repo-hygiene.sh (added the old path to the stale-reference pattern). Fixed smoke_test.php''s 9 relative requires with a runtime-resolved $backendRoot instead of a single hardcoded depth, since the repo and deploy-artifact contexts genuinely need different relative depths -- verified both via a true-isolation run (artifact copied to a location with nothing else around it), not just the automated checker (which gave a false pass on the first attempt -- see DEBT-006). Full fresh verification: migrate.php 14/14, smoke_test.php 24/24, http_api_test.php 117/117, check-repo-hygiene.sh 4/4, make build-deploy + check-deploy-artifact.sh 4/4, plus the isolated artifact run (24/24).', 'Frontend unit-test half: choose Jest vs Vitest, scope an initial test target (wizard calculation state/hooks), build out from there.'
WHERE EXISTS (SELECT 1 FROM tracker_items WHERE code = 'DEBT-004');

INSERT INTO tracker_updates (item_code, done, next)
SELECT 'DEBT-006', 'Hardened check-deploy-artifact.sh''s require-resolution check to also reject requires that resolve OUTSIDE the artifact directory, not just ones that fail to resolve at all. Verified with both a positive test (the real, fixed artifact passes) and a negative test (reintroduced the exact broken pattern in a scratch copy, confirmed it now fails).', 'None -- closed same session as found.'
WHERE EXISTS (SELECT 1 FROM tracker_items WHERE code = 'DEBT-006');

-- ANN-006/ANN-008: real production-only annotation rows (created live
-- in the app, never part of any migration's seed data), so they will
-- not exist in a fresh local/CI database -- guarded with WHERE EXISTS
-- rather than a plain INSERT so this migration stays safe to run in
-- both environments, matching this file's own UPDATE statements above
-- (which are already no-ops, not errors, wherever these codes are absent).
INSERT INTO tracker_updates (item_code, done, next)
SELECT 'ANN-006', 'Closed as a duplicate of DEBT-002.', 'None.'
WHERE EXISTS (SELECT 1 FROM tracker_items WHERE code = 'ANN-006');

INSERT INTO tracker_updates (item_code, done, next)
SELECT 'ANN-008', 'Triaged into FEAT-013 with a real technical scoping.', 'See FEAT-013.'
WHERE EXISTS (SELECT 1 FROM tracker_items WHERE code = 'ANN-008');

INSERT INTO tracker_updates (item_code, done, next)
SELECT 'FEAT-013', 'Logged and scoped from ANN-008 -- a lower-effort fallback that does not require DEBT-003''s full testID rollout first.', 'Build the fallback in AnnotationCapture.tsx''s resolveWebElementRef(), behind the existing P1 queue.'
WHERE EXISTS (SELECT 1 FROM tracker_items WHERE code = 'FEAT-013');

INSERT INTO tracker_updates (item_code, done, next)
SELECT 'FEAT-012', 'Verified against the real production server via a manually-dispatched GitHub Actions run (34714140136, success) after Mahdi completed the two one-time secret-setup steps. Confirmed docs/TRACKER_SNAPSHOT.md contains real live data.', 'None -- closing the loop on this item.'
WHERE EXISTS (SELECT 1 FROM tracker_items WHERE code = 'FEAT-012');
