# CURRENT DELIVERY PRIORITY — 2026-09-01

## Mandatory pipeline

1. FEAT-003 — Versioning and update timestamp: IMMEDIATE.
2. Repository architecture consolidation: immediately after FEAT-003. Follow REPOSITORY_ARCHITECTURE.md; identify the source of truth before moving/deleting anything and preserve all formulas/business rules.
3. USER FEEDBACK / ACCEPTANCE GATE. After the first two items, pause normal feature development and perform real browser/mobile/user testing. Feed the results back into the logs to definitively close, reopen, or change the relevant bugs/features.
4. Remaining bugs. Resume only after the acceptance gate.
5. Remaining features. Resume after the acceptance gate. Admin/parameter administration UI is prioritized ahead of authentication/SSO.
6. FEAT-002 Microsoft/Google SSO: Microsoft sign-in VERIFIED WORKING end-to-end 2026-09-03 (Mahdi confirmed). The Google button has been removed from the UI per explicit instruction (Google OAuth code remains in place, unlinked, not deleted). See `docs/DEV_STATUS.md` twentieth-session entry.

### Acceptance terminology
- USER-ACCEPTED — user confirms the behavior is satisfactory.
- REOPENED — user still observes the reported problem.
- NEW BUG — new reproducible defect.
- CHANGE REQUEST — implementation works but the desired UX/behavior changes.
- VERIFIED — technically verified but awaiting user/product acceptance where applicable.

Do not use older roadmap priority wording as the active priority. This dated decision is authoritative until explicitly replaced.

# Roadmap — audit-app

> Concurrent-development rule: read DEV_STATUS.md before starting work. It is the current hand-off ledger for verified work, open work, evidence level, and dependencies. Update it with every behavior change or test investigation.

## Active Priority Queue (P0 / P1 / P2 Framework)

> Historical completed features and closed bug resolutions have been permanently archived in:
> 📁 [docs/archive/COMPLETED_HISTORY.md](archive/COMPLETED_HISTORY.md)
>
> Priority framework defined by Product Owner:
> - **Priority 0 (P0 — Critical / Blocker)**: The app is down, critical errors, severe bugs. Fix immediately.
> - **Priority 1 (P1 — Active Tasks to Build)**: High-value improvements, active features, in-app test tooling, and non-deferred technical debt.
> - **Priority 2 (P2 — For Later)**: Items reserved for when the application matures further.

---

### Priority 0 (P0) — Critical Blockers & Errors
*No active P0 bugs remaining.*
- **BUG-031 (Production API 404)**: **CLOSED & VERIFIED on live production (2026-09-02)** by Mahdi. Live `config.php` has been corrected with `$config['basePath'] = '/duration_calculator/api';`, and endpoints are operational.

---

### Priority 1 (P1) — Active Tasks to Build Now

#### 0. ✅ DONE 2026-09-05 — Production migrations now apply automatically (closed the gap that caused BUG-045)
- **Category:** Infrastructure / DevOps — Technical Debt (was: Do Not Defer, caused a real live incident)
- **Status:** DONE AND CONFIRMED IN PRODUCTION. Built the `POST /api/migrate` endpoint scoped below, wired `macerti/duration_calculator`'s `deploy.yml` to call it right after every FTP sync, and set the `MIGRATE_SECRET` GitHub Actions secret. 50/50 HTTP regression (including 6 new cases for this endpoint specifically: no-secret rejected, wrong-secret rejected, status-only GET, apply via POST, idempotent no-op on a second call) + 24/24 engine smoke tests, verified locally against real PHP 8.3 + MariaDB 10.11, then confirmed on real GitHub Actions. After Mahdi added the one required `migration_secret` line to production `config.php`, a manually re-triggered `deploy.yml` run went **fully green, 7/7 steps** — including the migration call itself and the post-deploy health check — against the real `tools.macerti.com` host. Full evidence trail in `docs/DEV_STATUS.md`'s 2026-09-05 (twenty-eighth session) entry.
- **The one remaining manual step, and only once ever**: production `config.php` needs a `migration_secret` value matching the GitHub secret — this file lives only on the server and is gitignored, so no pipeline can set it. See `docs/DEPLOY.md` step 5 for the exact one-line change. Until that line is added, the endpoint returns 501 and the deploy workflow's migration step fails loudly (by design — visible beats silent).
- **Original gap** (for history): neither `duration_calculator_source`'s CI (only touches an ephemeral CI-only test database) nor `duration_calculator`'s FTP deploy workflow (pure file sync, cannot execute anything server-side) ever applied a migration to the real production database — exactly what caused BUG-045.

#### 1. In-App Guided Acceptance Test Runner & Report Exporter (NEW!)
- **Category:** User Acceptance Testing / Embedded Test Tooling
- **Status:** APPROVED / TOP IMMEDIATE TOOLING TASK
- **Objective:** Embed the acceptance test suite directly into the application rather than relying on an external static markdown checklist.
- **Features:**
  - Dedicated menu / modal to launch Guided Test Mode from Home or Settings.
  - Step-by-step interactive prompt boxes / notifications guiding the tester (e.g., "Enter headcount 50", "Add ISO 9001 and ISO 14001", "Verify Suggestion chip appears").
  - Automated state checks where possible + interactive checklist / radio questions ("Did the shake animation trigger?", "Does the annual breakdown table read clearly?").
  - One-click export of a standardized test report (JSON/Markdown) readable by human developers and AI developers to update logs without manual transcript synthesis.

#### 2. Parameter Admin UI & Dossier Reference Codification
- **Category:** Core Administration & PO Top Priority
- **Status:** ELEVATED TO P1 (Top PO Value)
- **Objective:** Web interface for administrators to inspect and edit IAF parameter tables (MD5, MD1, MD11) and factor catalogs from the browser instead of modifying PHP source code and reseeding.
- **Dossier Codification:** Configurable automatic calculation reference numbering generator (`prefix + date components + incremental counter`) auto-populating `dossierRef`.

#### 3. FEAT-001 — Synthèse Per-Site Tabs & Consolidated "Programme d'audit Client"
- **Category:** Core Calculation UX
- **Status:** P1 ACTIVE FEATURE
- **Objective:** In **Synthèse**, present dedicated tabs for each individual site's audit programme, plus a dedicated consolidated tab named **Programme d'audit Client** that calculates the global combined duration without double-counting, respecting multi-site synergy and IAF rules.

#### 4. PDF Export of Calculation Report
- **Category:** Export & Client Deliverable
- **Status:** ELEVATED TO P1
- **Objective:** Generate downloadable, print-ready PDF audit duration calculation reports directly from the Calculation Report screen data, complete with formulas, factor justifications, and audit day breakdowns.

#### 5. Authentication & SSO (Microsoft Entra ID)
- **Category:** Security & Identity
- **Status:** **Microsoft sign-in VERIFIED WORKING end-to-end, 2026-09-03 (Mahdi confirmed: "The Microsoft SSO works perfectly").** BUG-036→039 saga fully closed — see `docs/BUGLOG.md` BUG-039.
- **Objective (as originally scoped):** Standard OIDC single sign-on with "Continue with Microsoft" and "Continue with Google" buttons, mapped into a secure PHP session-based user model with HttpOnly cookies.
- **2026-09-03 update:** the "Continue with Google" button was removed from the login screen per explicit instruction ("Google is a piece of shit for now"). Backend Google OAuth code is untouched and unlinked, not deleted, so it remains a low-risk re-enable later. See item 9 below for what's prioritized instead.

#### 6. Technical Debt: Frontend Design Token Migration
- **Category:** Technical Debt (Do Not Defer)
- **Status:** P1 IN-PROGRESS
- **Objective:** Replace hardcoded colors, spacing, and typography across the remaining screens and components (`HomeScreen`, `ClientsListScreen`, `ClientDetailScreen`, `CalculationWizardScreen`, `CalculationReportScreen`, pickers, panels) with semantic tokens from [`src/theme/tokens.ts`](../src/frontend/src/theme/tokens.ts). **9 of 9 files done as of 2026-09-07 — item closed.** `TextField.tsx`, `NumberField.tsx`, `ResponsiveContainer.tsx` (earlier sessions); `ErrorBoundary.tsx`, `NaceSearchField.tsx`, `PersonnelForm.tsx`, `ClientsListScreen.tsx`, `ClientDetailScreen.tsx` (thirty-eighth session); `CalculationReportScreen.tsx` — the last file — finished in the following push: its `theme/tokens` import had been added but none of its ~24 style values converted; now fully converted using the same substitution rules as the other 8 (exact hex matches convert, near-matches convert to the closest semantic role, off-scale numbers like 17, 18, 60 stay raw). `npx tsc --noEmit` clean and `npx expo export` succeeds (558 modules, unchanged) after the conversion. See `docs/DEV_STATUS.md` for per-session detail. **No screen or component in `src/components`/`src/screens` still has un-migrated raw values** — confirmed by `grep -rln "StyleSheet.create" src/components src/screens | xargs grep -L "theme/tokens"` returning empty.

#### 7. Technical Debt: Top-Level `tests/` Relocation & Frontend Unit Tests
- **Category:** Technical Debt & Quality Assurance
- **Status:** P1 TESTING DEBT
- **Objective:** Move `src/backend/tests/` to top-level `tests/backend/` and introduce automated Jest/Vitest unit tests for frontend wizard calculation state and hooks to eliminate reliance on purely manual validation.

#### 8. FEAT-005 — Automated database schema migration on push (DONE — CI confirmed green, locally re-verified end-to-end, closed 2026-09-04)
- **Category:** Infrastructure / DevOps
- **Status as of 2026-09-04 (twenty-third session): DONE.** Idempotent SQL migration framework (`src/backend/db/Migrations.php`, `db/migrate.php`, `db/migrations/001_initial_schema.sql`, `db/migrations/README.md`), wired into `.github/workflows/build-test-publish.yml`'s "Run database migrations" step. All four bugs found while debugging the original CI failure (BUG-040 through BUG-043 — config loading, DDL-vs-transaction handling, an unclosed statement cursor, and an unsafe statement-execution call in the idempotent-guard pattern) are fixed and closed. **Confirmed via the GitHub Actions API that the real CI run on commit `7736577` passed all 20 steps**, including the migration step, ending in a successful publish to `macerti/duration_calculator`. Separately re-verified the full sequence locally, twice (once as-is, once with the deferred `'SELECT 1'` → `'DO 0'` defense-in-depth fix applied): fresh-DB migrate → idempotent re-run → seed → 24/24 smoke tests → 16/16 HTTP regression → hygiene check, all passing both times. Full detail: `docs/BUGLOG.md` BUG-040 through BUG-043, twenty-third-session update.
- **Request as originally given (2026-09-03, by Mahdi):** database migration so that if there is an update in tables, it's enough to push so that the GitHub Action updates the database structure if needed. **This now works as requested.**
- **Priority note, resolved**: local-password account creation (#9) can now proceed — this item's own schema changes will migrate automatically on push, no manual DB update needed.

#### 10. FEAT-006 — In-app admin annotation/comment tool (SPEC WRITTEN 2026-09-06, thirty-fourth session; backend BUILT and sandbox-verified same session; frontend written 2026-09-07 thirty-fifth session then caused a P0 production outage — BUG-048, fixed and build-verified same day, thirty-sixth session; Mahdi's live click-through then found the export screen had no real export path on mobile — BUG-049, fixed and build-verified 2026-09-07 thirty-seventh session, backend regression re-run and live click-through of the fix both still outstanding)
- **Category:** Testing & Feedback Tooling / Core Administration
- **Status:** **Backend done and verified** (migration `003_add_annotations.sql`, `manage_annotations` permission, full CRUD + export under `/admin/annotations`, HTTP-tested against a live PHP+MariaDB sandbox — 65/65, see `docs/DEV_STATUS.md`'s thirty-fourth-session entry). **Frontend: BUG-048 fixed, typecheck/build-verified, still pending live click-through.** The thirty-fifth session's frontend code (`AnnotationCapture.tsx`, `AdminAnnotationsScreen.tsx`, `useAdminApi.ts` additions, `App.tsx`/`ProfileScreen.tsx` wiring) shipped through CI to production unverified and crashed the entire authenticated app for every user — `AnnotationCapture` called `useNavigationState()` while wrapping `<Stack.Navigator>` from the outside, which can never work (see `docs/BUGLOG.md` BUG-048 for the full mechanism). Thirty-sixth session fixed it (screen name now tracked via a `NavigationContainer` ref in `App.tsx`, passed to `AnnotationCapture` as a plain prop) and, for the first time for this feature's frontend, actually ran `npx tsc --noEmit` (clean), `npx expo export --platform web --clear` (549 modules, succeeds), and `make build-deploy` (all 4 hygiene checks pass) — v5.1.11. **Still not done: an actual live click-through** — does right-click/long-press really open the menu, does the export read correctly, does the app merely *not crash* vs. actually working end-to-end — needs Mahdi or a sandbox with browser/device access, same standing limitation as every other frontend feature in this project. Full detail: `docs/BUGLOG.md` BUG-048, `docs/DEV_STATUS.md`'s thirty-sixth-session entry.
- **Update, 2026-09-07 (thirty-eighth session) — this happened. First real live click-through, and it worked well enough to produce 8 real annotations in one sitting** (Mahdi + a second admin, "Mail Certi") exported and fed back into this session — see `docs/BUGLOG.md` BUG-050 for the full breakdown and fixes. Two direct findings about *this* feature specifically: (1) the export **was** reachable and functional (BUG-049's Copier/Partager/Télécharger buttons all got used), but Mahdi initially couldn't find it because `ProfileScreen` itself had no scroll (BUG-050 #1, fixed) — a discoverability bug one level up from this feature, not in it; (2) **the element-reference strategy described below is confirmed opportunistic to the point of near-uselessness in practice**: a full-codebase grep found **zero** `testID` props anywhere in this app, so `resolveWebElementRef()` has essentially nothing to ever match, and all 8 real annotations captured this session came back with no element reference at all (BUG-050 #8). Root cause confirmed, not guessed. A few `testID`s were added opportunistically this session to buttons already being touched for other fixes (`ProfileScreen`'s three admin-nav buttons, `AdminAnnotationsScreen`'s three export buttons, `Breadcrumbs`' new profile button) — real but small progress, not "coverage." **Next step, per this item's own original design ("improving coverage later means adding `testID`s to more components over time, not a rearchitecture"): a dedicated pass adding `testID` to the highest-traffic interactive elements app-wide** — every screen's primary buttons/cards at minimum — is now a concretely scoped, standalone piece of follow-up work, not a hypothetical.
- **Objective (as requested, 2026-09-06):** admin-privileged users right-click (desktop) or tap-and-hold (mobile) anywhere in the app to open a custom contextual menu; besides normal contextual actions, an "add comment" action pins a timestamped, app-version-stamped comment to the exact {x,y} position AND to the specific UI element there (e.g. the header). Comments export to a document (with timestamps + app version) meant to be directly usable by other developers — and by Claude — to action as bugs/feature requests. Also requested to work via tap-and-hold on mobile, not just desktop right-click.

### Required behavior
- Gated entirely behind a new `manage_annotations` permission (same shape as every other admin function in this codebase) — seeded to `administrateur` only, consistent with "admin-privileged users" in the request. Not exposed to `technicien`/`utilisateur` by default; an admin can grant it to another role later via the existing `AdminRolesScreen` (`manage_annotations` is a normal permission row like any other — no annotation-specific UI needed there).
- **Desktop (web)**: a native browser `contextmenu` event anywhere in the app is intercepted (`preventDefault()`) and replaced with this app's own menu, but *only* for users who currently hold `manage_annotations` — for everyone else the browser's default context menu (or no menu at all) is left completely alone, so this feature is invisible to non-admins rather than degrading their experience.
- **Mobile/touch**: a long-press (~500ms, matching the platform-default long-press timing already implied by `TouchableOpacity`/`Pressable`'s own defaults elsewhere in this codebase) anywhere in the app opens the same menu, same admin-only gating.
- The menu's only *required* action for this feature is **"Ajouter un commentaire"**. It does not need to reproduce browser-native actions (copy/inspect/etc.) — those already exist natively outside this app's own menu on desktop, and have no equivalent to "reproduce" on mobile. **Decision (resolving the thirty-second session's open question):** scope this menu to exactly one action for now; it is a real `Menu`-shaped component (not a modal dialog) so more admin actions can be added to it later without a redesign, but nothing else is speced or built in this pass.
- Choosing "Ajouter un commentaire" opens a small form (multiline text input + submit) anchored near the captured {x,y}; on submit it calls `POST /admin/annotations` with the exact capture coordinates, the resolved element reference (see below), the current app version (already available via this app's existing FEAT-003 version-footer mechanism — reuse that single source of truth, never a second hard-coded version string), and the comment text.
- **Element-reference strategy (resolving the thirty-second session's open question):** best-effort, not exhaustive day-one instrumentation of every element. On web, walk up the DOM from the actual click target (`event.target`) looking for the nearest ancestor carrying a `data-testid` (React Native Web already renders a component's `testID` prop as `data-testid` in the DOM — no new prop or wrapper needed, this is existing RNW behavior) or, failing that, an `id`; if neither is found within a small number of ancestor hops, `elementRef` is simply `null` and the annotation is still saved with only its {x,y} position (a screen name plus a position is still useful without a named element — this must never block saving a comment). On native, there is no DOM to walk, so `elementRef` is populated only where the long-press originated on a component that already has an explicit `testID` prop *and* that component is reachable from the capture layer (see "Native long-press capture" below); otherwise `null`, same graceful degradation as web. **This means element-level precision is currently opportunistic, tied to whichever components already carry (or are given) a `testID`** — improving coverage later means adding `testID`s to more components over time, not a rearchitecture of this feature.
- **Native long-press capture — the real open technical risk the thirty-second session flagged, resolved with an explicit, named limitation rather than left unaddressed:** implemented via a single top-level capture wrapped around the app's root view, using React Native's responder-capture phase (`onStartShouldSetResponderCapture`/`onResponderGrant` with a long-press timer) so it does not require instrumenting every existing component individually. **Known limitation, stated plainly rather than discovered later:** the responder-*capture* phase can, per React Native's own documented responder system, be pre-empted by a child that becomes the responder first (e.g. a `ScrollView` actively scrolling, or a nested `Pressable` already mid-press) — this means long-press-to-annotate is not guaranteed to fire in 100% of exact pixel positions on every screen, only "anywhere in the app" as a strong default. This is flagged here as a known, named trade-off rather than promised as flawless, and is exactly the kind of thing this project's own convention requires a live device pass to actually confirm one way or the other (see Acceptance criteria).
- **Export** (its own explicit sub-requirement, not an afterthought): `GET /admin/annotations/export`, gated behind the same `manage_annotations` permission, producing a Markdown document by default (`?format=json` for the JSON equivalent) — one section per annotation, each carrying its id, screen, element reference (if any), {x,y}, status, the app version it was made against, who made it and when, and the full comment text. Explicitly designed to be pasted directly into a prompt for a future Claude session or read directly by a developer, without any manual reformatting — this is the same "reduce manual transcript synthesis" goal that motivated the request in the first place, and deliberately reuses this project's own already-established Markdown-log conventions (dated sections, explicit fields) rather than inventing a new document shape.
- Comments carry a `status` (`open` / `actioned` / `dismissed`) so a developer or Claude working through an export can mark items handled without deleting the underlying record — mirrors this codebase's existing `active`/`disabled` user-status pattern rather than inventing a new status shape.
- **Overlap with P1 item 1 (in-app guided acceptance test runner) — resolved:** these stay two separate features for now. Item 1 is a *guided, step-by-step test script* the tester follows; this item is an *unstructured, anywhere-anytime* comment pinned to whatever the admin is looking at, independent of any test script being run. They could plausibly share the same export-formatting helper in a later pass if item 1 is ever built, but nothing about this item's implementation blocks or requires that — not coupling them now.

### Data model
New migration `003_add_annotations.sql` (fully additive, same idempotent `CREATE TABLE IF NOT EXISTS` + `INSERT IGNORE` shape as every prior migration in this project — see `db/migrations/README.md`):
- `annotations` — `id`, `screen` (route/screen name the comment was made on), `element_ref` (nullable — see element-reference strategy above), `x`/`y` (the raw capture position), `comment` (text), `app_version` (the value shown in this app's own FEAT-003 version footer at capture time), `created_by` (FK → `users`, `ON DELETE CASCADE` — matches this codebase's existing pattern for user-owned rows), `status` (`open`/`actioned`/`dismissed`, default `open`), `created_at`/`updated_at`.
- New permission `manage_annotations`, seeded and granted to `administrateur` only (see Required behavior above) — added the same way `manage_users`/`manage_roles` etc. were originally seeded in `002_add_auth_and_rbac.sql`.

### API routes (all under `requirePermission('manage_annotations')`, same pattern as every existing `/admin/*` route)
- `GET /admin/annotations` — list all, optional `?status=open|actioned|dismissed` filter.
- `POST /admin/annotations` — create (`screen`, optional `elementRef`, required numeric `x`/`y`, `comment`, `appVersion`); `createdBy` taken from the authenticated session, never from the request body.
- `PUT /admin/annotations/:id` — update `status` only (editing comment text after the fact is out of scope for this pass — dismissing/actioning is the only lifecycle this needs right now).
- `DELETE /admin/annotations/:id`.
- `GET /admin/annotations/export?format=markdown|json` (`markdown` is the default) — see Export above.
- All mutating routes (`POST`/`PUT`/`DELETE`) require the CSRF token, identical to every other `/admin/*` route in this codebase — no exception carved out for this feature.

### Export format
See "Export" under Required behavior above for the full content contract. Markdown is the default because it is what's directly usable by a human developer *and* pastable into a Claude conversation with no reformatting; `?format=json` exists for any future tooling (e.g. a hypothetical shared exporter with P1 item 1) that wants structured data instead.

### Acceptance criteria
- An admin (has `manage_annotations`) sees the custom context menu on right-click (web) and long-press (mobile); a non-admin sees no change in behavior at all (native browser menu on web, no special menu on mobile).
- Submitting "Ajouter un commentaire" persists a row carrying the exact capture position, the current app version, the resolved element reference where one was found, and the comment text — verified at the HTTP/API level in this sandbox; **the actual menu-open and submit interaction has NOT been live-clicked by anyone, on either web or a real mobile device, as of this spec being written** — flag this explicitly to Mahdi rather than implying otherwise once the frontend is built.
- `GET /admin/annotations/export` produces a Markdown document containing every field listed above, readable without cross-referencing anything else.
- A user without `manage_annotations` receives 401/403 from every `/admin/annotations*` route exactly like every other gated admin route in this codebase (same `requirePermission()` mechanism — not a new, separately-reasoned check).
- The native long-press capture's real-world reliability (see its named limitation above) is confirmed or refuted only by an actual device/browser pass — do not claim this is "fully working" until that happens, the same standard this project already holds every other frontend feature to.

#### 9. Local email/password accounts + role-based access control (SOURCE-COMPLETE and BUILD-VERIFIED; BUG-047's 4 issues are now all fixed and sandbox-confirmed — only a live click-through and CI confirmation remain, see 2026-09-06 thirty-third-session update below)
- **Category:** Security & Identity
- **Status as of 2026-09-06 (thirtieth session): backend and frontend are both fully built.** Backend verified end-to-end against a live PHP server + real MariaDB since 2026-09-04 (now 50/50 HTTP tests). Frontend (`RegisterScreen`/`ForgotPasswordScreen`/`ResetPasswordScreen`/`ProfileScreen`/`AdminUsersScreen`/`AdminRolesScreen`, `AuthContext`, `App.tsx` wiring) is now complete, typechecks clean, and builds clean (`npx tsc --noEmit`, `npx expo export --platform web`, `make build-deploy` all pass). **What's left is a live browser click-through** — a person tapping register→verify→login→forgot→reset→profile→admin in the actual running app — which no session has done yet. Treat as "source-complete, pending live verification" (the same status this project already uses for `BUG-025`–`BUG-028`), not as closed. Full detail: `docs/DEV_STATUS.md`, 2026-09-04 (twenty-fourth/fifth/sixth) and 2026-09-05/06 (twenty-ninth/thirtieth) session entries.
- **Request as expanded (2026-09-04, by Mahdi)**, superseding the narrower 2026-09-03 version below: full auth (register/login/logout), **link-based** email confirmation and password reset (never a copy-paste token), a profile screen where a user sees their own name/email/password (editable) and their granted access-level name (e.g. administrateur/technicien/utilisateur), and a full admin UI to create/edit/delete/replace access levels, choose which functions each level grants, and grant/revoke a given user's access level. Specific fine-grained permissions (e.g. "can add *autre réduction/augmentation*", "can edit reduction/augmentation percentages") are to be identified incrementally by Mahdi once the mechanism exists — this item's job is to make that mechanism real and admin-usable, not to pre-guess the full permission list.
- **Original request as given (2026-09-03), for history**: Google SSO deprioritized ("Google is a piece of shit for now, so we remove the button"); allow users to create their own account directly — registration, login, forgotten-password ("etcetera").
- **Done twenty-fourth session**: migration `002_add_auth_and_rbac.sql` (users/roles/permissions/role_permissions/user_identities/email_verification_tokens/password_reset_tokens/rate_limits, seeded with 3 default roles and 6 starting permissions); `userRepo.php`/`roleRepo.php`/`permissionRepo.php`/`rateLimiter.php`, all exercised against a real database (25 passing assertions) before commit. This satisfies FEAT-002's "explicit account-linking policy" requirement referenced below — see the account-linking rules in `userRepo.php`'s `resolveSsoUser()`.
- **Done twenty-fifth session**: `Guard.php` (auth/permission/CSRF), `Mailer.php` (log + smtp drivers), full `/auth/*` and `/admin/*` routing in `api/index.php`, `/clients`+`/cases` now gated behind `requireAuth()` (closes `SECURITY.md`'s "Todo #1, the single biggest gap"), Microsoft/Google OAuth callbacks rewired onto real persisted users. Verified with 42/42 passing HTTP-level tests against a live server, plus a clean `make build-deploy` + deploy-artifact check. Two real bugs were found and fixed by this testing (a missing `sessionStart()` and a test-harness cookie-jar mistake) — see DEV_STATUS.md for both, worth reading if a similar symptom resurfaces.
- **Frontend — STARTED 2026-09-05 (twenty-ninth session), NOT FINISHED**: `useAuth.ts` (full rewrite — corrected `AuthUser` type, csrfToken/notice/resetToken state, register/login/forgotPassword/resetPassword/resendVerification/changePassword/updateProfile), `useAdminApi.ts` (new — `/admin/*` client), and `LoginScreen.tsx` (local email/password form added alongside Microsoft SSO) are done. **`RegisterScreen`/`ForgotPasswordScreen`/`ResetPasswordScreen`/`ProfileScreen`/`AdminUsersScreen`/`AdminRolesScreen` do not exist yet, and `App.tsx` has not been wired to any of this** — see `docs/DEV_STATUS.md`'s twenty-ninth-session entry for the exact file list and, importantly, a **known-broken intermediate state** (the tree does not currently typecheck: `App.tsx`'s existing `LoginScreen` call is now missing required props). Do not deploy this commit as-is. Also still open: real SMTP credentials for `info@macerti.com` (the `smtp` mailer driver is written but untested against an actual server — `log` driver is what's been verified), and extending the CSRF-token mechanism to the pre-existing `/clients`/`/cases` mutating routes (deliberately scoped out two sessions ago, not forgotten).
- **UPDATE 2026-09-06 (thirtieth session)**: all six screens now exist, `App.tsx` is fully wired, the tree typechecks and builds clean, and the backend regression (50/50) was re-run to confirm nothing broke. See the status line at the top of this item and `docs/DEV_STATUS.md`'s thirtieth-session entry. The SMTP and `/clients`/`/cases` CSRF items above are still open and untouched.
- **BUG-046 found and fixed 2026-09-05** while working on this item: `src/frontend/src/api/client.ts`'s shared `request()` never sent `credentials: 'include'`, so cross-origin calls (e.g. local dev) to the now-auth-gated `/clients`/`/cases` would silently drop the session cookie. See `docs/BUGLOG.md` BUG-046.
- **BUG-047 found 2026-09-06 (thirty-first session), by Mahdi's own live click-through** — the exact live-verification step this item's status line was waiting on turned up 4 real issues rather than a clean pass: no password show/hide toggle, unbranded verification/reset emails, a 404'ing verification link, and submit-only form validation. Two (#2 email branding, #3 the 404) were worked on this session — #2 done but not visually verified; #3 root-caused and fixed, but the fix itself has NOT yet been re-verified locally (a first fix attempt was already caught and corrected once this same session — see `docs/BUGLOG.md` BUG-047 for the full trail). #1 and #4 are not started. **This item is further from closing than the thirtieth session's status line suggested** — the live click-through it was waiting on has now happened, and it did not pass clean.
- **UPDATE 2026-09-06 (thirty-second session)**: #1 and #3 fixed and closed (#3 confirmed via a fresh-DB 51/51 HTTP regression); #4 partially fixed (Register/Reset only). Build not re-verified this session (typecheck only).
- **UPDATE 2026-09-06 (thirty-third session)**: #3 independently re-confirmed from a second, separate session (fresh DB, 51/51 again). #4 now fully closed across all five auth screens. **`npx expo export --platform web` and `make build-deploy` both run clean** — the build-verification gap flagged twice in a row is closed. Version bumped 5.1.9 → 5.1.10. What's left, in full: (1) a real CI-green run on this push, not yet checked; (2) the live click-through for #1/#2/#4 that only Mahdi (or a sandbox with browser/mail-client access) can do. Full detail: `docs/BUGLOG.md` BUG-047's thirty-third-session update.

#### 12. Bug/feature tracker moved into the database (BACKEND ROUTES LIVE + TESTED — admin UI still not built)
- **Category:** Internal tooling / DevOps
- **Status:** Migration `004_add_bug_feature_tracker.sql` written, applied, and verified locally (fresh-DB migrate, 24/24 smoke, HTTP regression clean apart from one hardcoded permission-count assertion that's since been updated for the new seeded permission) as of 2026-09-07 (thirty-eighth session). **No backend API and no admin UI screen exist yet** — schema-only; next session builds on top of this migration.
- **Request, from Mahdi (2026-09-07)**: `BUGLOG.md`/`ROADMAP.md`/`DEV_STATUS.md` have grown too large to be practical to read (236KB/56KB/308KB as of this session) — replace day-to-day bug/feature status tracking with database rows an admin can query/filter/update from a UI, keeping markdown only for dev-to-dev narrative hand-off, not progress tracking.
- **Schema, as agreed across this session's chat**: `tracker_items` (one row per item — `code` as primary key, e.g. `BUG-050`/`FEAT-007`; `type`; `title`; `user_description` vs dev-filled `technical_description`; `status` [open/in_progress/fixed_unverified/verified/closed]; `priority`; `dependencies` [function/file names, plain text]; `tests_to_do`; `comments` [live remaining-work TODO, overwritten]) plus `tracker_updates` (append-only history — `item_code` FK with cascade, `done`, `next`). Full reasoning for every column and the code-as-PK choice is documented inline in the migration file itself.
- **Next steps**: backend CRUD API gated behind the new `manage_tracker` permission (mirrors `annotationRepo.php`'s shape), then an admin UI screen (list + filter by status/type/priority, detail view with the update history).
- **UPDATE 2026-09-07 (fortieth session)**: this item is now itself assigned **FEAT-010** (FEAT-007/008/009 were claimed this same session for other, unrelated ROADMAP items seeded into the tracker — see below). `src/backend/db/trackerRepo.php` (full CRUD data layer: list with status/type/priority filters, get-by-code with ordered update history, create, partial update, delete, log-an-update-with-comments/status refresh, next-free-code suggestion) written and PHP-lint-clean, but **not yet wired into `api/index.php`** — no routes exist, so this file is currently dead code with zero runtime effect. Migration `005_seed_tracker_backlog.sql` written and verified locally (fresh-DB apply, idempotent re-run, 13/13 rows + 13/13 update rows correct) — seeds the table with the actual current backlog (see its own header + `docs/DEV_STATUS.md`'s fortieth-session entry for the full list: FEAT-006, DEBT-001–004, BUG-051/052, FEAT-001/002/004/007/008/009). **Backend regression suite (`smoke_test.php`/`http_api_test.php`) was NOT run this session** — only the migration itself was verified in isolation; do not assume 24/24 or the prior HTTP count still hold without re-running them. Routes, admin UI, tests, and a `FEAT-010` tracker row for this item itself are all still to build — see `docs/DEV_STATUS.md` hand-off for the exact next steps.
- **UPDATE 2026-09-08 (forty-first session)**: all 7 routes wired into `api/index.php` (list/filter, get-by-code, create, partial update, delete, log-an-update, next-code suggestion), gated behind `manage_tracker` + CSRF, mirroring `/admin/annotations`. 17 new HTTP regression tests added. Fresh-DB baseline established first as instructed: `smoke_test.php` **24/24**, `http_api_test.php` **82/82** (65 existing + 17 new). Manually verified the full CRUD lifecycle end-to-end against a live server before writing the automated tests. Version bumped 5.1.14 → 5.2.0 on Mahdi's explicit instruction this session, even though nothing is user-reachable yet — see `CHANGELOG.md`'s forty-first-session entry for why that's flagged as a deliberate deviation from this project's own "no bump for backend-only work" convention, not an inconsistency. **Still not done**: `AdminTrackerScreen.tsx` doesn't exist — nothing is visible or usable by an actual admin yet, only reachable via direct API calls. `App.tsx`/`ProfileScreen.tsx` wiring, and a tracker row for FEAT-010 itself, still pending. Full detail: `docs/DEV_STATUS.md`'s forty-first-session entry.
- **UPDATE 2026-09-08 (forty-second session)**: no code changes. Re-confirmed the forty-first session's baseline fresh (`smoke_test.php` **24/24**, `http_api_test.php` **82/82**), then closed that same session's hand-off item 3 — full frontend verification, unrun since before the tracker work began: `npm install`, `tsc --noEmit` clean, `expo export` → 558 modules (matches last known-good count), `make build-deploy` 4/4, `check-repo-hygiene.sh` 4/4. v5.2.0 now confirmed to build clean on the frontend side, not just the backend. Read every reference file `AdminTrackerScreen.tsx` needs (`AdminAnnotationsScreen.tsx`, `useAdminApi.ts`, the full tracker route contracts, `SegmentedPicker`/`StatusPill`, the `ProfileScreen.tsx`/`App.tsx` wiring pattern) but ran out of turn budget before writing the screen itself. Full detail: `docs/DEV_STATUS.md`'s forty-second-session entry.

---

### Priority 2 (P2) — For Later (Future Backlog)

- [ ] **Rate Limiting & Input Validation Bounds**: Enforce `validationBounds` (defined in IAF parameter sets) on the backend API and add IP rate limiting (`SECURITY.md` §Todo #2 & #3).
- [ ] **FEAT-004 / BUG-029: Production Web Presence & SEO**: Branded 404 page, removal of framework defaults, canonical URLs, `robots.txt`, and `sitemap.xml`.
- [ ] **Global Case List**: Browse all calculation cases across all clients in one unified list view.
- [ ] **Extension-Site Toggle in UI**: Expose the backend-supported `isExtension` toggle in the wizard site form.
- [ ] **Custom Pull-to-Refresh Animation**: Interactive stretch/bounce feedback for mobile browsers.
- [ ] **Database Backup Automation**: Automated cron backups on the DirectAdmin host.

- [ ] **Tighten allowedOrigins**: Restrict CORS origins in `config.php` to production domain once DNS/URLs are fixed.


## Ideas / not yet requested (parked)
- Parameter admin UI (edit factor catalogue / IAF tables from a browser
  instead of editing PHP source + reseeding). Should also include: **dossier
  reference codification** — let the admin configure a numbering scheme
  (prefix and/or suffix, an incremental counter, and date-based components)
  so a new calculation's reference is generated automatically from that
  scheme rather than typed freehand each time. The generated value is what
  shows as "the calculation's number" throughout the app (client detail
  list, breadcrumbs, the report) — same role `dossierRef` already plays,
  just auto-populated from a configurable pattern instead of manual entry.
- Client-level notes/history beyond calculations (still not a CRM)
- Build the same `frontend/` as an actual installable iOS/Android app via EAS
  Build
- Quotation/pricing tool (deferred until the duration engine + UX is solid —
  arguably closer now)

## Decisions already made
- 2026-08-19: DirectAdmin confirmed as the actual host (not cPanel).
- 2026-08-19: No Node.js Selector → full PHP port. PHP + MariaDB.
- 2026-08-19: `audit-engine` (Node) and `audit-mobile` (Expo) kept as separate
  projects for reference/history — `duration_calculator/` (built from
  `audit-app/`) is the actual deployment target. **Note as of 3.0.0**: the
  Node/TS reference project's engine (`audit-engine/src/engine/`) and its
  vitest suite were NOT updated with the report-writing-per-visit fix — that
  project's tests would now report a stale/incorrect expected total if run.
  Not fixed due to time; flagged here rather than left silently inconsistent.
- 2026-08-20: Clients are explicitly NOT a CRM — name only.
- 2026-08-20: Automated day-rounding to the nearest 0.25 is deliberately
  deferred — manual adjustment only for now.
- 2026-08-20: Risk level is auto-resolved from declared sector(s) (most
  severe of however many are declared, per standard), not manually chosen.
- 2026-08-21: Traceability lives in a dedicated post-calculation report
  (Option 2), not inline next to every wizard field (Option 1) — explicit
  preference, to keep the wizard simple and dynamic during data entry.
- 2026-08-21: PDF export and a separate archival-view system are explicitly
  parked on the roadmap, not built now, per direct instruction — the
  underlying data (full input/result JSON, rounding overrides) is already
  persisted, so reconstruction is possible even without a dedicated view.
- 2026-08-30: **Reversed** the 2026-08-20/4.0.0 decision that client delete
  orphans calculations (`SET NULL`) — now cascades (`CASCADE`), deleting a
  client deletes its calculations too, per explicit instruction. Risk level
  auto-resolution (previous line) is unaffected — this is purely about
  what happens on client deletion.
- 2026-08-30: Risk level auto-resolution now has an explicit per-calculation
  override — the auto-resolved value is still the default and still shown,
  but can be changed for one specific calculation without touching the
  underlying sector data.
- 2026-08-30: Two GitHub repos track this project: `duration_calculator`
  (deploy artifact — what's actually uploaded to hosting) and
  `duration_calculator_backend` (all source — every project this effort has
  produced). An existing CI/CD workflow in the deploy repo (FTP deploy on
  push, PHP tests gating it, GitHub Secrets for credentials) was found
  already in place, inspected for safety, and preserved rather than
  overwritten.
- 2026-09-03: Microsoft SSO (BUG-036→039 saga) confirmed working end-to-end
  by Mahdi in production. The "Continue with Google" button is removed from
  the login screen (Google deprioritized for now); backend Google OAuth code
  is kept, unlinked, not deleted. Local email/password account creation
  (register/login/forgot-password) is the requested next auth-adjacent
  feature, explicitly sequenced after FEAT-005 (database migrations) — see
  items 8/9 in the Priority 1 queue above.


## Mandatory source/deployment separation

**SOURCE REPOSITORY RULE:** this repository is the source of truth and is never the deployable artifact. Every application change must be made here first, tested here, then built/packaged and published to **macerti/duration_calculator**. For PHP, the deployable tree is produced from duration-calculator-php/ (no compilation). For audit-mobile, the deployable frontend is the generated Expo web export; source-only frontend changes are not deployed until the generated artifact is published to duration_calculator. Never fix application behavior only in the deployment repository. Every hand-off must record the source commit and deployment-artifact commit, or explicitly state that deployment is pending. A task is not deployed until the corresponding artifact exists in duration_calculator and its deployment workflow has been run/passed where applicable.


## Requested feature — FEAT-001: Synthèse tabs for per-site programmes and Programme d'audit Client

**Status: NOT BUILT / REQUESTED — 2026-09-01**

- In **Synthèse**, use tabs to display the audit programme for each individual site.
- Include a dedicated tab named exactly **Programme d'audit Client** for the final consolidated client audit programme, combining the applicable sites.
- The consolidated client view and the individual site views must both remain accessible; the global tab must not replace the per-site programmes.
- Each site tab must show its complete programme and relevant duration details for that site.
- The **Programme d'audit Client** tab must show the final client-level programme with the applicable site durations combined, without double-counting.
- Multi-standard sites must retain their standard-specific duration/programme breakdown in the appropriate context.
- The consolidated view must reconcile with the underlying per-site calculation results and existing synergy/calculation rules.
- This feature must integrate with BUG-025/BUG-027: standard selection and site selection must remain correctly scoped, with no state leakage between sites or standards.
- This is a Synthèse/presentation feature. Existing calculation formulas must not be changed unless a separate calculation defect is identified and logged.

## Requested feature — FEAT-002: Sign in with Microsoft or Google (SSO)

**Status: CODE EXISTS, UNVERIFIED — 2026-09-02.** Backend (`src/backend/auth/{OAuthSession,MicrosoftOAuth,GoogleOAuth}.php`) and frontend (`LoginScreen.tsx`, `useAuth.ts`, `AuthGate`) were built in commit `3396425`, ahead of this being reprioritized per item 5/6 above and with no accompanying `docs/DEV_STATUS.md` session entry. That commit also shipped a deployment-assembly gap that took the entire production API down (not SSO-specific) — see `docs/BUGLOG.md` BUG-036, fixed 2026-09-02 (fourteenth session). The outage is fixed; **the SSO login flow itself has not been confirmed working end to end by anyone** (no real click-through, no host access from any sandboxed session) — do not treat this as done. See BUG-036's hand-off for the exact next step.

### Objective
Allow users to authenticate without creating or remembering a separate application password by offering two standard identity-provider options on the login screen:

- **Continue with Microsoft** — Microsoft account / Microsoft Entra ID SSO, using the identity platform appropriate to the application's target users.
- **Continue with Google** — Google account sign-in.

The user chooses whichever identity provider is most convenient for them.

### Required behavior
- Present both providers clearly on the login screen using their official provider identity/branding conventions.
- Use standard OpenID Connect (OIDC) authentication and the provider-supported secure authorization flow; do not implement password/token handling manually in the frontend.
- After successful provider authentication, the backend creates or resumes the application's own authenticated session.
- The application must maintain its own user record and authorization model. A provider identity is an authentication mechanism, not the application's authorization model.
- Store the minimum identity information required, such as provider, provider subject/unique identifier, verified email where available, display name, and timestamps.
- Do not store Microsoft or Google passwords, provider access tokens, or unnecessary provider data in the application's database.
- If the same verified email already has an application account, the implementation must have an explicit and secure account-linking policy rather than silently creating a duplicate user.
- Logout must terminate the application's session and handle provider logout/session behavior appropriately without assuming that logging out of this application should log the user out of their entire Microsoft/Google account.
- Protected API endpoints must continue to enforce the application's authenticated session/authorization checks regardless of which provider was used.
- The authentication flow must work on mobile and desktop browsers.
- Redirect URIs, client IDs/secrets, provider configuration, and other credentials must be environment/server configuration, never hard-coded or committed to Git.

### Security requirements
- Prefer provider-supported authentication libraries/SDKs rather than hand-rolling OAuth/OIDC requests and token validation. Microsoft recommends authentication libraries for Microsoft identity flows. citeturn0search1turn0search4
- Use authorization code flow with appropriate PKCE/OIDC protections for the application type. citeturn0search3
- Validate issuer, audience/client ID, signature, nonce/state, expiration, and relevant provider identity claims before establishing the local session.
- Apply CSRF/state protection to the login initiation/callback flow and preserve the existing session security requirements.
- Use secure, HttpOnly, SameSite-appropriate session cookies and regenerate the session ID after successful authentication.
- Rate-limit authentication endpoints and log security-relevant authentication events without logging tokens or sensitive credentials.
- Request only the minimum scopes needed for authentication/profile identification. Microsoft explicitly recommends least-privilege permissions. citeturn0search2

### Account model / migration constraint
The current security roadmap already identifies authentication as the highest-priority security gap and proposes a PHP session-based local authentication model. This SSO feature must be designed as part of that authentication architecture, not as a separate parallel authentication system. The final implementation should support provider identities through the same user/authorization model and should not create duplicate session or authorization mechanisms.

### Acceptance criteria
- Login screen offers **Continue with Microsoft** and **Continue with Google**.
- A user can authenticate successfully with either provider and reaches the same authenticated application experience.
- Existing/new users are mapped to one application account according to an explicit account-linking rule.
- No provider password is ever received or stored by the application.
- Protected API routes reject unauthenticated requests regardless of provider.
- Mobile and desktop sign-in flows work with correct registered redirect URIs.
- Invalid, expired, replayed, or mismatched authentication responses do not create a session.
- Provider secrets are supplied through secure environment/server configuration.
- Automated tests cover successful sign-in, callback validation failure, duplicate-account/linking behavior, logout, and protected API access.

### Provider references
- Microsoft identity platform supports OAuth 2.0/OIDC and SSO scenarios. citeturn0search0turn0search5
- Google Sign-In uses Google Identity Services and OpenID Connect. citeturn0search6


## FEAT-003: Application version and last-update display

**Status: COMPLETED & ARCHIVED (5.1.0 / 5.1.1)** — Built 2026-09-01, verified live. See [COMPLETED_HISTORY.md](archive/COMPLETED_HISTORY.md) for full archive.
**Requested**: 2026-09-01


### Objective

Introduce a clear, user-visible application versioning system and display the current version and source update timestamp at the bottom of the application.

### Version format

Use semantic-style three-part versioning:

**X.Y.Z**

- **X — Major version**: significant, perceptible UI/UX overhaul or major application redesign that materially changes the user experience.
- **Y — Feature version**: addition of user-visible functionality/features.
- **Z — Bug-fix version**: fixes to existing behavior, defects, regressions, or small corrective changes that do not constitute a feature or major UI overhaul.

Examples: `1.0.0` baseline, `1.0.1` bug fix, `1.1.0` feature, `1.1.1` subsequent bug fix, `2.0.0` significant UI/UX overhaul.

### Required display

At the **bottom/footer of the application**, visibly display the current application version and latest update date/time.

Example:

**Version 1.2.3 · Updated on 31 Aug 2026 at 09h48**

The visual treatment should match the existing design system and remain unobtrusive but readable.

### Update timestamp source — IMPORTANT

The displayed **Updated on** timestamp must represent the datetime of the **last edit/change to `duration_calculator_backend`**, not the user's browser/device time and not an arbitrary manually entered date.

Establish a reliable source of truth for this value. Prefer deriving it automatically from repository/build/deployment metadata rather than hard-coding it into UI source code.

Display format: `Updated on DD Mon YYYY at HHhMM` — no seconds. Use one consistent application/deployment timezone.

### Version governance

- Maintain the version in **one authoritative location**.
- Do not hard-code different versions across multiple screens/files.
- The footer consumes the authoritative version metadata.
- Every release/change increments the appropriate component according to the X/Y/Z rules.
- Classification is based on the resulting user-visible change, not internal effort.
- A feature increments Y and resets Z.
- A bug fix increments Z.
- A significant perceptible UI overhaul increments X and resets Y/Z according to normal versioning practice.
- Preserve version history in the existing changelog/release documentation.

### Acceptance criteria

- Every application screen/page displays the same current `X.Y.Z` version in the footer.
- The footer displays the automatically maintained last-update timestamp.
- The timestamp corresponds to the latest relevant `duration_calculator_backend` edit/build/deployment metadata and is not generated from the end user's local clock.
- The displayed format matches `Updated on 31 Aug 2026 at 09h48`.
- Version and timestamp remain correct after deployment without manually editing individual screens.
- Responsive/mobile layouts remain usable.
- Build/automated verification confirms the metadata is present and consistent.
- Calculation formulas and calculation behavior are unchanged.

### Priority

This is an **immediate infrastructure/UI requirement**. Implement it before treating the current lower-priority feature backlog as complete. Establish the mechanism before subsequent releases so bug fixes, features, and major UI changes can be tracked consistently.


## FEAT-004 — Production-quality web presence, metadata, routing and SEO review

**Status: REQUESTED / DISCOVERY + IMPLEMENTATION PLAN REQUIRED — 2026-09-01**
**Priority:** After the current mandatory sequence (versioning → repository architecture → user acceptance gate).

### Objective
The application currently risks presenting itself like a development/Vite/React application rather than a deliberate production product. Review the supplied production-quality requirements against the actual architecture and implement only what is technically appropriate and useful. Do not apply a generic SEO checklist blindly.

### Required review matrix

Classify every item as APPLICABLE / NOT APPLICABLE / CONDITIONAL before implementation:

- **Custom domain:** deployment concern. Confirm the intended production hostname; use it consistently for canonical URLs, metadata, redirects and deployment documentation. Do not invent a second domain.
- **Proper page source / crawlable HTML:** inspect generated HTML/source. Public content may need crawlable HTML; the private/stateful wizard does not automatically justify SSR solely for SEO.
- **Custom 404:** applicable. Invalid public routes must produce a branded 404 rather than a misleading successful application page.
- **Unique page titles:** applicable to meaningful public routes/screens. Wizard states should have sensible document titles without becoming artificial SEO pages.
- **Meta descriptions:** applicable to public/indexable pages; conditional for private wizard states.
- **Canonical tags:** applicable to public/indexable URLs. Establish one deliberate canonical production URL per public page.
- **One clear H1:** applicable to meaningful pages. Do not mechanically add duplicate H1s to wizard subviews.
- **sitemap.xml:** conditional. Include only intentionally public/indexable URLs; never client records, saved calculations, drafts or ephemeral wizard states.
- **robots.txt:** applicable. Define an intentional crawl policy and reference the sitemap if one exists.
- **llms.txt:** optional/conditional. It is a community proposal/convention, not a Google Search requirement. Implement only if useful for public agent-readable information, otherwise document why it is not needed.
- **Favicon:** applicable. Remove framework/default identity.
- **Internal links:** applicable to public navigation/content; do not create artificial SEO links inside the calculation workflow.
- **Breadcrumbs:** already partly implemented. Preserve the established wizard breadcrumb and icon-based Accueil convention; extend only where meaningful.
- **Structured data:** conditional. Use only schema types accurately describing real visible content.
- **LocalBusiness schema:** conditional. Use only if the public application/site represents the actual Macerti business and the address/contact identity is verified and visible.
- **Social share images:** applicable to public/shareable pages; conditional for private wizard states.
- **Image alt text:** applicable. Audit meaningful images for accurate accessible alternatives and mark decorative images appropriately.
- **Console errors:** applicable. Audit the real production browser and fix actual application errors/warnings; never solve this by suppressing logging.
- **Production source maps:** review/security concern. Determine whether public source maps are exposed and remove them unless there is an explicit operational reason.
- **Large JavaScript bundles:** applicable as a measured performance audit. Measure first; split/lazy-load only where justified.
- **Vite/React/default branding:** applicable. Remove framework/development identity from titles, favicon, metadata, visible content and generated HTML where unintended.
- **Placeholder content:** applicable. Audit production-visible text/assets for demo or developer placeholders.

### Critical routing question — wizard URL strategy
The application currently behaves as a stateful wizard where phases do not necessarily change URL/slug. **Do not automatically convert every wizard phase into a URL.**

The developer must determine:

1. Private/stateful calculation workflow screens can appropriately remain within one application route; exposing ephemeral state in indexable URLs is not inherently beneficial.
2. Public, meaningful, shareable pages should have stable URLs and may use browser History API/router navigation.
3. If routes are introduced, direct loading, refresh, browser back/forward, persistence, authorization and server fallback must all work.
4. Never put client IDs, calculation data, draft state or sensitive parameters into URLs.
5. Do not make ephemeral wizard states indexable merely because they have URLs.
6. If the SPA uses History API navigation, use it deliberately for meaningful navigation, deep links, back/forward behavior and analytics rather than adding routes solely for SEO. Google documents History API navigation for SPA screen changes. citeturn0search8

### Public vs private indexing boundary
Define explicitly:

**Public/indexable surface:** brand, product/service information, help/documentation and other content intentionally intended for discovery.

**Application/private surface:** client list, client details, calculation wizard, saved calculations and sensitive/ephemeral data. These must not be placed in the public sitemap or exposed to crawlers merely to satisfy an SEO checklist.

Canonical URLs are a preference signal, not a substitute for coherent URL architecture. citeturn0search0

### Acceptance criteria
- No unintended Vite/React/framework-default identity remains in production UI, HTML title, favicon or metadata.
- Branded 404 exists and invalid public URLs behave correctly.
- Public pages have deliberate titles, descriptions, canonical URLs and appropriate headings.
- robots.txt has an intentional policy; private application routes are not accidentally advertised as indexable content.
- sitemap.xml contains only intentionally public/indexable URLs.
- llms.txt is either implemented accurately or explicitly rejected with a documented rationale.
- Breadcrumbs remain consistent with the existing wizard navigation design.
- Structured data is accurate and validated where used.
- Public social metadata/images and image accessibility are correct.
- Production browser console is clean of application errors.
- Public production source maps are not exposed without a documented reason.
- Production JavaScript bundle size is measured and optimization is evidence-based.
- No placeholder/development content remains.
- Routing strategy is documented and tested for direct load, refresh, back/forward and invalid routes where applicable.
- No calculation formulas, business rules or sensitive application data change as a side effect.

### References
Google documents canonical URLs as a preference signal and robots.txt sitemap declarations. citeturn0search0turn0search13 The llms.txt specification is a community proposal; Google states it is not required for Search. citeturn0search1turn0search2

#### 11. Admin screens: permissions-list layout + desktop width utilization (NEW — raised via live annotation, 2026-09-07 thirty-eighth session, `docs/BUGLOG.md` BUG-050 #6)

- **Category:** UX / Technical Debt
- **Status:** Logged, not started. Root cause confirmed (see below); redesign direction not yet decided — needs a design pass, not a quick fix.
- **Request, verbatim (annotation, `AdminRoles`, 2026-09-07):** *"the layout here is trash roles and permissions should be layouted differently not a big list, use tabs or something come on dude also why in desktop you dont exploit the width of the screen making the whole app fit in a tight vertical phonelike space?"*
- **Confirmed this session:** `AdminRolesScreen.tsx` renders roles and permissions as a flat, repeated list of role-cards, each expanding to show every permission as its own row/checkbox — no grouping, no tabs, no matrix view. Separately, `ResponsiveContainer`'s `maxWidth` is capped at 640–800px on `AdminRolesScreen`, `AdminUsersScreen`, `AdminAnnotationsScreen`, `ProfileScreen`, and `HomeScreen` — vs. 900–1100px on `CalculationReportScreen`/`CalculationWizardScreen`. On any screen wider than the cap, the app deliberately letterboxes itself into a narrow centered column even on a full desktop monitor — this is `ResponsiveContainer`'s designed behavior (see its own doc comment), not a bug in the component itself, just a per-screen `maxWidth` choice that reads as cramped once a screen has enough content to want the room (a role/permission matrix being the clearest case).
- **Two separable pieces of work, not necessarily one PR:**
  1. **Quick, low-risk:** raise `AdminRolesScreen`'s (and possibly `AdminUsersScreen`'s) `maxWidth` closer to `CalculationWizardScreen`'s 1100px, giving the existing list more breathing room without changing its structure at all. Safe to do in isolation, verifiable with `tsc` alone.
  2. **Real redesign, needs a decision before code:** replace the flat role-card list with something that scales better for N roles × M permissions — a tabbed-per-role view (one role visible at a time, permissions as toggles) or a proper matrix/grid (roles as columns, permissions as rows, checkboxes at intersections) are the two directions the annotation itself suggests. This changes both the visual design and the interaction model, not just spacing/tokens — treat it as its own scoped session with a clear before/after description, not something to improvise mid-way through an unrelated fix.
- **Not attempted this session** — flagged rather than guessed at, consistent with this project's own standing rule not to redesign UI blind without live device feedback on the result.
