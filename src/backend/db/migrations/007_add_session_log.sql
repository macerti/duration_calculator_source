-- Audit Duration Engine — session/action log: the second of the two
-- tables Mahdi asked for explicitly (2026-09-09): "we can create the two
-- tables one for logs, every action done... And the other for features,
-- bugs". `tracker_items`/`tracker_updates` (migration 004) already ARE
-- that second table, live since 2026-09-07 — this migration builds the
-- first one, which did not exist yet.
-- Migration: 007_add_session_log
-- Created: 2026-09-09
-- Author: Claude (dev session, 2026-09-09, forty-eighth session)
--
-- What this is, and what it deliberately is NOT:
--
-- This is a queryable record of what each dev session (human or AI) did,
-- replacing the *day-to-day growth* of docs/DEV_STATUS.md's markdown
-- essay-per-session convention with rows an admin/dev can list, filter,
-- and read without scrolling a multi-thousand-line file top to bottom.
-- It is NOT a replacement for docs/DEV_STATUS.md's existence, and
-- docs/DEV_STATUS.md is NOT being archived by this migration (unlike
-- docs/BUGLOG.md/docs/ROADMAP.md, handled separately by migrations
-- 008/009) — Mahdi's own message this session explicitly conceded
-- keeping "one [file] to help the devs... orient them slightly... ensuring
-- continuity", and the practical reason for that concession is real: a
-- cold-start session needs to read *something* before it has even
-- confirmed PHP+MariaDB are running, so a one-line "read this, then query
-- /admin/session-log" pointer has to keep existing somewhere markdown.
-- Going forward, DEV_STATUS.md's per-session sections should be short
-- (a pointer + anything that genuinely doesn't fit a row), with the full
-- done/not-done/hand-off detail written here instead — that discipline is
-- a hand-off instruction (see docs/DEV_STATUS.md's forty-eighth-session
-- entry), not something this migration can enforce by itself.
--
-- Design, mirroring migration 004's own reasoning style:
--
-- 1. Surrogate INT id, unlike tracker_items.code — there is no natural
--    human-assigned key here (sessions aren't independently numbered by
--    anyone outside this file's own prose today; "forty-eighth session"
--    is a narrative label, not an identifier anything else references).
--
-- 2. `session_label` is a free-text display label (e.g. "2026-09-09 —
--    forty-eighth session"), kept exactly because existing hand-off prose
--    across CHANGELOG.md/ROADMAP.md/BUGLOG.md already cites sessions this
--    way ("per the forty-fifth session's hand-off") — forcing a
--    structured session-number column now would desynchronize from years
--    of existing prose citing labels, not numbers, for zero real benefit.
--
-- 3. Five text fields split by *when in the workflow they're written*,
--    not by topic (mirrors tracker_updates.done/next, one level more
--    granular since a whole session covers more ground than one tracker
--    update): `trigger_text` (what prompted the session — usually a
--    direct quote/paraphrase of the instruction received), `done_text`
--    (what was actually accomplished, verified), `not_done_text`
--    (explicitly what wasn't — this project's own standing convention of
--    never silently omitting scope), `handoff_text` (instructions for
--    whoever picks this up next). Kept as four separate columns rather
--    than one blob so a future UI can render them as separate labeled
--    sections (matching how AdminTrackerScreen already renders
--    tracker_items' distinct fields) instead of one undifferentiated wall
--    of text — the exact readability problem this migration exists to
--    fix.
--
-- 4. `commit_hash`/`ci_status` are nullable and filled in by convention
--    AFTER the commit exists (this session logs its own row once it
--    already knows its commit hash — see the forty-eighth-session's own
--    row for the pattern) rather than needing a follow-up UPDATE call.
--    Deliberately no PUT/UPDATE route on this table for v1 (see
--    sessionLogRepo.php) — logging retroactively-corrected state would
--    undermine the one property that makes this useful as a real trail
--    (tracker_updates has the same append-only philosophy, for the same
--    reason).
--
-- 5. No DELETE route either, and none is planned — unlike tracker_items
--    (where deleting a mistakenly-created item is legitimate), a session
--    log row IS the historical record; deleting one defeats the table's
--    entire purpose. If a row is ever factually wrong, the correction
--    belongs in a *new* row referencing it, the same way this project's
--    prose convention already handles corrections (see ORIENTATIONS.md's
--    "When another review finds something we missed").
--
-- Permission: reuses `manage_tracker` (migration 004) rather than adding
-- a new permission. Both tables are the same "internal dev-process
-- tooling" concern or by the same admin population; a dedicated
-- `manage_session_log` permission would be schema/permission sprawl for
-- zero real access-control benefit at this project's current scale (one
-- admin role actually holding either permission today). Revisit only if
-- a future role should see one but not the other.

CREATE TABLE IF NOT EXISTS session_log (
  id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  session_label VARCHAR(100) NOT NULL,
  -- One-line headline, same role as DEV_STATUS.md's own section title.
  summary VARCHAR(500) NOT NULL,
  trigger_text TEXT NULL,
  done_text LONGTEXT NULL,
  not_done_text LONGTEXT NULL,
  handoff_text LONGTEXT NULL,
  commit_hash VARCHAR(40) NULL,
  -- Free text, not ENUM: deliberately mirrors tracker_items.type's own
  -- reasoning (migration 004, point 2) — 'pending'/'green'/'red' today,
  -- but "watched via Actions API, run <id>, N/N steps" is exactly the
  -- kind of slightly-richer note this project's own logs already write,
  -- and a VARCHAR doesn't block that.
  ci_status VARCHAR(100) NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  KEY idx_session_log_created_at (created_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
