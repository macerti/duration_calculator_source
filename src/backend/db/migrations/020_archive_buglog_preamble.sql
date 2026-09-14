-- Audit Duration Engine -- archive docs/BUGLOG.md's own preamble text
-- (the numbering-collision note above its first ### BUG- entry) into
-- session_log, the one piece of docs/BUGLOG.md content that migration
-- 008/019 (the per-bug tracker_items archival) does not cover.
-- Migration: 020_archive_buglog_preamble
-- Created: 2026-09-13
-- Author: Claude (dev session, 2026-09-13, fifty-eighth session)

INSERT INTO session_log (session_label, summary, trigger_text, done_text, not_done_text, handoff_text, commit_hash, ci_status) VALUES
  ('BUGLOG.md preamble (2026-09-02, eleventh session)', 'Numbering-collision note: src/frontend/BUGLOG.md\'s BUG-001-004 folded into this file\'s canonical sequence as BUG-032-035', NULL, '[Archived verbatim 2026-09-13 (fifty-eighth session) from docs/BUGLOG.md\'s own preamble (the text before its first ### BUG- entry) by migration 020, part of the same log-unification pass as migrations 018/019. This is the only content in docs/BUGLOG.md that is not one of the 49 per-bug entries already fully covered by migration 008 (+019\'s 4 delta updates) -- so archiving it here is what allows docs/BUGLOG.md to be deleted with zero content loss.]

# Bug Log — Audit Duration Calculator

> ✅ **Numbering collision RESOLVED — 2026-09-02 (eleventh session, technical-debt pass).**
> This file previously warned that `src/frontend/BUGLOG.md` (formerly
> `audit-mobile/BUGLOG.md`) had its own independent `BUG-001`–`BUG-004`
> numbering reusing the same IDs as different bugs here — most importantly,
> its own `BUG-004` ("wizard save is broken") was also the bug
> `docs/DEV_STATUS.md`\'s "Current status" section informally tracks as
> *the* BUG-004, unrelated to **this file\'s** `BUG-004` below
> (`mb_strtolower` undefined). Flagged as needing a dedicated renumbering
> pass since the sixth session (2026-09-01); deferred by four sessions in a
> row as too risky to attempt without full runway. That pass has now been
> done: `src/frontend/BUGLOG.md`\'s four entries are folded into this file\'s
> canonical sequence as **BUG-032 through BUG-035** (full original detail
> preserved, nothing summarized away — see those entries below).
> `src/frontend/BUGLOG.md` itself is now a short pointer to this file. Old
> historical prose elsewhere in this project (this file\'s own past entries,
> `docs/DEV_STATUS.md`\'s dated log, `CHANGELOG.md`, past commit messages)
> still says "BUG-004" when narrating what was true *at the time* — that
> text is deliberately left alone (rewriting history mid-narrative is
> exactly what this project\'s own hand-off convention warns against; see
> `docs/DEV_STATUS.md`\'s "Update rule"). **Going forward, cite `BUG-035`**
> for the wizard-save/autosave bug and `BUG-004` (below) only for the
> unrelated `mb_strtolower` bug — the ambiguity is closed for all new
> references even though old text is unchanged. `BUG-019` remains the one
> case that was always the same bug in both files.', NULL, NULL, NULL, NULL);
