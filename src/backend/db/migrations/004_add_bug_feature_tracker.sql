-- Audit Duration Engine — bug/feature tracker: replace BUGLOG.md/ROADMAP.md's
-- growing-file-per-project approach with rows an admin can actually query,
-- filter, and update from a UI instead of re-reading a 236KB/56KB markdown
-- file top to bottom to find current state.
-- Migration: 004_add_bug_feature_tracker
-- Created: 2026-09-07
-- Author: Claude (dev session, 2026-09-07, thirty-eighth session)
--
-- What this migration does:
-- - Creates `tracker_items` (one row per bug/feature/tech-debt item — the
--   "what is it, what state is it in" table)
-- - Creates `tracker_updates` (append-only history of what was done and
--   what's expected next, one row per logged update — the "what happened,
--   in order" table, kept separate so tracker_items doesn't accumulate an
--   ever-growing text blob the way BUGLOG.md's per-bug sections do today)
-- - Seeds a new `manage_tracker` permission and grants it to the
--   `administrateur` role only, same admin-only pattern as
--   003_add_annotations.sql's `manage_annotations` (an admin can extend
--   this to another role later via AdminRolesScreen — no code/migration
--   change needed for that)
--
-- Schema-only, this migration: no backend API, no admin UI screen yet.
-- This is deliberate — Mahdi asked for the data model locked and committed
-- first, with the API/UI to follow starting from this file next session.
-- No ROADMAP.md item number assigned yet; add one when the API/UI work
-- starts, the way FEAT-006 (item 10) preceded its own 003 migration.
--
-- Design decisions from this session's chat, in case a future session
-- (human or AI) wonders why the shape is what it is:
--
-- 1. `code` (e.g. `BUG-050`, `FEAT-007`, `DEBT-003`) is the PRIMARY KEY of
--    tracker_items — not a separate surrogate `id`. Every other table in
--    this codebase (users, annotations, etc.) uses a surrogate INT id with
--    a separate UNIQUE constraint on any human-readable field, but that
--    pattern exists there to protect against a natural key changing (an
--    email can be edited). `code` is assigned once, at creation, and never
--    edited — it's already how this project refers to every item
--    everywhere (commit messages, BUGLOG.md headings, this very chat) — so
--    a surrogate id would just be a second identifier nothing ever uses,
--    plus a redundant UNIQUE index doing the same job as the PK already
--    would. tracker_updates.item_code below references this directly.
--
-- 2. `type` is VARCHAR(20), not ENUM. Unlike `status` (a genuinely closed
--    set — see point 3), the set of item types is expected to grow: ROADMAP
--    items 6/7 are tech-debt candidates that don't cleanly fit "bug" or
--    "feature" today. VARCHAR means adding `techdebt`, or anything else
--    later, is an INSERT, not an ALTER TABLE + migration.
--
-- 3. `status` IS an ENUM, deliberately unlike `type` — this set is closed
--    by design (open / in_progress / fixed_unverified / verified / closed),
--    matches exactly what was agreed in chat, and a closed set is exactly
--    what ENUM is for: it rejects a typo'd status at the database layer
--    instead of silently storing a sixth value nothing filters for.
--
-- 4. Three free-text fields that look similar but answer different
--    questions, per this session's chat:
--      - `tests_to_do`    — verification steps specifically: what to run,
--                           what result to expect (mirrors this project's
--                           own "an unrun test is an unrun test" rule).
--      - `comments`       — actual dev work still outstanding (code not
--                           yet written). Overwritten as work closes it
--                           out — this is the live "what's left" field,
--                           normally refreshed from tracker_updates.next
--                           (see point 6) each time an update is logged.
--      - `dependencies`   — function/file names this item's fix touches or
--                           requires, as plain text (e.g. "annotationRepo.php,
--                           validateOrigin()") — not a foreign key to other
--                           tracker_items rows. A real FK here buys
--                           referential integrity this project has no use
--                           for at its current scale/team-size (one admin),
--                           at the cost of a join every read; plain text
--                           stays exactly as readable and is zero-friction
--                           to write from either a human or an AI dev
--                           session.
--
-- 5. `user_description` vs `technical_description` — kept as two separate
--    columns per Mahdi's original request: the reporter's own words go in
--    the first and are never edited by a dev; the second is dev-filled
--    (root cause, approach, anything technical) and grows over time. This
--    mirrors BUGLOG.md's existing convention of a bug's user-facing
--    description staying intact above the dev's own added detail.
--
-- 6. `tracker_updates` is a second table, not a fourth tracker_items
--    column, specifically so history is never lost. Each row is one
--    logged update: `done` (what happened — LONGTEXT, since some existing
--    BUGLOG.md entries, e.g. BUG-047/048, would exceed TEXT's 64KB cap if
--    they'd been rows instead of markdown sections) and `next` (what was
--    expected to happen after this — frozen at write time, never edited
--    after the fact, which is what makes it a real trail: a first fix
--    that looked right and later turned out wrong stays visible in
--    tracker_updates exactly as it was believed at the time, the same
--    story BUGLOG.md's own dated entries already tell in prose). This
--    table is append-only by convention — insert only, no UPDATE, no
--    DELETE outside of the item's own ON DELETE CASCADE.
--
-- 7. tracker_updates.item_code is a real foreign key to
--    tracker_items.code (not tracker_items.id, since there is no
--    surrogate id — see point 1), with ON DELETE CASCADE (deleting an
--    item cleans up its own history, same pattern as every user-owned
--    row elsewhere in this codebase) and ON UPDATE CASCADE (belt-and-
--    suspenders only — codes are never edited in practice per point 1,
--    but this means the constraint can't silently break if that
--    ever changes).
--
-- Both tables below are brand-new (CREATE TABLE IF NOT EXISTS / INSERT
-- IGNORE), exactly like 002_add_auth_and_rbac.sql's and
-- 003_add_annotations.sql's own new-table additions — no
-- information_schema PREPARE/EXECUTE guard pattern is needed since
-- nothing pre-existing is being altered.

-- =====================================================================
-- tracker_items — one row per bug/feature/tech-debt item
-- =====================================================================
CREATE TABLE IF NOT EXISTS tracker_items (
  code VARCHAR(20) NOT NULL,
  type VARCHAR(20) NOT NULL,
  title VARCHAR(200) NOT NULL,
  -- The reporter's own words. Never rewritten by a dev — see point 5 above.
  user_description TEXT NULL,
  -- Dev-filled: root cause, approach, anything technical. Grows over time.
  technical_description TEXT NULL,
  status ENUM('open','in_progress','fixed_unverified','verified','closed')
    NOT NULL DEFAULT 'open',
  priority ENUM('p0','p1','p2','p3') NULL,
  -- Function/file names touched or required, plain text — see point 4.
  dependencies TEXT NULL,
  -- Verification steps: what to run, what result to expect.
  tests_to_do TEXT NULL,
  -- Live "what's left" — overwritten, normally from the newest
  -- tracker_updates.next (see point 6). This is a TODO, not a log.
  comments TEXT NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (code),
  KEY idx_tracker_items_status (status),
  KEY idx_tracker_items_type (type),
  KEY idx_tracker_items_priority (priority)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- =====================================================================
-- tracker_updates — append-only history: what happened, what's next
-- =====================================================================
CREATE TABLE IF NOT EXISTS tracker_updates (
  id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  item_code VARCHAR(20) NOT NULL,
  -- What happened, in this update. LONGTEXT — see point 6 on why TEXT's
  -- 64KB cap isn't safe to assume here.
  done LONGTEXT NOT NULL,
  -- What was expected to happen next, frozen at write time. NULL means
  -- nothing was left outstanding when this update was logged (e.g. the
  -- item was closed).
  next TEXT NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  KEY idx_tracker_updates_item_code (item_code),
  CONSTRAINT fk_tracker_updates_item_code FOREIGN KEY (item_code)
    REFERENCES tracker_items(code) ON DELETE CASCADE ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- =====================================================================
-- Seed the manage_tracker permission and grant it to administrateur only
-- (admin-only tool, same reasoning as 003_add_annotations.sql's own
-- manage_annotations grant — see that migration's comment for why the
-- 002 migration's "administrateur: everything" wildcard doesn't
-- retroactively cover permissions added later, and every one since has
-- had to be granted explicitly here).
-- =====================================================================
INSERT IGNORE INTO permissions (key_name, label, description) VALUES
  ('manage_tracker', 'Gérer le suivi bugs/fonctionnalités', 'Créer, consulter et mettre à jour les bugs, fonctionnalités et dette technique suivis en base.');

INSERT IGNORE INTO role_permissions (role_id, permission_id)
SELECT r.id, p.id FROM roles r JOIN permissions p ON p.key_name = 'manage_tracker'
WHERE r.name = 'administrateur';
