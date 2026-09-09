-- Audit Duration Engine -- seed a tracker_items row for FEAT-010 itself
-- (the bug/feature/tech-debt tracker feature), completing its own
-- self-reference now that the feature has a working admin UI.
-- Migration: 006_seed_feat010_self
-- Created: 2026-09-08
-- Author: Claude (dev session, 2026-09-08, forty-fourth session)
--
-- Why this exists: migration 005 seeded the tracker's actual backlog
-- (FEAT-006, DEBT-001-004, BUG-051/052, FEAT-001/002/004/007/008/009) but
-- deliberately left FEAT-010 (the tracker itself) unseeded -- it couldn't
-- meaningfully track its own progress before it had a UI to view/update
-- that progress in. The fortieth through forty-third sessions built the
-- backend routes, tests, and client plumbing; the forty-fourth session
-- wrote AdminTrackerScreen.tsx, closing the loop. This migration is that
-- session's own hand-off item 1: add the row via a migration rather than
-- the live API, since a live-API attempt that same session found that a
-- second registrant on a DB that already has an active administrateur
-- does not auto-bootstrap as admin (a real rule in userRepo.php's
-- countActiveUsersWithRole(), not a bug) -- a migration sidesteps that
-- auth path entirely and is idempotent/reviewable like every other seed.
--
-- INSERT IGNORE, matching 005's own convention: idempotent, safe to
-- re-run, non-destructive of any edit an admin has since made via the UI.

INSERT IGNORE INTO tracker_items
  (code, type, title, user_description, technical_description, status, priority, dependencies, tests_to_do, comments)
VALUES
  ('FEAT-010', 'feature', 'Bug/feature/tech-debt tracker (DB-backed, replacing BUGLOG.md/ROADMAP.md/DEV_STATUS.md for progress tracking)', 'Replace day-to-day bug/feature status tracking with database rows an admin can query/filter/update from a UI, keeping the markdown files only for dev-to-dev narrative hand-off, not progress tracking.', 'Schema: tracker_items (code as PK, e.g. BUG-050/FEAT-007; type; title; user_description vs dev-filled technical_description; status [open/in_progress/fixed_unverified/verified/closed]; priority; dependencies; tests_to_do; comments) plus append-only tracker_updates history (item_code FK, done, next). Backend: trackerRepo.php full CRUD data layer, 7 routes under /admin/tracker/* gated behind manage_tracker + CSRF, mirroring /admin/annotations. Frontend: useAdminApi.ts TrackerItem/TrackerUpdate types + 7 client methods, AdminTrackerScreen.tsx (list with status/type/priority filters, detail panel with update history, inline create, log-an-update form, two-tap delete), wired into App.tsx and ProfileScreen.tsx behind manage_tracker. Deliberately uses maxWidth=1100, not AdminAnnotationsScreen.tsx''s narrower 800, per DEBT-002''s own note not to repeat that layout mistake on a new screen.', 'fixed_unverified', 'p1', 'trackerRepo.php, api/index.php (tracker routes), useAdminApi.ts, AdminTrackerScreen.tsx, App.tsx, ProfileScreen.tsx', 'Live click-through on a real device/browser: create an item, log an update, edit status/priority, filter by each of the three pickers, two-tap delete with confirm. Same standing sandbox limitation as every other frontend feature in this project -- never yet verified live.', 'Backend routes + 82/82 HTTP-tested (forty-first session). Frontend screen built and build-verified -- tsc clean, expo export 559 modules, make build-deploy 4/4, check-repo-hygiene.sh 4/4 (forty-fourth session). Needs a real live click-through from Mahdi before this can be called closed, same as FEAT-006.');

INSERT IGNORE INTO tracker_updates (item_code, done, next)
VALUES
  ('FEAT-010', 'Full history: proposed by Mahdi 2026-09-07 (thirty-eighth session, schema-only migration 004). Schema finalized and migrated same session. Data layer (trackerRepo.php) written thirty-ninth/fortieth session. Routes wired + 17 HTTP tests added forty-first session (82/82). Frontend baseline re-confirmed + reference files read forty-second session. Client-side plumbing (useAdminApi.ts types/methods) added forty-third session. AdminTrackerScreen.tsx written, wired into App.tsx/ProfileScreen.tsx, and fully build-verified forty-fourth session (559 modules, make build-deploy 4/4, check-repo-hygiene.sh 4/4) -- this migration seeds the feature''s own tracker row, closing that session''s hand-off item 1.', 'Get a real live click-through from Mahdi confirming create/log-update/edit/filter/delete all work end-to-end before calling this verified, same as FEAT-006''s own remaining gap.');
