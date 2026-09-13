# Tracker snapshot (auto-generated)

> Generated 2026-09-13T01:37:01+00:00 by `.github/workflows/dev-export-snapshot.yml` calling `GET /dev-export`. Do not edit by hand — changes are overwritten on the next scheduled run. Source of truth is the live `tracker_items`/`tracker_updates`/`session_log` tables; this file exists so pulling this repo also gets you a recent read of them, without needing live database access.

## Open (10)

### [DEBT-002] (techdebt, P1) AdminRoles - flat permissions list + narrow desktop width, needs redesign

- **Reported as**: "the layout here is trash roles and permissions should be layouted differently not a big list, use tabs or something come on dude also why in desktop you dont exploit the width of the screen making the whole app fit in a tight vertical phonelike space?" - annotation on AdminRolesScreen, 2026-09-07.
- **Technical**: AdminRolesScreen.tsx renders roles as a flat, repeated list of role-cards, each expanding to show every permission as its own row/checkbox - no grouping, tabs, or matrix view. Separately, ResponsiveContainer's maxWidth is capped at 640-800px on AdminRolesScreen/AdminUsersScreen/AdminAnnotationsScreen/ProfileScreen/HomeScreen vs 900-1100px on CalculationWizardScreen/CalculationReportScreen - the app deliberately letterboxes into a narrow centered column on desktop for these screens. Two separable pieces: (1) quick, low-risk maxWidth bump toward 1100px - safe, tsc-verifiable alone; (2) real redesign - tabbed-per-role view or a roles-by-permissions matrix/grid - needs a design decision before code, not a blind implementation.
- **Tests to do**: After (1): tsc clean, visually confirm wider column on desktop. After (2): live click-through confirming the new interaction model reads clearly with real role/permission counts.
- **Touches**: AdminRolesScreen.tsx, AdminUsersScreen.tsx, ResponsiveContainer.tsx
- **Comments**: Part (1) (maxWidth bump) is safe to do immediately. Part (2) (real redesign) needs a decision on tabs-per-role vs matrix/grid before starting.
- **History**:
  - _2026-09-08 05:04:27_ — Root cause confirmed during BUG-050 (thirty-eighth session, live annotation from Mahdi). Logged as ROADMAP item 11 at the time. Not attempted - needs a design pass, not a quick fix. (next: At minimum, do the low-risk maxWidth bump. Then decide tabs-per-role vs matrix/grid for the real redesign and implement.)

### [DEBT-004] (techdebt, P1) Top-level tests/ relocation + missing frontend unit tests

- **Technical**: src/backend/tests/ should move to top-level tests/backend/ per REPOSITORY_ARCHITECTURE.md's intended layout. Separately, there are no automated Jest/Vitest unit tests for frontend wizard calculation state/hooks - validation of that logic is currently purely manual. Flagged and carried over, untouched, across at least four consecutive sessions (thirty-sixth through thirty-ninth) despite Mahdi's repeated standing instruction that technical debt must not become permanent.
- **Tests to do**: After the move - confirm CI's test-invocation paths still resolve and the full backend suite still runs (24/24 smoke, current HTTP count). After frontend units exist - run them in CI alongside tsc/expo export.
- **Touches**: src/backend/tests/, Makefile, CI workflow paths referencing tests/
- **Comments**: Both halves untouched. Needs its own session: move + fix any path references first (low risk), then scope the frontend unit-test framework choice (Jest vs Vitest) and an initial test target (wizard calculation state) separately.
- **History**:
  - _2026-09-08 05:04:27_ — Repeatedly identified and explicitly carried over, untouched, across the thirty-sixth through thirty-ninth sessions - each one correctly prioritized live P0/P1 work ahead of it, but Mahdi has flagged more than once that this must not become permanent. (next: Give this its own session: relocate tests/ first (mechanical, low-risk), then scope frontend unit tests as a separate follow-up.)

### [FEAT-001] (feature, P1) Synthese per-site tabs & consolidated Programme d'audit Client

- **Technical**: In Synthese, present dedicated tabs for each individual site's audit programme, plus one consolidated tab named exactly 'Programme d'audit Client' calculating the global combined duration without double-counting, respecting multi-site synergy/IAF rules. Both per-site and consolidated views must remain accessible. Must integrate correctly with BUG-025/027's site/standard-selection scoping (no state leakage between sites or standards). Presentation-only - must not change existing calculation formulas unless a separate calculation defect is identified and logged.
- **Tests to do**: Not started. Once built: verify each site tab's programme, verify the consolidated tab's total reconciles with per-site totals without double-counting, verify no state leakage across sites/standards (BUG-025/027 regression check).
- **Touches**: CalculationWizardScreen.tsx (Synthese tab), synergy.php, standardDuration.php
- **Comments**: Not started.
- **History**:
  - _2026-09-08 05:04:27_ — Requested 2026-09-01, still NOT BUILT as of this session. No implementation attempted yet. (next: Design the tab structure and the no-double-counting consolidation logic before writing UI code.)

### [FEAT-008] (feature, P1) Parameter Admin UI & Dossier Reference Codification

- **Technical**: Web interface for administrators to inspect/edit IAF parameter tables (MD5, MD1, MD11) and factor catalogs from the browser instead of editing PHP source and reseeding. Also: a configurable automatic calculation-reference-number generator (prefix + date components + incremental counter) to auto-populate dossierRef. ROADMAP calls this the PO's top priority - elevated to P1. -- SLICE 1 BUILT 2026-09-11 (fifty-third session): dossier reference codification. Migration 011 (dossier_ref_config table + manage_parameters permission), db/dossierRefRepo.php (config get/save + atomic generateNextDossierRef() with SELECT...FOR UPDATE), GET/PUT /admin/dossier-ref-config, and POST /cases now auto-generates dossierRef when left blank and the config is enabled (disabled by default -- fully backward compatible). Parameter admin UI (editing IAF/MD5/MD1/MD11 tables and the factor catalogue from a browser) is NOT started -- see docs/DEV_STATUS.md fifty-third-session entry for the open architectural questions a future session needs to resolve first.
- **Tests to do**: Slice 1 (done): 10 new HTTP tests all passing, see tests_to_do history in tracker_updates. Slice 1 still needs a settings-screen UI (frontend, not built) before an admin can actually change the pattern outside raw API calls -- until then this is only reachable via direct HTTP requests. Slice 2 (not started): parameter admin UI -- resolve NAE formula editability / data-driven vs hardcoded engine parameters / auth-prerequisite questions (all still open, see docs/DEV_STATUS.md), then design + build the actual browser-based editor for IAF/MD5/MD1/MD11 tables and the factor catalogue.
- **Touches**: src/backend/db/migrations/011_dossier_ref_codification.sql, src/backend/db/dossierRefRepo.php, src/backend/api/index.php, src/backend/tests/http_api_test.php
- **Comments**: All hardcoded formulas can be edited added modified the numbers the operations the steps
- **History**:
  - _2026-09-08 05:04:27_ — Repeatedly re-affirmed as PO top priority across multiple ROADMAP revisions. Scoped at a high level (parameter editing + dossier codification) but no implementation session has started it yet. (next: Resolve the open architectural questions (formula editability, data-driven vs hardcoded params) before starting implementation.)
  - _2026-09-12 04:36:48_ — Split FEAT-008 into two slices and built the first: dossier reference codification. New migration 011 (dossier_ref_config table, seeded disabled by default; new manage_parameters permission granted to administrateur only -- deliberately not reusing manage_tracker, see migration 011's header for why). New db/dossierRefRepo.php: getDossierRefConfig()/saveDossierRefConfig() (partial update, never touches the counter) and generateNextDossierRef() (transactional, SELECT...FOR UPDATE, handles yearly/monthly/never counter-reset policies). Wired into api/index.php: GET/PUT /admin/dossier-ref-config, and POST /cases now calls generateNextDossierRef() when the caller leaves dossierRef blank AND the config is enabled -- otherwise completely unaffected (disabled by default, so every existing manual-entry deployment is unchanged). 10 new HTTP tests (config CRUD, CSRF/auth gating, previewSample pattern, two auto-generated refs never repeating, an explicit dossierRef never being overridden), all passing on a fresh DB: 117/117 total (up from 107/107), smoke_test.php still 24/24, migrate.php 12/12, check-repo-hygiene.sh 4/4. No frontend changes this session -- npx tsc --noEmit/expo export not re-run since nothing frontend-facing changed. (next: Slice 2 (parameter admin UI) still fully open -- resolve the open architectural questions first (NAE formula editability, data-driven vs hardcoded engine parameters -- note parameter_sets is already versioned/data-driven via parameterSetRepo.php, so the storage half of that question may already be answered; confirm before assuming more work is needed there). Then design + build the actual browser editor for IAF/MD5/MD1/MD11 tables and the factor catalogue, gated behind the same manage_parameters permission this session added. Separately: slice 1 has no settings-screen UI yet either -- an admin can only change the numbering pattern via raw HTTP calls to /admin/dossier-ref-config right now; a small dedicated settings screen (or a section of a future combined parameter-admin screen) is a reasonable frontend-only follow-up on its own, independent of slice 2's bigger open questions. After FEAT-008 (either or both remaining pieces): FEAT-001, FEAT-009 by the tracker's own priority order, then DEBT-001/002(part 2)/003/004. BUG-051/052 still both blocked on Mahdi's own decision/clarification, not on more dev investigation.)
  - _2026-09-12 13:10:50_ — Nothing (next: All hardcoded formulas can be edited added modified the numbers the operations the steps)

### [FEAT-009] (feature, P1) PDF Export of Calculation Report

- **Technical**: Generate a downloadable, print-ready PDF audit-duration calculation report directly from the Calculation Report screen data - formulas, factor justifications, and audit day breakdowns included. Elevated to P1.
- **Tests to do**: Not started.
- **Touches**: CalculationReportScreen.tsx, calculationCaseRepo.php (report data shape)
- **Comments**: Not started.
- **History**:
  - _2026-09-08 05:04:27_ — Elevated to P1 in ROADMAP. Not started - no PDF generation library chosen yet. (next: Choose a PDF generation approach (client-side vs server-side) before implementation.)

### [DEBT-003] (techdebt, P2) testID coverage near-zero app-wide, blunts FEAT-006's element-reference feature

- **Technical**: A full-codebase grep for testID= (before BUG-050's small additions) returned zero matches. FEAT-006's resolveWebElementRef() (annotation tool) walks up the DOM/component tree looking for a testID (rendered as data-testid on web); with none present it has nothing to match. All 8 real annotations captured in the first live batch (BUG-050) came back with elementRef: null - confirming this is the default outcome, not a rare miss. A few testIDs were added opportunistically during BUG-050 to buttons already being touched (ProfileScreen's 3 admin-nav buttons, AdminAnnotationsScreen's 3 export buttons, Breadcrumbs' profile button) - real but small progress.
- **Tests to do**: After a coverage pass - capture new annotations on the newly-tagged screens and confirm elementRef is populated instead of null.
- **Touches**: AnnotationCapture.tsx (resolveWebElementRef), every screen/component under src/screens and src/components
- **Comments**: A dedicated, ongoing pass adding testID to each screen's primary buttons/cards at minimum - not a one-session task, per this item's own original design.
- **History**:
  - _2026-09-08 05:04:27_ — Root cause confirmed (zero testIDs app-wide) during BUG-050 (thirty-eighth session). A handful added opportunistically to buttons already being touched for other fixes. (next: Dedicated pass: add testID to the highest-traffic interactive elements app-wide, screen by screen.)

### [FEAT-004] (feature, P2) Production-quality web presence, metadata, routing & SEO review

- **Technical**: Branded 404, removal of Vite/React/framework-default identity, canonical URLs, robots.txt/sitemap.xml, meta descriptions, structured data where accurate, image alt text, console-error audit, source-map exposure review, bundle-size measurement. Explicit rule: private/stateful wizard screens are not automatically converted to indexable URLs; public vs private indexing boundary must stay deliberate. Full acceptance criteria in docs/ROADMAP.md's FEAT-004 section.
- **Tests to do**: Not started.
- **Touches**: whole frontend build config, docs/ROADMAP.md FEAT-004 section (full checklist)
- **Comments**: P2 - for later, per ROADMAP's own priority framework. Not urgent relative to the P1 queue.
- **History**:
  - _2026-09-08 05:04:27_ — Scoped in detail in ROADMAP.md, deliberately deprioritized to P2 (For Later) per the project's own priority framework. (next: Revisit once the P1 queue (FEAT-001/006/007/008/009 and DEBT-001/002/004) is clear.)

### [ANN-006] (annotation, ) the layout here is trash roles and permisisons should be layouted diffrenlty not a big list, use tabs or something come on dude also why in desktop you dont exploit the width of the screen making t...

- **Reported as**: the layout here is trash roles and permisisons should be layouted diffrenlty not a big list, use tabs or something come on dude also why in desktop you dont exploit the width of the screen making the whole app fit in a tight vertical phonelike space ?

### [ANN-008] (annotation, ) for each annotation you show the x and y positin its good it would also be good if you give more details regarding the element the user poited at like itrs name its container or technical designation

- **Reported as**: for each annotation you show the x and y positin its good it would also be good if you give more details regarding the element the user poited at like itrs name its container or technical designation

### [DEBT-005] (techdebt, P3) ORIENTATIONS.md's "five standing files" logging section is stale

- **Technical**: Noticed while adding the TRACKER_SNAPSHOT.md note (fifty-fourth session): the "Logging -- five standing files" section describes BUGLOG.md as where "every bug gets its own entry", but bugs have lived in the tracker_items DB table (not BUGLOG.md) since migration 008/FEAT-011 -- BUGLOG.md's own 50 legacy bugs were archived there, not kept current since. The same section also never mentions DEV_STATUS.md at all, despite it being the single most-used file across every session in this log (every session entry in this very file lives there). The list of "five standing files" itself needs a rewrite to reflect current practice: DEV_STATUS.md added, BUGLOG.md's description corrected (or the file itself formally marked historical/archived if tracker_items has fully superseded it).
- **Tests to do**: Read ORIENTATIONS.md's logging section fresh, decide whether BUGLOG.md should be (a) formally marked archived/historical with a pointer to tracker_items, or (b) kept as a slower-moving narrative complement -- then rewrite the section to match whichever is decided, adding DEV_STATUS.md to the list either way.
- **Touches**: docs/ORIENTATIONS.md, docs/BUGLOG.md
- **Comments**: Low priority (P3) -- purely a documentation-accuracy issue, no functional impact. Flagged rather than silently left, per the standing instruction that technical debt found along the way should be logged even when there is no time to fix it in the same session.

## Fixed, unverified (needs a live click-through) (2)

### [FEAT-010] (feature, P1) Bug/feature/tech-debt tracker (DB-backed, replacing BUGLOG.md/ROADMAP.md/DEV_STATUS.md for progress tracking)

- **Reported as**: Replace day-to-day bug/feature status tracking with database rows an admin can query/filter/update from a UI, keeping the markdown files only for dev-to-dev narrative hand-off, not progress tracking.
- **Technical**: Schema: tracker_items (code as PK, e.g. BUG-050/FEAT-007; type; title; user_description vs dev-filled technical_description; status [open/in_progress/fixed_unverified/verified/closed]; priority; dependencies; tests_to_do; comments) plus append-only tracker_updates history (item_code FK, done, next). Backend: trackerRepo.php full CRUD data layer, 7 routes under /admin/tracker/* gated behind manage_tracker + CSRF, mirroring /admin/annotations. Frontend: useAdminApi.ts TrackerItem/TrackerUpdate types + 7 client methods, AdminTrackerScreen.tsx (list with status/type/priority filters, detail panel with update history, inline create, log-an-update form, two-tap delete), wired into App.tsx and ProfileScreen.tsx behind manage_tracker. Deliberately uses maxWidth=1100, not AdminAnnotationsScreen.tsx's narrower 800, per DEBT-002's own note not to repeat that layout mistake on a new screen.
- **Tests to do**: Live click-through on a real device/browser: create an item, log an update, edit status/priority, filter by each of the three pickers, two-tap delete with confirm. Same standing sandbox limitation as every other frontend feature in this project -- never yet verified live.
- **Touches**: trackerRepo.php, api/index.php (tracker routes), useAdminApi.ts, AdminTrackerScreen.tsx, App.tsx, ProfileScreen.tsx
- **Comments**: Backend routes + 82/82 HTTP-tested (forty-first session). Frontend screen built and build-verified -- tsc clean, expo export 559 modules, make build-deploy 4/4, check-repo-hygiene.sh 4/4 (forty-fourth session). Needs a real live click-through from Mahdi before this can be called closed, same as FEAT-006.
- **History**:
  - _2026-09-09 03:43:13_ — Full history: proposed by Mahdi 2026-09-07 (thirty-eighth session, schema-only migration 004). Schema finalized and migrated same session. Data layer (trackerRepo.php) written thirty-ninth/fortieth session. Routes wired + 17 HTTP tests added forty-first session (82/82). Frontend baseline re-confirmed + reference files read forty-second session. Client-side plumbing (useAdminApi.ts types/methods) added forty-third session. AdminTrackerScreen.tsx written, wired into App.tsx/ProfileScreen.tsx, and fully build-verified forty-fourth session (559 modules, make build-deploy 4/4, check-repo-hygiene.sh 4/4) -- this migration seeds the feature's own tracker row, closing that session's hand-off item 1. (next: Get a real live click-through from Mahdi confirming create/log-update/edit/filter/delete all work end-to-end before calling this verified, same as FEAT-006's own remaining gap.)

### [FEAT-012] (feature, P1) Dev-export live tracker snapshot -- repo pull now carries live problems too

- **Reported as**: Mahdi, live in chat: "how can we always allow AI developers when pulling the repo to obtain the problems in the db" -- after establishing that no AI sandbox can safely hold standing production DB credentials, and that this sandbox specifically cannot reach any external host on port 3306 or plain HTTPS to arbitrary domains at all.
- **Technical**: New GET /dev-export endpoint (api/index.php) -- read-only, shared-secret-gated (dev_export_secret in config.php, hash_equals-compared, same convention as the existing /migrate endpoint), rate-limited per IP. Returns JSON of tracker_items + tracker_updates + session_log only -- deliberately never clients/cases/sites/users, which is what makes exposing this safe. New .github/workflows/dev-export-snapshot.yml runs every 6 hours (plus workflow_dispatch), calls the endpoint with a DEV_EXPORT_SECRET repo secret, renders it through the new scripts/generate-tracker-snapshot.php into docs/TRACKER_SNAPSHOT.md (and the raw .json alongside it), and commits both to main if changed. ORIENTATIONS.md updated to tell future sessions to read this file at the start of a session.
- **Tests to do**: Endpoint fully tested locally this session (unauthorized/wrong-secret/correct-secret paths, real JSON output, piped through the formatter script -- verified readable Markdown output). NOT YET verified: an actual scheduled run against the real production server, which needs two one-time manual steps first -- (1) set dev_export_secret in the live server config.php, (2) add the same value as this repo's DEV_EXPORT_SECRET GitHub Actions secret. Until both are set, the workflow runs, logs a warning, and skips (does not fail CI).
- **Touches**: api/index.php, config.example.php, scripts/generate-tracker-snapshot.php, .github/workflows/dev-export-snapshot.yml, docs/ORIENTATIONS.md
- **Comments**: Built fifty-fourth session (2026-09-12), fully working in this sandbox against a local DB. Needs Mahdi to complete the two one-time secret-setup steps above before the first real scheduled run will produce anything -- flagged to him directly in chat.

## Closed (62)

DEBT-001, FEAT-006, FEAT-007, BUG-051, BUG-052, ANN-001, ANN-002, ANN-003, ANN-004, ANN-005, ANN-007, BUG-001, BUG-002, BUG-003, BUG-004, BUG-005, BUG-006, BUG-007, BUG-008, BUG-009, BUG-010, BUG-011, BUG-012, BUG-013, BUG-014, BUG-015, BUG-016, BUG-017, BUG-018, BUG-019, BUG-020, BUG-021, BUG-022, BUG-023, BUG-024, BUG-025, BUG-026, BUG-027, BUG-028, BUG-029, BUG-030, BUG-031, BUG-032, BUG-033, BUG-034, BUG-035, BUG-036, BUG-037, BUG-038, BUG-039, BUG-040, BUG-041, BUG-042, BUG-043, BUG-044, BUG-045, BUG-046, BUG-047, BUG-048, BUG-049, BUG-050, FEAT-002

