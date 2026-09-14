-- Audit Duration Engine -- close DEBT-005 ("ORIENTATIONS.md's 'five
-- standing files' logging section is stale") now that this session has
-- actually done the rewrite it called for, and gone further per Mahdi's
-- own direct instruction this session.
-- Migration: 021_close_debt005_log_unification
-- Created: 2026-09-13
-- Author: Claude (dev session, 2026-09-13, fifty-eighth session)

UPDATE tracker_items
SET
  status = 'fixed_unverified',
  comments = 'Resolved 2026-09-13 (fifty-eighth session), going further than this item''s own original scope: docs/DEV_STATUS.md and docs/BUGLOG.md were not just corrected in description but fully archived verbatim into session_log/tracker_items (migrations 018-020) and deleted, per Mahdi''s direct instruction to unify definitively. docs/ORIENTATIONS.md''s logging section rewritten to describe current practice: the database is the single source of truth for bugs/features/tech-debt/session-history, docs/TRACKER_SNAPSHOT.md is the auto-generated mirror, and CHANGELOG.md/ROADMAP.md/SECURITY.md/TEST_CHECKLIST.md remain (deliberately, with reasoning given) as the only markdown status files. CONTRIBUTING.md, README.md, src/backend/README.md, src/frontend/README.md/BUGLOG.md updated to match -- no remaining functional pointer in this repo tells a reader to open the two deleted files. status is fixed_unverified, not verified/closed, since (as with every other frontend/process change in this project) no live click-through or second-session confirmation has happened yet that the new pointers read clearly to someone starting genuinely fresh.'
WHERE code = 'DEBT-005';

INSERT INTO tracker_updates (item_code, done, next)
VALUES (
  'DEBT-005',
  'Archived docs/DEV_STATUS.md (56 dated sessions + front-matter, split mechanically on every top-level "## " header to avoid a lossy per-field re-parse -- same "mechanical body-capture" philosophy as migration 008) and docs/BUGLOG.md (verified byte-for-byte against tracker_items first -- 45/49 entries matched migration 008''s original transcription exactly, 4 had genuine post-008 additions synced via migration 019 before archiving) plus the stray SESSION_LOG_2026_09_03_21.md into session_log, then deleted all three source files. Rewrote docs/ORIENTATIONS.md''s "Logging" section to describe the database + docs/TRACKER_SNAPSHOT.md as the current mechanism, explicitly explaining why CHANGELOG.md/ROADMAP.md/SECURITY.md/TEST_CHECKLIST.md are kept rather than also archived (each has a distinct role with no DB equivalent yet). Updated every functional (non-historical) pointer to the two deleted files across CONTRIBUTING.md, README.md, src/backend/README.md, src/frontend/README.md, src/frontend/BUGLOG.md. scripts/check-repo-hygiene.sh confirmed still 4/4 (migrations 018/020''s historical path-name text inside archived prose did not trip the stale-path-reference check).',
  'None from this item specifically -- fully resolved pending only the standing "no live click-through" caveat every doc/process change in this project carries. If a future session wants CHANGELOG.md/ROADMAP.md/SECURITY.md/TEST_CHECKLIST.md unified into the database too, that is a new, separate, larger design decision (at minimum: new tables for security findings and test scenarios) -- flag it to Mahdi rather than assuming this session''s rewrite already covers it.'
);
