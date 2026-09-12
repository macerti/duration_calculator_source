-- Audit Duration Engine -- update FEAT-008's tracker_items row now that
-- slice 1 (dossier reference codification, backend only) has been built
-- and fully HTTP-test-verified.
-- Migration: 012_feat008_slice1_status
-- Created: 2026-09-11
-- Author: Claude (dev session, 2026-09-11, fifty-third session)
--
-- Why this exists: FEAT-008 ("Parameter Admin UI & Dossier Reference
-- Codification") was next in the tracker's own p1 priority queue per the
-- fifty-second session's hand-off. It bundles two genuinely separable
-- pieces of work -- this session split it and built only the first:
--
-- 1. DONE this session: Dossier reference codification (migration 011 --
--    dossier_ref_config table, db/dossierRefRepo.php, GET/PUT
--    /admin/dossier-ref-config, POST /cases auto-generates dossierRef
--    when left blank and the feature is enabled). New manage_parameters
--    permission (not manage_tracker -- see migration 011's own header for
--    why this is a separate permission). 10 new HTTP tests, all passing
--    against a fresh DB (117/117 total, up from 107/107).
-- 2. NOT started: Parameter admin UI itself (editing IAF duration
--    tables/factor catalogue from a browser instead of PHP source +
--    reseeding). This is the larger, architecturally open half -- see
--    docs/DEV_STATUS.md's fifty-third-session entry for the specific
--    open questions (NAE formula editability in particular) a future
--    session needs to resolve before starting it. parameter_sets is
--    already fully data-driven/versioned (parameterSetRepo.php), so the
--    storage layer for slice 2 already exists; what's missing is purely
--    the admin-facing read/write API + UI surface on top of it.
--
-- Status is 'in_progress', not 'fixed_unverified' -- slice 1 alone is a
-- real, independently useful, fully tested backend capability, but the
-- tracker item as originally scoped (its own title names BOTH pieces)
-- is genuinely half-done, not built-pending-verification like FEAT-007's
-- single-piece scope was in migration 010.

UPDATE tracker_items
SET
  status = 'in_progress',
  technical_description = CONCAT(
    technical_description,
    ' -- SLICE 1 BUILT 2026-09-11 (fifty-third session): dossier reference ',
    'codification. Migration 011 (dossier_ref_config table + manage_parameters ',
    'permission), db/dossierRefRepo.php (config get/save + atomic ',
    'generateNextDossierRef() with SELECT...FOR UPDATE), GET/PUT ',
    '/admin/dossier-ref-config, and POST /cases now auto-generates dossierRef ',
    'when left blank and the config is enabled (disabled by default -- fully ',
    'backward compatible). Parameter admin UI (editing IAF/MD5/MD1/MD11 tables ',
    'and the factor catalogue from a browser) is NOT started -- see ',
    'docs/DEV_STATUS.md fifty-third-session entry for the open architectural ',
    'questions a future session needs to resolve first.'
  ),
  dependencies = 'src/backend/db/migrations/011_dossier_ref_codification.sql, src/backend/db/dossierRefRepo.php, src/backend/api/index.php, src/backend/tests/http_api_test.php',
  tests_to_do = 'Slice 1 (done): 10 new HTTP tests all passing, see tests_to_do history in tracker_updates. Slice 1 still needs a settings-screen UI (frontend, not built) before an admin can actually change the pattern outside raw API calls -- until then this is only reachable via direct HTTP requests. Slice 2 (not started): parameter admin UI -- resolve NAE formula editability / data-driven vs hardcoded engine parameters / auth-prerequisite questions (all still open, see docs/DEV_STATUS.md), then design + build the actual browser-based editor for IAF/MD5/MD1/MD11 tables and the factor catalogue.',
  comments = 'Slice 1 (dossier reference codification) built and fully HTTP-test-verified fifty-third session: 117/117 (107 previous baseline + 10 new), 24/24 smoke tests, migrations 12/12 on a fresh DB, scripts/check-repo-hygiene.sh 4/4. Slice 2 (parameter admin UI) not started -- this tracker item stays open/in_progress until both pieces are done, per its original combined scope.'
WHERE code = 'FEAT-008';

INSERT INTO tracker_updates (item_code, done, next)
VALUES (
  'FEAT-008',
  'Split FEAT-008 into two slices and built the first: dossier reference codification. New migration 011 (dossier_ref_config table, seeded disabled by default; new manage_parameters permission granted to administrateur only -- deliberately not reusing manage_tracker, see migration 011''s header for why). New db/dossierRefRepo.php: getDossierRefConfig()/saveDossierRefConfig() (partial update, never touches the counter) and generateNextDossierRef() (transactional, SELECT...FOR UPDATE, handles yearly/monthly/never counter-reset policies). Wired into api/index.php: GET/PUT /admin/dossier-ref-config, and POST /cases now calls generateNextDossierRef() when the caller leaves dossierRef blank AND the config is enabled -- otherwise completely unaffected (disabled by default, so every existing manual-entry deployment is unchanged). 10 new HTTP tests (config CRUD, CSRF/auth gating, previewSample pattern, two auto-generated refs never repeating, an explicit dossierRef never being overridden), all passing on a fresh DB: 117/117 total (up from 107/107), smoke_test.php still 24/24, migrate.php 12/12, check-repo-hygiene.sh 4/4. No frontend changes this session -- npx tsc --noEmit/expo export not re-run since nothing frontend-facing changed.',
  'Slice 2 (parameter admin UI) still fully open -- resolve the open architectural questions first (NAE formula editability, data-driven vs hardcoded engine parameters -- note parameter_sets is already versioned/data-driven via parameterSetRepo.php, so the storage half of that question may already be answered; confirm before assuming more work is needed there). Then design + build the actual browser editor for IAF/MD5/MD1/MD11 tables and the factor catalogue, gated behind the same manage_parameters permission this session added. Separately: slice 1 has no settings-screen UI yet either -- an admin can only change the numbering pattern via raw HTTP calls to /admin/dossier-ref-config right now; a small dedicated settings screen (or a section of a future combined parameter-admin screen) is a reasonable frontend-only follow-up on its own, independent of slice 2''s bigger open questions. After FEAT-008 (either or both remaining pieces): FEAT-001, FEAT-009 by the tracker''s own priority order, then DEBT-001/002(part 2)/003/004. BUG-051/052 still both blocked on Mahdi''s own decision/clarification, not on more dev investigation.'
);
