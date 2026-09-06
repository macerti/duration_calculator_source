-- Audit Duration Engine — FEAT-006: in-app admin annotation/comment tool
-- Migration: 003_add_annotations
-- Created: 2026-09-06
-- Author: Claude (dev session, 2026-09-06, thirty-fourth session)
--
-- What this migration does:
-- - Creates `annotations` (an admin-pinned, timestamped, app-version-stamped
--   comment anchored to an {x,y} position and, where resolvable, a specific
--   UI element reference — see docs/ROADMAP.md item 10 for the full spec)
-- - Seeds a new `manage_annotations` permission and grants it to the
--   `administrateur` role only (this is an admin-only tool per the
--   original request; other roles do not get it by default, same as every
--   other admin-only permission — an admin can grant it to another role
--   later via the existing AdminRolesScreen, no code change needed for that)
--
-- Related: docs/ROADMAP.md item 10 (FEAT-006), docs/DEV_STATUS.md
-- 2026-09-06 thirty-fourth-session entry.
--
-- Both statements below are brand-new (CREATE TABLE IF NOT EXISTS / INSERT
-- IGNORE), exactly like 002_add_auth_and_rbac.sql's own new-table additions —
-- no information_schema PREPARE/EXECUTE guard pattern is needed here since
-- nothing pre-existing is being altered.

-- =====================================================================
-- annotations — admin-pinned in-app comments (FEAT-006)
-- =====================================================================
CREATE TABLE IF NOT EXISTS annotations (
  id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  -- Screen/route name the comment was made on (frontend-supplied, free text
  -- — this app does not have a fixed enum of screen names anywhere else,
  -- see App.tsx's Stack.Navigator route names for the values in practice).
  screen VARCHAR(150) NOT NULL,
  -- Best-effort reference to the specific UI element under the pointer/
  -- touch at capture time (a testID/data-testid where one could be
  -- resolved). NULL is expected and fine — see ROADMAP.md's "Element-
  -- reference strategy" for why this is opportunistic, not exhaustive.
  element_ref VARCHAR(150) NULL,
  -- Raw capture position. DECIMAL, not INT: web capture coordinates are
  -- sub-pixel-accurate (event.clientX/Y can be fractional after CSS
  -- scaling), and there is no reason to truncate that precision away.
  x DECIMAL(10,2) NOT NULL,
  y DECIMAL(10,2) NOT NULL,
  comment TEXT NOT NULL,
  -- The app version shown in this app's own FEAT-003 version footer at
  -- capture time (single source of truth reused, not a second hard-coded
  -- version string — see ROADMAP.md item 10's Required behavior).
  app_version VARCHAR(30) NOT NULL,
  created_by INT UNSIGNED NOT NULL,
  status ENUM('open','actioned','dismissed') NOT NULL DEFAULT 'open',
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  KEY idx_annotations_status (status),
  KEY idx_annotations_created_by (created_by),
  -- ON DELETE CASCADE: matches this codebase's existing pattern for rows
  -- owned by a specific user (e.g. user_identities, *_tokens in
  -- 002_add_auth_and_rbac.sql) — deleting a user cleans up their own
  -- annotations rather than leaving orphaned rows or blocking the delete.
  CONSTRAINT fk_annotations_created_by FOREIGN KEY (created_by) REFERENCES users(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- =====================================================================
-- Seed the manage_annotations permission and grant it to administrateur
-- only (admin-only tool, per the original request — see ROADMAP.md item
-- 10's Required behavior for why this is scoped to administrateur alone
-- rather than joined to every role the way the original 002 migration's
-- "administrateur: everything" wildcard grant would otherwise imply for
-- future permissions too — that wildcard only ever ran once, at 002's own
-- migration time, so it does not retroactively cover permissions added
-- later; every subsequent permission has to be explicitly granted here).
-- =====================================================================
INSERT IGNORE INTO permissions (key_name, label, description) VALUES
  ('manage_annotations', 'Gérer les annotations', 'Ajouter, consulter, traiter et exporter les commentaires épinglés dans l''application.');

INSERT IGNORE INTO role_permissions (role_id, permission_id)
SELECT r.id, p.id FROM roles r JOIN permissions p ON p.key_name = 'manage_annotations'
WHERE r.name = 'administrateur';
