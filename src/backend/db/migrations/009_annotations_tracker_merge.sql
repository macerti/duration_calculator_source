-- Audit Duration Engine — merge the in-app annotation tool (FEAT-006,
-- migration 003) into the bug/feature tracker (FEAT-010, migration 004),
-- per Mahdi's explicit 2026-09-10 request: "annotations are just
-- user_description of bugs and features so why have two lists — merge
-- them ... making user create an annotation directly in db then later
-- other dev fill null fields (complete the row with the necessary data)".
-- Migration: 009_annotations_tracker_merge
-- Created: 2026-09-10
-- Author: Claude (dev session, 2026-09-10, fiftieth session — design
-- written up the session before, in docs/DEV_STATUS.md's forty-ninth-
-- session entry; this migration implements that design as-is)
--
-- What this migration does:
-- 1. Adds annotation-capture columns to `tracker_items` (`screen`,
--    `element_ref`, `x`, `y`, `app_version`, `created_by`,
--    `source_annotation_id`) — all NULL-able, since a normal dev-created
--    bug/feature/tech-debt row has no on-screen capture position at all.
--    A row created through the in-app pin tool from now on populates
--    these plus `code`/`title`/`user_description`/`status='open'` and
--    leaves everything else (`technical_description`, `priority`,
--    `dependencies`, `tests_to_do`) NULL for a dev to fill in later —
--    exactly the workflow Mahdi asked for.
-- 2. One-time copies every row currently sitting in `annotations` into
--    `tracker_items` (`type='annotation'`), so historical pinned
--    comments show up in the one merged list going forward too.
--
-- What this migration deliberately does NOT do:
-- - Does NOT `DROP TABLE annotations` or delete any of its rows. This
--   sandbox has no access to the real production `annotations` table,
--   and the "first real live-annotation batch" already referenced in
--   migration 008's own history (archived into `BUG-050` from an
--   exported .md file, not deleted from the live table) means
--   production almost certainly still has old rows that this
--   migration's data-copy step below will re-copy as likely duplicates
--   of BUG-050's content. That is a known, accepted risk of this
--   migration, not an oversight — see the data-copy block's own comment
--   below for the mitigation (idempotent-by-source-id, so re-running
--   this migration can never duplicate its own output, but it cannot
--   detect a duplicate that predates it, i.e. BUG-050). Recommend a
--   human spot-check of `tracker_items WHERE type='annotation'` against
--   `BUG-050` on the real production DB after this deploys, and manually
--   closing/deleting any confirmed duplicate found there — deliberately
--   left as a human step, not automated, since guessing wrong here
--   deletes real reported feedback.
-- - Does NOT remove the `manage_annotations` permission, or the
--   `annotations` table's own GET/PUT/DELETE/export routes in
--   api/index.php — those stay working, unlinked from any UI, same
--   "leave in place, don't delete" precedent this codebase already uses
--   for the Google SSO button (see docs/DEV_STATUS.md). Only the
--   *create* path changes (AnnotationCapture.tsx now calls the new
--   POST /admin/tracker/annotations route instead of the old
--   POST /admin/annotations — see trackerRepo.php's
--   createAnnotationTrackerItem() and this session's DEV_STATUS.md
--   entry for the full reasoning).
--
-- Design decisions worth a future session knowing about:
--
-- 1. `source_annotation_id` is a plain INT pointer to `annotations.id`,
--    not a real foreign key — deliberately, mirroring migration 004's
--    own `dependencies`-as-plain-text-not-FK precedent (point 4 there):
--    `annotations` is being deprecated, not kept authoritative, so a
--    real FK would add a constraint this project has no use for at its
--    current scale, for a table that may itself be dropped by a later,
--    human-confirmed migration once production is spot-checked (see
--    above). It exists purely so the data-copy step below can tell
--    "already migrated" from "not yet migrated" without guessing from
--    content.
--
-- 2. `created_by` on `tracker_items` is `ON DELETE SET NULL`, NOT
--    `ON DELETE CASCADE` like `annotations.created_by` (migration 003).
--    This is a deliberate policy difference, not an oversight: an
--    annotation was a personal, disposable pinned note (deleting its
--    author's account deleting it too was fine), but a `tracker_items`
--    row is now permanent institutional record of a bug/feature/tech-
--    debt item — the same way a manually-created `BUG-*`/`FEAT-*` row
--    survives regardless of who's still an active user. Losing the
--    *reporter link* when a user is deleted is fine; losing the *report
--    itself* would not be.
--
-- 3. Status mapping for the data copy (`annotations.status` is
--    open/actioned/dismissed; `tracker_items.status` is a 5-value enum)
--    is a judgment call, stated plainly rather than silently picked:
--    `open` → `open` (unambiguous), `actioned` → `in_progress` (someone
--    looked at it and did something, but there's no record here of
--    whether that something is finished), `dismissed` → `closed`
--    (nothing more to do) — semantically not quite the same as
--    "fixed and verified closed" for a real bug, but the closest
--    available fit in a 5-value enum for "an admin decided not to act
--    on this." A future session or Mahdi may want to revisit this
--    specific mapping; it is not treated as settled by this migration
--    existing.
--
-- 4. Title truncation for the copied rows mirrors migration 008's own
--    rule exactly (don't reinvent it): first 197 characters + "…" if the
--    comment is longer than tracker_items.title's 200-char cap, full text
--    either way preserved in `user_description` (TEXT, no cap).
--
-- Both the schema-extension guards below (idempotent, information_schema-
-- checked, `'DO 0'` no-op placeholder — never `'SELECT 1'`, see
-- db/migrations/README.md's own troubleshooting section and BUG-042/
-- BUG-043's history in docs/BUGLOG.md for exactly why `'SELECT 1'` as a
-- PREPARE/EXECUTE no-op is a real, previously-hit bug, not a style
-- nitpick) and the data-copy step (idempotent via a NOT EXISTS check on
-- the new `source_annotation_id` column) are safe to leave in the file
-- even though the migration framework itself only ever runs a given
-- migration once per database.

-- =====================================================================
-- 1. Schema: add annotation-capture columns to tracker_items
-- =====================================================================

SET @col_exists := (
  SELECT COUNT(*) FROM information_schema.COLUMNS
  WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'tracker_items' AND COLUMN_NAME = 'screen'
);
SET @sql := IF(@col_exists = 0,
  'ALTER TABLE tracker_items ADD COLUMN screen VARCHAR(150) NULL AFTER comments',
  'DO 0'
);
PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

SET @col_exists := (
  SELECT COUNT(*) FROM information_schema.COLUMNS
  WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'tracker_items' AND COLUMN_NAME = 'element_ref'
);
SET @sql := IF(@col_exists = 0,
  'ALTER TABLE tracker_items ADD COLUMN element_ref VARCHAR(150) NULL AFTER screen',
  'DO 0'
);
PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

SET @col_exists := (
  SELECT COUNT(*) FROM information_schema.COLUMNS
  WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'tracker_items' AND COLUMN_NAME = 'x'
);
SET @sql := IF(@col_exists = 0,
  'ALTER TABLE tracker_items ADD COLUMN x DECIMAL(10,2) NULL AFTER element_ref',
  'DO 0'
);
PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

SET @col_exists := (
  SELECT COUNT(*) FROM information_schema.COLUMNS
  WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'tracker_items' AND COLUMN_NAME = 'y'
);
SET @sql := IF(@col_exists = 0,
  'ALTER TABLE tracker_items ADD COLUMN y DECIMAL(10,2) NULL AFTER x',
  'DO 0'
);
PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

SET @col_exists := (
  SELECT COUNT(*) FROM information_schema.COLUMNS
  WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'tracker_items' AND COLUMN_NAME = 'app_version'
);
SET @sql := IF(@col_exists = 0,
  'ALTER TABLE tracker_items ADD COLUMN app_version VARCHAR(30) NULL AFTER y',
  'DO 0'
);
PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

SET @col_exists := (
  SELECT COUNT(*) FROM information_schema.COLUMNS
  WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'tracker_items' AND COLUMN_NAME = 'created_by'
);
SET @sql := IF(@col_exists = 0,
  'ALTER TABLE tracker_items ADD COLUMN created_by INT UNSIGNED NULL AFTER app_version',
  'DO 0'
);
PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

SET @col_exists := (
  SELECT COUNT(*) FROM information_schema.COLUMNS
  WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'tracker_items' AND COLUMN_NAME = 'source_annotation_id'
);
SET @sql := IF(@col_exists = 0,
  'ALTER TABLE tracker_items ADD COLUMN source_annotation_id INT UNSIGNED NULL AFTER created_by',
  'DO 0'
);
PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

-- created_by FK: ON DELETE SET NULL, not CASCADE — see design note 2 above.
SET @fk_exists := (
  SELECT COUNT(*) FROM information_schema.KEY_COLUMN_USAGE
  WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'tracker_items'
    AND COLUMN_NAME = 'created_by' AND REFERENCED_TABLE_NAME = 'users'
);
SET @sql_fk := IF(@fk_exists = 0,
  'ALTER TABLE tracker_items ADD CONSTRAINT fk_tracker_items_created_by FOREIGN KEY (created_by) REFERENCES users(id) ON DELETE SET NULL',
  'DO 0'
);
PREPARE stmt_fk FROM @sql_fk;
EXECUTE stmt_fk;
DEALLOCATE PREPARE stmt_fk;

-- =====================================================================
-- 2. One-time data copy: annotations -> tracker_items (type='annotation')
-- Idempotent via source_annotation_id — see design note 1 above.
-- =====================================================================
-- IMPORTANT: ROW_NUMBER() must be computed over ALL of `annotations`
-- (ordered by id) *before* the NOT-EXISTS filter below is applied, not
-- after — SQL evaluates WHERE before window functions, so numbering
-- inside the filtered query directly would renumber from 1 every time
-- only a handful of rows are still unmigrated, colliding with codes
-- already assigned on a prior run. Verified this the hard way in this
-- session: manually re-ran this file after adding one new `annotations`
-- row on top of 3 already-migrated ones, and it tried to re-insert
-- 'ANN-001' — caught before push, fixed by numbering in the derived
-- table below (unfiltered) and filtering in the outer query instead.
INSERT INTO tracker_items (
  code, type, title, user_description, status,
  screen, element_ref, x, y, app_version, created_by, source_annotation_id,
  created_at, updated_at
)
SELECT
  CONCAT('ANN-', LPAD(a.rn, 3, '0')),
  'annotation',
  CASE WHEN CHAR_LENGTH(a.comment) > 200 THEN CONCAT(LEFT(a.comment, 197), '...') ELSE a.comment END,
  a.comment,
  CASE a.status WHEN 'open' THEN 'open' WHEN 'actioned' THEN 'in_progress' WHEN 'dismissed' THEN 'closed' END,
  a.screen, a.element_ref, a.x, a.y, a.app_version, a.created_by, a.id,
  a.created_at, a.updated_at
FROM (
  SELECT id, screen, element_ref, x, y, comment, app_version, created_by, status, created_at, updated_at,
         ROW_NUMBER() OVER (ORDER BY id) AS rn
  FROM annotations
) a
WHERE NOT EXISTS (
  SELECT 1 FROM tracker_items ti WHERE ti.source_annotation_id = a.id
);
