-- Audit Duration Engine -- new tracker_items for this session's own work:
-- the dev-export snapshot system (FEAT-012), and a docs-staleness finding
-- noticed while updating ORIENTATIONS.md (DEBT-005).
-- Migration: 014_dev_export_and_docs_debt
-- Created: 2026-09-12
-- Author: Claude (dev session, 2026-09-12, fifty-fourth session)

INSERT INTO tracker_items (
  code, type, title, user_description, technical_description, status,
  priority, dependencies, tests_to_do, comments
) VALUES (
  'FEAT-012',
  'feature',
  'Dev-export live tracker snapshot -- repo pull now carries live problems too',
  'Mahdi, live in chat: "how can we always allow AI developers when pulling the repo to obtain the problems in the db" -- after establishing that no AI sandbox can safely hold standing production DB credentials, and that this sandbox specifically cannot reach any external host on port 3306 or plain HTTPS to arbitrary domains at all.',
  'New GET /dev-export endpoint (api/index.php) -- read-only, shared-secret-gated (dev_export_secret in config.php, hash_equals-compared, same convention as the existing /migrate endpoint), rate-limited per IP. Returns JSON of tracker_items + tracker_updates + session_log only -- deliberately never clients/cases/sites/users, which is what makes exposing this safe. New .github/workflows/dev-export-snapshot.yml runs every 6 hours (plus workflow_dispatch), calls the endpoint with a DEV_EXPORT_SECRET repo secret, renders it through the new scripts/generate-tracker-snapshot.php into docs/TRACKER_SNAPSHOT.md (and the raw .json alongside it), and commits both to main if changed. ORIENTATIONS.md updated to tell future sessions to read this file at the start of a session.',
  'fixed_unverified',
  'p1',
  'api/index.php, config.example.php, scripts/generate-tracker-snapshot.php, .github/workflows/dev-export-snapshot.yml, docs/ORIENTATIONS.md',
  'Endpoint fully tested locally this session (unauthorized/wrong-secret/correct-secret paths, real JSON output, piped through the formatter script -- verified readable Markdown output). NOT YET verified: an actual scheduled run against the real production server, which needs two one-time manual steps first -- (1) set dev_export_secret in the live server config.php, (2) add the same value as this repo''s DEV_EXPORT_SECRET GitHub Actions secret. Until both are set, the workflow runs, logs a warning, and skips (does not fail CI).',
  'Built fifty-fourth session (2026-09-12), fully working in this sandbox against a local DB. Needs Mahdi to complete the two one-time secret-setup steps above before the first real scheduled run will produce anything -- flagged to him directly in chat.'
),
(
  'DEBT-005',
  'techdebt',
  'ORIENTATIONS.md''s "five standing files" logging section is stale',
  NULL,
  'Noticed while adding the TRACKER_SNAPSHOT.md note (fifty-fourth session): the "Logging -- five standing files" section describes BUGLOG.md as where "every bug gets its own entry", but bugs have lived in the tracker_items DB table (not BUGLOG.md) since migration 008/FEAT-011 -- BUGLOG.md''s own 50 legacy bugs were archived there, not kept current since. The same section also never mentions DEV_STATUS.md at all, despite it being the single most-used file across every session in this log (every session entry in this very file lives there). The list of "five standing files" itself needs a rewrite to reflect current practice: DEV_STATUS.md added, BUGLOG.md''s description corrected (or the file itself formally marked historical/archived if tracker_items has fully superseded it).',
  'open',
  'p3',
  'docs/ORIENTATIONS.md, docs/BUGLOG.md',
  'Read ORIENTATIONS.md''s logging section fresh, decide whether BUGLOG.md should be (a) formally marked archived/historical with a pointer to tracker_items, or (b) kept as a slower-moving narrative complement -- then rewrite the section to match whichever is decided, adding DEV_STATUS.md to the list either way.',
  'Low priority (P3) -- purely a documentation-accuracy issue, no functional impact. Flagged rather than silently left, per the standing instruction that technical debt found along the way should be logged even when there is no time to fix it in the same session.'
);
