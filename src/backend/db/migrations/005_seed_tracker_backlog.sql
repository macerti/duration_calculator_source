-- Audit Duration Engine -- seed the bug/feature/tech-debt tracker (tables
-- created schema-only by migration 004) with the actual current backlog,
-- extracted from docs/BUGLOG.md follow-ups and docs/ROADMAP.md's P1/P2 queue.
-- Migration: 005_seed_tracker_backlog
-- Created: 2026-09-07
-- Author: Claude (dev session, 2026-09-07, fortieth session)
--
-- Why this exists: migration 004 created tracker_items/tracker_updates but
-- left them empty (schema-only, by design -- see that migration's own
-- header). An empty table doesn't let an admin actually reorganize anything.
-- This migration seeds it with every currently-open bug follow-up, feature,
-- and tech-debt item pulled from docs/BUGLOG.md and docs/ROADMAP.md as of
-- this session, each with one tracker_updates row summarizing its history
-- (done) and hand-off (next), matching the depth already recorded in those
-- markdown files. Deliberately does NOT bulk-migrate closed/historical bugs
-- (BUG-001 through BUG-050 are all otherwise closed) -- BUGLOG.md remains the
-- permanent historical archive for those, per 004's own stated intent
-- ('keeping markdown only for dev-to-dev narrative hand-off'). Only items
-- with real outstanding work are seeded here.
--
-- INSERT IGNORE throughout: idempotent, safe to re-run, and deliberately
-- non-destructive of any row an admin has already edited via the new API
-- (a second run of this migration will never overwrite a status/priority
-- an admin has since changed through the UI).

-- FEAT-006 -- In-app admin annotation/comment tool - pending live click-through
INSERT IGNORE INTO tracker_items
  (code, type, title, user_description, technical_description, status, priority, dependencies, tests_to_do, comments)
VALUES
  ('FEAT-006', 'feature', 'In-app admin annotation/comment tool - pending live click-through', NULL, 'Backend complete (migration 003, manage_annotations permission, full CRUD+export, 65/65 HTTP-tested). Frontend complete after BUG-048 (P0 crash) and BUG-049 (export path) fixes, build-verified (tsc clean, expo export 558 modules, make build-deploy 4/4 hygiene checks). First real live-annotation batch (8 items, 2 admins) exercised export successfully - see BUG-050. What remains: a genuine live click-through confirming the full feature (right-click/long-press menu, submit comment, all three export actions) works end-to-end on a real device/browser, which no sandbox session has ever had access to verify directly.', 'fixed_unverified', 'p1', 'AnnotationCapture.tsx, AdminAnnotationsScreen.tsx, annotationRepo.php, App.tsx (NavigationContainer ref)', 'Live click-through on a real device/browser: right-click (desktop) and long-press (mobile) open the menu; submit a comment; Copier/Partager/Telecharger all work; confirm no regression of BUG-048/049/050 fixes.', 'Needs Mahdi (or a sandbox with real browser/device access) to confirm live end-to-end - see tests_to_do.');

INSERT IGNORE INTO tracker_updates (item_code, done, next)
VALUES
  ('FEAT-006', 'Full history: spec written 34th session, backend built same session (65/65 HTTP), frontend shipped 35th session unverified and caused a P0 outage (BUG-048, fixed 36th session), export path fixed 37th session (BUG-049), first real 8-annotation live batch surfaced 5 more issues fixed in BUG-050 (38th/39th sessions). All fixes are build-verified (tsc/expo export/build-deploy) but never live-click-through-confirmed by a human on a real device.', 'Get a real live click-through from Mahdi confirming the feature works end-to-end before calling this closed.');

-- DEBT-001 -- No CI render-smoke-test - runtime-only crashes can reach production on green CI
INSERT IGNORE INTO tracker_items
  (code, type, title, user_description, technical_description, status, priority, dependencies, tests_to_do, comments)
VALUES
  ('DEBT-001', 'techdebt', 'No CI render-smoke-test - runtime-only crashes can reach production on green CI', NULL, 'BUG-048 (P0 production outage, 2026-09-07) shipped through a fully green CI run because this pipeline''s frontend CI step is `npx tsc --noEmit` + `npx expo export --platform web`, neither of which renders the component tree or exercises React Navigation''s runtime context resolution. The specific crash (useNavigationState called from outside its navigator) is invisible to the type system and undetectable by a bundler build alone - it is a pure runtime failure. Proposed direction (not yet built): a minimal headless render check (e.g. React Native Testing Library rendering <App /> in its major states) as a new CI step.', 'open', 'p1', '.github/workflows/build-test-publish.yml, App.tsx', 'Once built - a deliberately-reintroduced version of BUG-048''s exact bug should fail this new CI step before merge.', 'Scoped but not started. A real, standalone session, not a bolt-on to an unrelated fix.');

INSERT IGNORE INTO tracker_updates (item_code, done, next)
VALUES
  ('DEBT-001', 'Identified and named as a standing process gap while fixing BUG-048 (thirty-sixth session, 2026-09-07). Not attempted - flagged as its own scoped follow-up rather than improvised into the hotfix.', 'Evaluate and implement a minimal render-smoke CI step (RNTL headless render of App.tsx''s major states) as a new workflow step.');

-- BUG-051 -- ErrorBoundary's onGoHome is a no-op on native for any future crash
INSERT IGNORE INTO tracker_items
  (code, type, title, user_description, technical_description, status, priority, dependencies, tests_to_do, comments)
VALUES
  ('BUG-051', 'bug', 'ErrorBoundary''s onGoHome is a no-op on native for any future crash', NULL, 'ErrorBoundary''s ''Retour a l''accueil'' button calls onGoHome, which is Platform.OS===''web'' ? window.location.reload() : no-op. On native, tapping it after any future crash (not just BUG-048''s, which is already fixed by removing its cause) does nothing visible - the boundary never actually recovers. Fixing properly needs a real reload equivalent (expo-updates or similar), deliberately not added during BUG-048''s hotfix to keep that fix small and immediately shippable.', 'open', 'p2', 'ErrorBoundary.tsx, App.tsx (onGoHome)', 'Trigger any thrown render error on a native build; confirm ''Retour a l''accueil'' actually recovers the app instead of doing nothing.', 'Needs an expo-updates (or equivalent) dependency decision before implementation - not just a code fix.');

INSERT IGNORE INTO tracker_updates (item_code, done, next)
VALUES
  ('BUG-051', 'Identified as a lower-severity, separate follow-up while fixing BUG-048 (thirty-sixth session). BUG-048''s own crash is fixed by removing its cause, so this is no longer masked by an active P0 - but the underlying no-op remains for any future native crash.', 'Decide whether to add expo-updates (or an equivalent reload mechanism) for native, then implement.');

-- BUG-052 -- CalculationWizard Synthese - "This total is useless" (unclear which total)
INSERT IGNORE INTO tracker_items
  (code, type, title, user_description, technical_description, status, priority, dependencies, tests_to_do, comments)
VALUES
  ('BUG-052', 'bug', 'CalculationWizard Synthese - "This total is useless" (unclear which total)', '"This total is useless" - annotation on CalculationWizardScreen (Synthese tab), position x=316, y=598, one of Mahdi''s/a second admin''s 8 live annotations, 2026-09-07.', 'Position doesn''t map unambiguously to one element without live device access. Two candidates in that area: the per-year subtotal (''Recapitulatif annuel'' box, added by BUG-027 #2 specifically so a site''s total could be seen broken down by year) and the single site-level grand total box below it. Deliberately not guessed at or changed - this is an audit-duration calculator and a displayed total may carry real regulatory/audit meaning not obvious from the UI alone.', 'open', 'p2', 'CalculationWizardScreen.tsx (Synthese tab, yearlyBreakdownTotal / finalTotalBox)', 'N/A until clarified - do not change calculation-adjacent UI without confirming which total and why it is considered useless.', 'Blocked - needs Mahdi to clarify which total he means (screenshot, or re-annotate directly on the element).');

INSERT IGNORE INTO tracker_updates (item_code, done, next)
VALUES
  ('BUG-052', 'Investigated during BUG-050 (thirty-eighth session): confirmed two plausible candidate elements at the annotated position, deliberately did not guess or change either.', 'Get clarification from Mahdi (screenshot or re-annotate) on which total and why, before touching this.');

-- DEBT-002 -- AdminRoles - flat permissions list + narrow desktop width, needs redesign
INSERT IGNORE INTO tracker_items
  (code, type, title, user_description, technical_description, status, priority, dependencies, tests_to_do, comments)
VALUES
  ('DEBT-002', 'techdebt', 'AdminRoles - flat permissions list + narrow desktop width, needs redesign', '"the layout here is trash roles and permissions should be layouted differently not a big list, use tabs or something come on dude also why in desktop you dont exploit the width of the screen making the whole app fit in a tight vertical phonelike space?" - annotation on AdminRolesScreen, 2026-09-07.', 'AdminRolesScreen.tsx renders roles as a flat, repeated list of role-cards, each expanding to show every permission as its own row/checkbox - no grouping, tabs, or matrix view. Separately, ResponsiveContainer''s maxWidth is capped at 640-800px on AdminRolesScreen/AdminUsersScreen/AdminAnnotationsScreen/ProfileScreen/HomeScreen vs 900-1100px on CalculationWizardScreen/CalculationReportScreen - the app deliberately letterboxes into a narrow centered column on desktop for these screens. Two separable pieces: (1) quick, low-risk maxWidth bump toward 1100px - safe, tsc-verifiable alone; (2) real redesign - tabbed-per-role view or a roles-by-permissions matrix/grid - needs a design decision before code, not a blind implementation.', 'open', 'p1', 'AdminRolesScreen.tsx, AdminUsersScreen.tsx, ResponsiveContainer.tsx', 'After (1): tsc clean, visually confirm wider column on desktop. After (2): live click-through confirming the new interaction model reads clearly with real role/permission counts.', 'Part (1) (maxWidth bump) is safe to do immediately. Part (2) (real redesign) needs a decision on tabs-per-role vs matrix/grid before starting.');

INSERT IGNORE INTO tracker_updates (item_code, done, next)
VALUES
  ('DEBT-002', 'Root cause confirmed during BUG-050 (thirty-eighth session, live annotation from Mahdi). Logged as ROADMAP item 11 at the time. Not attempted - needs a design pass, not a quick fix.', 'At minimum, do the low-risk maxWidth bump. Then decide tabs-per-role vs matrix/grid for the real redesign and implement.');

-- DEBT-003 -- testID coverage near-zero app-wide, blunts FEAT-006's element-reference feature
INSERT IGNORE INTO tracker_items
  (code, type, title, user_description, technical_description, status, priority, dependencies, tests_to_do, comments)
VALUES
  ('DEBT-003', 'techdebt', 'testID coverage near-zero app-wide, blunts FEAT-006''s element-reference feature', NULL, 'A full-codebase grep for testID= (before BUG-050''s small additions) returned zero matches. FEAT-006''s resolveWebElementRef() (annotation tool) walks up the DOM/component tree looking for a testID (rendered as data-testid on web); with none present it has nothing to match. All 8 real annotations captured in the first live batch (BUG-050) came back with elementRef: null - confirming this is the default outcome, not a rare miss. A few testIDs were added opportunistically during BUG-050 to buttons already being touched (ProfileScreen''s 3 admin-nav buttons, AdminAnnotationsScreen''s 3 export buttons, Breadcrumbs'' profile button) - real but small progress.', 'open', 'p2', 'AnnotationCapture.tsx (resolveWebElementRef), every screen/component under src/screens and src/components', 'After a coverage pass - capture new annotations on the newly-tagged screens and confirm elementRef is populated instead of null.', 'A dedicated, ongoing pass adding testID to each screen''s primary buttons/cards at minimum - not a one-session task, per this item''s own original design.');

INSERT IGNORE INTO tracker_updates (item_code, done, next)
VALUES
  ('DEBT-003', 'Root cause confirmed (zero testIDs app-wide) during BUG-050 (thirty-eighth session). A handful added opportunistically to buttons already being touched for other fixes.', 'Dedicated pass: add testID to the highest-traffic interactive elements app-wide, screen by screen.');

-- DEBT-004 -- Top-level tests/ relocation + missing frontend unit tests
INSERT IGNORE INTO tracker_items
  (code, type, title, user_description, technical_description, status, priority, dependencies, tests_to_do, comments)
VALUES
  ('DEBT-004', 'techdebt', 'Top-level tests/ relocation + missing frontend unit tests', NULL, 'src/backend/tests/ should move to top-level tests/backend/ per REPOSITORY_ARCHITECTURE.md''s intended layout. Separately, there are no automated Jest/Vitest unit tests for frontend wizard calculation state/hooks - validation of that logic is currently purely manual. Flagged and carried over, untouched, across at least four consecutive sessions (thirty-sixth through thirty-ninth) despite Mahdi''s repeated standing instruction that technical debt must not become permanent.', 'open', 'p1', 'src/backend/tests/, Makefile, CI workflow paths referencing tests/', 'After the move - confirm CI''s test-invocation paths still resolve and the full backend suite still runs (24/24 smoke, current HTTP count). After frontend units exist - run them in CI alongside tsc/expo export.', 'Both halves untouched. Needs its own session: move + fix any path references first (low risk), then scope the frontend unit-test framework choice (Jest vs Vitest) and an initial test target (wizard calculation state) separately.');

INSERT IGNORE INTO tracker_updates (item_code, done, next)
VALUES
  ('DEBT-004', 'Repeatedly identified and explicitly carried over, untouched, across the thirty-sixth through thirty-ninth sessions - each one correctly prioritized live P0/P1 work ahead of it, but Mahdi has flagged more than once that this must not become permanent.', 'Give this its own session: relocate tests/ first (mechanical, low-risk), then scope frontend unit tests as a separate follow-up.');

-- FEAT-007 -- In-App Guided Acceptance Test Runner & Report Exporter
INSERT IGNORE INTO tracker_items
  (code, type, title, user_description, technical_description, status, priority, dependencies, tests_to_do, comments)
VALUES
  ('FEAT-007', 'feature', 'In-App Guided Acceptance Test Runner & Report Exporter', NULL, 'Embed the acceptance test suite (currently docs/TEST_CHECKLIST.md, a static markdown file) directly into the app instead of relying on an external checklist. Proposed: a dedicated menu/modal to launch Guided Test Mode from Home or Settings; step-by-step interactive prompts guiding the tester through specific scenarios; automated state checks where possible plus interactive checklist/radio questions; one-click export of a standardized test report (JSON/Markdown) readable by both human and AI developers, to update logs without manual transcript synthesis.', 'open', 'p1', 'docs/TEST_CHECKLIST.md (source content to migrate), new screen/modal, export mechanism (can likely reuse FEAT-006''s Copier/Partager/Telecharger pattern from AdminAnnotationsScreen.tsx)', 'Not started - no code written yet.', 'Approved, top immediate tooling task per ROADMAP P1 queue. Not started.');

INSERT IGNORE INTO tracker_updates (item_code, done, next)
VALUES
  ('FEAT-007', 'Requested and approved as ROADMAP P1 item 1, top immediate tooling task. Design not yet started.', 'Scope the guided-test-mode UI and the report export format before writing code.');

-- FEAT-008 -- Parameter Admin UI & Dossier Reference Codification
INSERT IGNORE INTO tracker_items
  (code, type, title, user_description, technical_description, status, priority, dependencies, tests_to_do, comments)
VALUES
  ('FEAT-008', 'feature', 'Parameter Admin UI & Dossier Reference Codification', NULL, 'Web interface for administrators to inspect/edit IAF parameter tables (MD5, MD1, MD11) and factor catalogs from the browser instead of editing PHP source and reseeding. Also: a configurable automatic calculation-reference-number generator (prefix + date components + incremental counter) to auto-populate dossierRef. ROADMAP calls this the PO''s top priority - elevated to P1.', 'open', 'p1', 'src/backend/data/parameters.php, parameterSetRepo.php, new AdminParametersScreen', 'Not started. Open architectural question carried over from earlier sessions: NAE formula editability, data-driven vs hardcoded engine parameters, and whether authentication is a hard prerequisite (it now is, since local accounts/RBAC exist).', 'Not started. Highest PO-stated value item currently unbuilt.');

INSERT IGNORE INTO tracker_updates (item_code, done, next)
VALUES
  ('FEAT-008', 'Repeatedly re-affirmed as PO top priority across multiple ROADMAP revisions. Scoped at a high level (parameter editing + dossier codification) but no implementation session has started it yet.', 'Resolve the open architectural questions (formula editability, data-driven vs hardcoded params) before starting implementation.');

-- FEAT-001 -- Synthese per-site tabs & consolidated Programme d'audit Client
INSERT IGNORE INTO tracker_items
  (code, type, title, user_description, technical_description, status, priority, dependencies, tests_to_do, comments)
VALUES
  ('FEAT-001', 'feature', 'Synthese per-site tabs & consolidated Programme d''audit Client', NULL, 'In Synthese, present dedicated tabs for each individual site''s audit programme, plus one consolidated tab named exactly ''Programme d''audit Client'' calculating the global combined duration without double-counting, respecting multi-site synergy/IAF rules. Both per-site and consolidated views must remain accessible. Must integrate correctly with BUG-025/027''s site/standard-selection scoping (no state leakage between sites or standards). Presentation-only - must not change existing calculation formulas unless a separate calculation defect is identified and logged.', 'open', 'p1', 'CalculationWizardScreen.tsx (Synthese tab), synergy.php, standardDuration.php', 'Not started. Once built: verify each site tab''s programme, verify the consolidated tab''s total reconciles with per-site totals without double-counting, verify no state leakage across sites/standards (BUG-025/027 regression check).', 'Not started.');

INSERT IGNORE INTO tracker_updates (item_code, done, next)
VALUES
  ('FEAT-001', 'Requested 2026-09-01, still NOT BUILT as of this session. No implementation attempted yet.', 'Design the tab structure and the no-double-counting consolidation logic before writing UI code.');

-- FEAT-009 -- PDF Export of Calculation Report
INSERT IGNORE INTO tracker_items
  (code, type, title, user_description, technical_description, status, priority, dependencies, tests_to_do, comments)
VALUES
  ('FEAT-009', 'feature', 'PDF Export of Calculation Report', NULL, 'Generate a downloadable, print-ready PDF audit-duration calculation report directly from the Calculation Report screen data - formulas, factor justifications, and audit day breakdowns included. Elevated to P1.', 'open', 'p1', 'CalculationReportScreen.tsx, calculationCaseRepo.php (report data shape)', 'Not started.', 'Not started.');

INSERT IGNORE INTO tracker_updates (item_code, done, next)
VALUES
  ('FEAT-009', 'Elevated to P1 in ROADMAP. Not started - no PDF generation library chosen yet.', 'Choose a PDF generation approach (client-side vs server-side) before implementation.');

-- FEAT-004 -- Production-quality web presence, metadata, routing & SEO review
INSERT IGNORE INTO tracker_items
  (code, type, title, user_description, technical_description, status, priority, dependencies, tests_to_do, comments)
VALUES
  ('FEAT-004', 'feature', 'Production-quality web presence, metadata, routing & SEO review', NULL, 'Branded 404, removal of Vite/React/framework-default identity, canonical URLs, robots.txt/sitemap.xml, meta descriptions, structured data where accurate, image alt text, console-error audit, source-map exposure review, bundle-size measurement. Explicit rule: private/stateful wizard screens are not automatically converted to indexable URLs; public vs private indexing boundary must stay deliberate. Full acceptance criteria in docs/ROADMAP.md''s FEAT-004 section.', 'open', 'p2', 'whole frontend build config, docs/ROADMAP.md FEAT-004 section (full checklist)', 'Not started.', 'P2 - for later, per ROADMAP''s own priority framework. Not urgent relative to the P1 queue.');

INSERT IGNORE INTO tracker_updates (item_code, done, next)
VALUES
  ('FEAT-004', 'Scoped in detail in ROADMAP.md, deliberately deprioritized to P2 (For Later) per the project''s own priority framework.', 'Revisit once the P1 queue (FEAT-001/006/007/008/009 and DEBT-001/002/004) is clear.');

-- FEAT-002 -- Google sign-in - deferred, backend code exists unlinked
INSERT IGNORE INTO tracker_items
  (code, type, title, user_description, technical_description, status, priority, dependencies, tests_to_do, comments)
VALUES
  ('FEAT-002', 'feature', 'Google sign-in - deferred, backend code exists unlinked', 'Google sign-in button removed from LoginScreen per Mahdi''s explicit instruction, 2026-09-03 (''Google is a piece of shit for now'').', 'Microsoft sign-in verified working end-to-end 2026-09-03. Google OAuth backend code (GoogleOAuth.php) remains in place, unlinked, not deleted - low-risk to re-enable later. The ''Continue with Google'' button was removed from LoginScreen per explicit instruction.', 'open', 'p3', 'GoogleOAuth.php (untouched, unlinked), LoginScreen.tsx', 'N/A unless re-enabled.', 'Deferred indefinitely. Re-enable only on explicit future request - do not re-add the button proactively.');

INSERT IGNORE INTO tracker_updates (item_code, done, next)
VALUES
  ('FEAT-002', 'Google button removed from LoginScreen 2026-09-03 per explicit instruction; backend code kept unlinked rather than deleted for a low-risk future re-enable.', 'No action unless Mahdi explicitly asks to re-enable Google sign-in.');
