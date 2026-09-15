-- Audit Duration Engine -- update FEAT-008's tracker_items row: slice 2
-- (parameter admin) backend is now built and HTTP-tested. Frontend UI for
-- it is a separate, still-open follow-up.
-- Migration: 023_feat008_slice2_backend_status
-- Created: 2026-09-15
-- Author: Claude (dev session, 2026-09-15, fifty-ninth session)
--
-- What this session resolved that earlier sessions had flagged as open
-- architectural questions:
-- - "data-driven vs hardcoded engine parameters": confirmed
--   parameter_sets/parameterSetRepo.php already covers nearly everything
--   (IAF tables, factor catalogue, synergy grid, stage/surveillance/
--   sampling coefficients, rounding, extrapolation, validation bounds) --
--   a full survey of all 9 engine/*.php files (639 lines total) found
--   exactly ONE place with genuine hardcoded business-rule numbers not
--   already sourced from params: engine/nae.php's 0.75 repetitive-task
--   discount and /4 indirect-staff divisor. Promoted both into a new
--   naeCoefficients section of the parameter-set schema (additive,
--   defaults preserve exact prior behavior via ?? fallbacks -- see
--   engine/nae.php's own comments). Everything else flagged in that
--   survey (RISK_NUMERIC/CYCLE_TABLE domain-category mappings, the 0.1
--   arrondiSupUnDixieme rounding threshold, display-precision rounding)
--   is a fixed methodology/domain-definition constant, not a tunable
--   business parameter -- deliberately NOT exposed as editable data,
--   flagged for Mahdi to confirm or override rather than assumed.
-- - "NAE formula editability": Mahdi's own tracker comment ("all
--   hardcoded formulas can be edited -- numbers, operations, steps")
--   read narrowly (the numbers) is now satisfied by the above. Reading it
--   broadly (the operations/control-flow themselves becoming
--   admin-editable, e.g. a general expression engine) would be a much
--   larger, higher-risk undertaking (safe expression evaluation, a full
--   engine rewrite across all 9 files) that was deliberately NOT started
--   without Mahdi's explicit confirmation first, given this system's
--   real compliance stakes -- flagged in the hand-off, not assumed.
-- - "auth as a hard prerequisite": already true and already satisfied --
--   manage_parameters (migration 011) gates every route added here.

UPDATE tracker_items
SET
  technical_description = CONCAT(
    technical_description,
    ' -- SLICE 2 BACKEND BUILT 2026-09-15 (fifty-ninth session): full ',
    'admin API for parameter_sets (GET /admin/parameters, GET .../versions, ',
    'GET .../versions/:id, PUT /admin/parameters [save edit as new version], ',
    'POST .../activate [rollback/re-activate]) on top of the pre-existing ',
    'parameterSetRepo.php -- no schema migration needed, that table/its ',
    'change-log have existed since the initial schema. Also promoted ',
    'engine/nae.php''s two hardcoded coefficients (0.75, /4) into a new ',
    'naeCoefficients parameter-set section -- the one genuine hardcoded-',
    'formula-number gap found in a full survey of all 9 engine files. 14 ',
    'new HTTP tests including a full save-edit-activate-verify-rollback-',
    'reverify cycle proving an admin edit actually changes /nae output and ',
    'reverting restores the original. Frontend AdminParametersScreen.tsx ',
    'is NOT built yet -- reachable only via direct API calls until it is.'
  ),
  dependencies = 'src/backend/db/parameterSetRepo.php, src/backend/api/index.php, src/backend/engine/nae.php, src/backend/engine/case.php, src/backend/data/parameters.php, tests/backend/http_api_test.php',
  tests_to_do = 'Backend (done): 14 new HTTP tests, full save/list/get/activate/rollback cycle verified end-to-end including actual calculation-output change. Frontend (not started): AdminParametersScreen.tsx -- an editor UI for the scalar/small-object sections (naeCoefficients, rounding, reportWritingPercent, aggregateFactorCaps, extrapolation, stage1Stage2Split, stageDayCoefficients, surveillanceCoefficients, samplingCoefficients, validationBounds) plus at minimum a read-only formatted view of the larger tabular sections (iafDurationTables, factorCatalogue, synergyGrid, naceTable) -- editing those tables is a further follow-up, not this same UI pass. A version-history view (list + view-only + activate/rollback) using GET .../versions and POST .../activate. Once built: live click-through, same standing gap as every other frontend feature in this project.',
  comments = 'Backend built and fully HTTP-test-verified 2026-09-15 (fifty-ninth session): 131/131 (117 previous + 14 new), 24/24 smoke, migrate 23/23, hygiene 4/4. Frontend UI not started -- this item stays open/in_progress. Whether to go further than numeric-parameter editing into actual formula/operation editability (a general expression engine) is an open design question flagged to Mahdi, not assumed -- see this migration''s header for the full reasoning.'
WHERE code = 'FEAT-008';

INSERT INTO tracker_updates (item_code, done, next)
VALUES (
  'FEAT-008',
  'Surveyed all 9 engine/*.php files (639 lines total) for hardcoded business-rule numbers not already sourced from the parameter_sets-backed $params array passed through the whole engine. Found exactly one gap: engine/nae.php''s 0.75 repetitive-task discount and /4 indirect-staff divisor. Promoted both into a new naeCoefficients section (data/parameters.php for fresh seeds; engine/nae.php reads $params[\'naeCoefficients\'][...] with ?? fallbacks to the exact original values, so this is purely additive -- zero behavior change until an admin edits one). Threaded $params through calculateNae()''s call sites in case.php and the standalone POST /nae route. Built the full admin API on top of the pre-existing parameterSetRepo.php: listParameterSetVersions()/getParameterSetById()/activateParameterSetVersion()/saveNewParameterSetVersion() (new repo functions) wired into 5 new routes (GET /admin/parameters[/versions[/:id]], PUT /admin/parameters, POST /admin/parameters/activate), all gated behind the existing manage_parameters permission + CSRF on mutations. saveNewParameterSetVersion() always assigns id/version/createdAt itself (never trusts client-supplied values for those) and requires a non-empty changeNote, matching this project''s own accreditation-defensibility convention (factors.php''s mandatory justification text is the precedent). 14 new HTTP tests: full auth/CSRF gating, a version-history list, fetch-by-id + 404, and -- the important end-to-end proof, not just a data-shape check -- an actual save-edit-activate cycle where a real /nae calculation''s output changes to match the edited coefficient, then a rollback-and-reverify confirming the original output returns. 131/131 total, 24/24 smoke, migrate 23/23, hygiene 4/4.',
  'Frontend AdminParametersScreen.tsx: scalar/small-object sections as a real form editor (naeCoefficients, rounding, reportWritingPercent, aggregateFactorCaps, extrapolation, stage1Stage2Split, stageDayCoefficients, surveillanceCoefficients, samplingCoefficients, validationBounds), the larger tabular sections (iafDurationTables, factorCatalogue, synergyGrid, naceTable) as read-only formatted views in this same first pass (editing those is a further follow-up), plus a version-history list with view/rollback using the routes already built. Separately, flag to Mahdi: does "all hardcoded formulas... numbers, operations, steps" mean only the numbers (now covered) or does he want the operations/control-flow themselves made editable too (a much larger, higher-risk expression-engine undertaking) -- do not assume the broader scope without his explicit confirmation given this system''s compliance stakes. After FEAT-008''s frontend: FEAT-001, FEAT-009 by the tracker''s own priority order, then DEBT-002/003/004.'
);
