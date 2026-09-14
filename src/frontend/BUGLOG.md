# Bug Log — src/frontend

> ✅ **Merged into `docs/BUGLOG.md` — 2026-09-02 (eleventh session, technical-debt pass).**
>
> This file used to carry its own independent `BUG-001`–`BUG-004` numbering
> that collided with `docs/BUGLOG.md`'s own (unrelated) `BUG-001`–`BUG-004`
> — most confusingly, this file's own `BUG-004` ("wizard save is broken")
> was also the bug `docs/DEV_STATUS.md`'s "Current status" section
> informally tracked as *the* BUG-004. Flagged as needing a dedicated
> renumbering/merge pass since 2026-09-01 (sixth session); deferred by four
> sessions in a row as too large to attempt without full runway.
>
> All four entries have now been folded into the canonical sequence, full
> original detail preserved (not summarized away):
>
> | This file's old ID | Canonical ID | Bug |
> |---|---|---|
> | BUG-001 | `BUG-032` | `expo-constants` used but not installed (fixed, 0.1.0) |
> | BUG-002 | `BUG-033` | `HomeScreen` health-state spread overwrote discriminant field (fixed, 0.1.0) |
> | BUG-003 | `BUG-034` | `expo export --platform web` peer-dependency failure (fixed, 0.1.0) |
> | BUG-004 | `BUG-035` | Wizard save/autosave reliability — **partially open**, see BUG-035 for current status |
>
> **Cite `BUG-032`–`BUG-035` for all new work.** As of 2026-09-13
> (fifty-eighth session), `docs/BUGLOG.md` itself has been fully archived
> into the `tracker_items` database table (all content preserved verbatim,
> including these four entries — see migration `008`) and deleted; query
> `tracker_items` where `code` is `BUG-032`–`BUG-035`, or read
> `docs/TRACKER_SNAPSHOT.md`. This file is kept only so old commit
> messages/discussions that reference "audit-mobile BUG-004" etc. still
> resolve to something; it is not maintained further. Full original
> investigation detail (file/line references, symptom analysis, suggested
> next steps) is preserved in git history for this file and in `tracker_items`'
> `BUG-035` row's `technical_description`.
