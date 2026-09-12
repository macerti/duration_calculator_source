-- Audit Duration Engine — FEAT-008 (slice 1 of 2): Dossier Reference Codification
-- Migration: 011_dossier_ref_codification
-- Created: 2026-09-11
-- Author: Claude (dev session, 2026-09-11, fifty-third session)
--
-- What this migration does:
-- - Creates `dossier_ref_config`: a single-row settings table for the
--   configurable automatic calculation-reference-number generator
--   (docs/ROADMAP.md "Ideas / not yet requested (parked)" ->
--   "Parameter admin UI" -> dossier reference codification, elevated to
--   P1 as FEAT-008 by Mahdi/the PO). Today `dossierRef` is a free-text
--   field typed by hand in CalculationWizardScreen.tsx (falling back to
--   `DRAFT-<timestamp>` if left blank) — this table is the config an
--   admin will edit (via a follow-up UI slice, not built yet — see
--   docs/DEV_STATUS.md fifty-third-session hand-off) to generate that
--   value automatically instead: `prefix + date components + an
--   incremental counter + suffix`.
-- - Seeds exactly one row (id=1), auto-generation DISABLED by default
--   (`enabled = 0`) so this migration is purely additive: every existing
--   deployment keeps today's manual-entry behavior verbatim until an
--   admin explicitly turns this on from the (future) settings screen.
-- - Seeds a new `manage_parameters` permission and grants it to the
--   `administrateur` role only — same scoping rationale as
--   `manage_annotations` (migration 003) and `manage_tracker` (migration
--   004): a brand-new admin-only capability area, not folded into an
--   existing permission, because editing calculation parameters/
--   numbering (this migration, and the parameter-catalogue editing that
--   is FEAT-008's still-unbuilt slice 2) is a materially different,
--   higher-stakes capability than the tracker/annotations/session-log
--   permissions already granted together — an org may reasonably want
--   to grant "manage the bug tracker" without also granting "change how
--   every future audit calculation is numbered or what the IAF tables
--   say". Not reusing `manage_tracker` here (unlike migration 007's
--   deliberate reuse for session_log) for exactly that reason.
--
-- Design notes for `generateNextDossierRef()` (implemented in
-- db/dossierRefRepo.php, not in this migration):
-- - `date_format` is a PHP date() format string (e.g. 'Y', 'Y-m', 'Ymd').
--   Empty string means "no date component in the generated reference".
-- - `reset_period` controls when `next_counter` resets to 1, INDEPENDENT
--   of what `date_format` displays: 'yearly' resets on a date('Y')
--   change, 'monthly' on a date('Y-m') change, 'never' means the counter
--   climbs forever regardless of date. `last_period_key` stores whichever
--   of those two strings was current the last time a reference was
--   generated, so the repo can detect the rollover without recomputing
--   history.
-- - The actual increment must run inside a transaction with
--   `SELECT ... FOR UPDATE` on this single row (see dossierRefRepo.php)
--   to stay correct under concurrent requests — this migration only
--   creates the storage, not that locking, which lives in application
--   code like every other transactional write in this codebase
--   (parameterSetRepo.php's saveParameterSet() is the existing pattern).
--
-- This table's own new-table CREATE is already fully idempotent
-- (IF NOT EXISTS) — no information_schema PREPARE/EXECUTE guard pattern
-- is needed, same as migrations 003/004/007 before it.

-- =====================================================================
-- dossier_ref_config — single-row settings for automatic dossierRef
-- generation (FEAT-008 slice 1)
-- =====================================================================
CREATE TABLE IF NOT EXISTS dossier_ref_config (
  -- Single settings row by convention (CHECK id = 1), same pattern as
  -- this codebase's other "exactly one active/current row" tables
  -- (parameter_sets uses is_active instead since it keeps full version
  -- history; this table has no history to keep, so a fixed id is simpler).
  id              TINYINT UNSIGNED NOT NULL PRIMARY KEY DEFAULT 1,
  enabled         TINYINT(1)       NOT NULL DEFAULT 0,
  prefix          VARCHAR(32)      NOT NULL DEFAULT '',
  suffix          VARCHAR(32)      NOT NULL DEFAULT '',
  -- PHP date() format tokens; '' disables the date component entirely.
  date_format     VARCHAR(32)      NOT NULL DEFAULT 'Y',
  -- Zero-padding width for the incremental counter (e.g. 4 -> "0007").
  counter_digits  TINYINT UNSIGNED NOT NULL DEFAULT 4,
  reset_period    ENUM('never','yearly','monthly') NOT NULL DEFAULT 'yearly',
  next_counter    INT UNSIGNED     NOT NULL DEFAULT 1,
  -- date('Y') or date('Y-m') as of the last generated reference,
  -- depending on reset_period — NULL until the first reference is ever
  -- generated. Used only to detect a period rollover; not shown to users.
  last_period_key VARCHAR(16)      NULL,
  updated_at      DATETIME         NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  CONSTRAINT chk_dossier_ref_config_single_row CHECK (id = 1)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

INSERT IGNORE INTO dossier_ref_config
  (id, enabled, prefix, suffix, date_format, counter_digits, reset_period, next_counter, last_period_key)
VALUES
  (1, 0, 'DC-', '', 'Y', 4, 'yearly', 1, NULL);

-- =====================================================================
-- Seed the manage_parameters permission and grant it to administrateur
-- only (see rationale above). Not wildcard-inherited by future roles —
-- migration 002's "administrateur: everything" JOIN only ever ran once,
-- at that migration's own time (see migration 003's identical note).
-- =====================================================================
INSERT IGNORE INTO permissions (key_name, label, description) VALUES
  ('manage_parameters', 'Gérer les paramètres de calcul', 'Consulter et modifier la codification des références de dossier, et (à terme) les tables IAF (MD5/MD1/MD11) et le catalogue de facteurs.');

INSERT IGNORE INTO role_permissions (role_id, permission_id)
SELECT r.id, p.id FROM roles r JOIN permissions p ON p.key_name = 'manage_parameters'
WHERE r.name = 'administrateur';
