-- Audit Duration Engine -- FEAT-008 frontend (first pass) built: real
-- form editing for the scalar parameter sections, a version history
-- view with rollback, on top of the fifty-ninth session's backend.
-- Migration: 024_feat008_slice2_frontend_status
-- Created: 2026-09-15
-- Author: Claude (dev session, 2026-09-15, sixtieth session)

UPDATE tracker_items
SET
  status = 'fixed_unverified',
  technical_description = CONCAT(
    technical_description,
    ' -- FRONTEND BUILT 2026-09-15 (sixtieth session): AdminParametersScreen.tsx ',
    '(new), wired into App.tsx/ProfileScreen.tsx behind manage_parameters. Editable ',
    'form fields for naeCoefficients, reportWritingPercent, rounding.nearest, and ',
    'aggregateFactorCaps (the scalar sections this pass covers); every save creates ',
    'a new version via PUT /admin/parameters with a mandatory change note; a version ',
    'history list with one-tap rollback via POST /admin/parameters/activate. The ',
    'larger tabular sections (iafDurationTables, factorCatalogue, synergyGrid, ',
    'naceTable) are shown as read-only counts, not editable yet -- a dedicated ',
    'table editor for those is a separate, larger follow-up. tsc --noEmit clean, ',
    'expo export 564 modules, make build-deploy + check-deploy-artifact.sh 4/4, ',
    'backend baseline unchanged (131/131, 24/24 smoke, migrate 24/24, hygiene 4/4). ',
    'v5.7.0.'
  ),
  tests_to_do = 'Built and machine-verified (typecheck, build, deploy-artifact hygiene, full backend regression). Not yet: a live click-through by a human -- same standing gap as every other frontend feature in this project until Mahdi (or a future session acting on his behalf) actually clicks through it. Table editors for iafDurationTables/factorCatalogue/synergyGrid/naceTable remain a separate, unscoped follow-up.',
  comments = 'First frontend pass built and machine-verified 2026-09-15 (sixtieth session). status is fixed_unverified, not verified/closed, pending that live click-through -- this project''s standing convention for every frontend change. The item stays useful to keep open (not closed) even after that click-through, since the table-editor half remains a real, separate, larger piece of the original FEAT-008 scope.'
WHERE code = 'FEAT-008';

INSERT INTO tracker_updates (item_code, done, next)
VALUES (
  'FEAT-008',
  'Built AdminParametersScreen.tsx: real editable number/switch fields for naeCoefficients (the two coefficients promoted out of engine/nae.php last session), reportWritingPercent, rounding.nearest, and aggregateFactorCaps -- deliberately scoped to the scalar/small-object sections, not the whole parameter-set blob (see this session''s own header comment on the screen for exactly why the larger tables are read-only-count-only in this pass). One shared changeNote + save flow for all edited fields together (matches the backend''s whole-object PUT), a discard button, and a version-history list below with a one-tap "Activer cette version" rollback per non-active row. Wired into App.tsx (new route) and ProfileScreen.tsx (new button, manage_parameters-gated, same pattern as every other admin screen). New useAdminApi.ts types (ParameterSet, ParameterSetVersion) and 5 new client methods mirroring the 5 backend routes from last session. Verified: npx tsc --noEmit clean, npx expo export --platform web (564 modules), make build-deploy + check-deploy-artifact.sh (4/4), and the full backend suite unchanged (131/131 HTTP, 24/24 smoke, migrate 24/24, hygiene 4/4) to confirm no backend regression from a frontend-only session. Version bumped 5.6.0 -> 5.7.0 (y-bump: a real, user-reachable feature landed).',
  'Live click-through by Mahdi (or whoever next has access) -- standing gap, not started here. Table editor for iafDurationTables/factorCatalogue/synergyGrid/naceTable -- a real, separate, larger piece of work (needs its own UI design given the different shapes of each table) -- not scoped or started. Separately, still flagged and NOT assumed: whether "numbers, operations, steps" extends beyond numeric parameters into the formula operations themselves becoming editable (a much larger, higher-risk general-expression-engine undertaking) -- that is Mahdi''s call. After FEAT-008''s remaining piece (or in parallel, given it is now genuinely separable): FEAT-001, FEAT-009 by the tracker''s own priority order, then DEBT-002 (part 2)/003/004.'
);
