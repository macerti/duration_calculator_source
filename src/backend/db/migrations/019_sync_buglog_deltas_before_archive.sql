-- Audit Duration Engine -- sync 4 tracker_items rows that had genuine
-- post-archival additions in docs/BUGLOG.md never carried back into the
-- DB after migration 008 (found by scripts_tmp/archive_md_logs.php's
-- verification pass, comparing docs/BUGLOG.md text against the live
-- tracker_items table entry by entry): BUG-017, BUG-023, BUG-027,
-- BUG-050 each have substantially more text in docs/BUGLOG.md today
-- than migration 008 originally captured (deltas of roughly 1.3KB,
-- 1.2KB, 16KB, and 7KB respectively) -- follow-up "Update, same day"
-- sections and similar were appended to docs/BUGLOG.md by later
-- sessions and never synced to the row migration 008 created. All 45
-- other entries verified character-for-character identical (modulo a
-- single trailing newline) and needed no update.
-- Migration: 019_sync_buglog_deltas_before_archive
-- Created: 2026-09-13
-- Author: Claude (dev session, 2026-09-13, fifty-eighth session)
--
-- This migration exists specifically so docs/BUGLOG.md can be safely
-- deleted afterward with zero content loss -- see this session's
-- hand-off for the full log-unification story. Uses UPDATE, not INSERT
-- ... ON DUPLICATE KEY, since these 4 rows already exist from migration
-- 008; an unconditional UPDATE is safe/idempotent here since the new
-- text is always docs/BUGLOG.md's own content as of this migration, so
-- re-running this migration twice is harmless (same final value both
-- times).

UPDATE tracker_items SET technical_description = '## NACE routes return 404 under PHP built-in dev server; cause unclassified
- **Detected**: 2026-08-31 while testing the NACE API routes.
- **Test performed**: GET /nace/search?q=... and GET /nace/:code against PHP\'s built-in development server.
- **Observed**: both returned **404 Not found**.
- **Current hypothesis**: request-path stripping is dropping the nace segment.
- **Investigation state**: a debug endpoint to expose SCRIPT_NAME and REQUEST_URI was being prepared, but the investigation stopped before it was completed. This is therefore not yet classified as a router regression.
- **Not done**: no root cause confirmed; no code fix confirmed; no production Apache/DirectAdmin behavior tested for this finding.
- **Required next evidence**: capture SCRIPT_NAME and REQUEST_URI, expose the derived path after stripping, compare a failing NACE route with a known-good route, and compare PHP built-in-server behavior with the intended Apache .htaccess topology.
- **Dependency warning**: before changing shared routing, read BUG-003 and ORIENTATIONS.md; the two-folder audit-app/backend/public/index.php topology and the single-folder deployment router intentionally use different path conventions.
- **Evidence level**: VERIFIED for the 404 observations; HYPOTHESIS for the path-stripping cause; OPEN for classification.

## Open / not yet hit
_(first real deploy to the actual DirectAdmin host is still next. Also open:
empirical confirmation of BUG-010\'s fix, and visual confirmation of the
report screen, the shake animation, the undo toast\'s progress bar, the new
site/siège labeling, and the synergy matrix UI in an actual browser — all
blocked on tooling availability in this sandbox, not skipped by choice, see
ROADMAP.md)_


## Mandatory source/deployment separation

**SOURCE REPOSITORY RULE:** this repository is the source of truth and is never the deployable artifact. Every application change must be made here first, tested here, then built/packaged and published to **macerti/duration_calculator**. For PHP, the deployable tree is produced from duration-calculator-php/ (no compilation). For audit-mobile, the deployable frontend is the generated Expo web export; source-only frontend changes are not deployed until the generated artifact is published to duration_calculator. Never fix application behavior only in the deployment repository. Every hand-off must record the source commit and deployment-artifact commit, or explicitly state that deployment is pending. A task is not deployed until the corresponding artifact exists in duration_calculator and its deployment workflow has been run/passed where applicable.' WHERE code = 'BUG-017';

UPDATE tracker_items SET technical_description = '## Production migration halts with errno 121 on `calculation_cases`, which is also the root cause of "cannot save a calculation" reported the same day

- **Detected**: 2026-09-01, reported directly by the user via a phpMyAdmin error pasted verbatim: `EXECUTE stmt2` fails with `ERROR 1005 (HY000): Can\'t create table \'macerti_audit_calc\'.\'calculation_cases\' (errno: 121 "Duplicate key on write or update")`, alongside a separate-seeming report that calculations could not be saved from either the first wizard step or the final save button.
- **Root cause (migration)**: `db/schema.sql`\'s FK-CASCADE-upgrade block built a single `ALTER TABLE calculation_cases DROP FOREIGN KEY <name>, ADD CONSTRAINT <same name> FOREIGN KEY ...` statement. MariaDB/InnoDB checks the new constraint name against the schema\'s constraint-name dictionary before the drop in the same statement is considered final, so dropping and re-adding a foreign key **under the identical constraint name in one ALTER TABLE statement** always fails with errno 121 — on every database where the FK already exists, i.e. exactly the "already migrated once" case this guard exists for. Reproduced exactly (same error text, same failing statement) by building a local database in the pre-CASCADE state (FK `fk_calculation_cases_client` present with the default RESTRICT rule) and running the unmodified migration against it.
- **Root cause (save failures) — same incident, not a separate bug**: because `EXECUTE stmt2` is a fatal error, phpMyAdmin/the mysql CLI stop there — the migration\'s final block (`stmt3`, adding the `wizard_state_json` column) never runs. `db/calculationCaseRepo.php`\'s `saveCalculationCase()` unconditionally includes `wizard_state_json` in every `INSERT`, so with that column missing, **every** save attempt — the initial-draft save on entering the wizard *and* the explicit save button — fails with `Unknown column \'wizard_state_json\' in \'INSERT INTO\'`. Reproduced by building the exact pre-fix production end-state (FK present, non-CASCADE, `wizard_state_json` absent) and running the real `saveCalculationCase()` INSERT against it: same "Unknown column" error. Confirmed the fixed migration resolves both the errno 121 and the missing column in one pass, after which the same INSERT succeeds.
- **Fix applied**: split the FK-CASCADE upgrade into two separate `ALTER TABLE` statements/executions (drop in one, re-check, add in another — never combined), so `stmt3` is reached and `wizard_state_json` gets added. Also added two additional self-healing guards for related partial-migration states that could otherwise get permanently stuck: (a) the `idx_calculation_cases_client_id` index is now checked and (re-)added independently of the column-add step; (b) the FK-add step now re-checks for an FK\'s existence right before adding one, so a database whose FK was removed entirely (by any means) gets a fresh one instead of silently staying without it.
- **Verification method**: four scenarios run locally against real MariaDB — (1) fresh empty database, (2) the exact reported broken state, (3) re-running the fixed migration twice in a row on an already-fixed database (idempotency), (4) column present but FK entirely absent (self-heal edge case). All four pass; scenario (2) additionally confirmed the previously-failing `INSERT` now succeeds once the migration completes.
- **Delivered to the user**: a standalone, ready-to-paste file beginning with `USE macerti_audit_calc;` containing the complete corrected migration, verified against a simulated fresh mysql session with no database pre-selected (matching how it will be run — pasted directly into phpMyAdmin).
- **Evidence level**: VERIFIED root cause, VERIFIED fix, both reproduced and re-tested end-to-end locally (not yet confirmed against the actual production `macerti_audit_calc` database — that happens when the user runs the delivered file).

### BUG-024 (not a bug — recorded UX decision) — Replaced the end-of-wizard "Enregistrer" button with a persistent small save button in the header, available on every step

- **Requested**: 2026-09-01, by the user directly: the large "Enregistrer" button previously shown only at the bottom of the Synthèse (last) step should be removed, replaced by a small save control available across all wizard phases.
- **Implemented**: `audit-mobile/src/screens/CalculationWizardScreen.tsx` — added a small round icon button (save icon / spinner while saving) in the shared header row next to the "Enregistré HH:MM" indicator, which is rendered above the step content on every step, not just Synthèse. It calls the same `save()` function the old button used, choosing status `"calculated"` if a result has already been computed (i.e. the same condition the old button represented) or `"draft"` otherwise, so the meaning of the action is unchanged — only its availability and placement changed. The old bottom-of-Synthèse button and its now-unused style were removed.
- **Verified**: `npx tsc --noEmit` clean, `npx expo export --platform web --clear` succeeds after the change.' WHERE code = 'BUG-023';

UPDATE tracker_items SET technical_description = '## 2026-09-01 deploy test: multi-site Facteurs flow and Synthèse duration presentation

- **Detected**: 2026-09-01 during deployment interaction testing.
- **Evidence level**: REPORTED / CODE-INSPECTED. Runtime fixes are not yet implemented or verified.

#### 1. Multi-site Facteurs phase starts on the wrong site
- **Observed behavior**: when processing multiple sites, entering the **Facteurs** phase opens directly on the last site instead of starting with the **Siège** and then progressing through the sites in order.
- **Expected flow**:
  1. Start on **Siège**.
  2. Present each site sequentially, one by one.
  3. For each site, allow the user to enter the Facteurs information if applicable, or explicitly skip that site\'s factors.
  4. After the sites have been processed/skipped, proceed to **Calculer**.
- **Important UX requirement**: the application should guide the user through the sites sequentially. The user should not have to discover/navigate tabs manually to find which site still needs factors.
- **Calculate action**: do not expose the final calculation as the only immediate action while sites still need to be processed. The flow should lead the user through Siège → Site 1 → Site 2 → … and then present/enable **Calculer** after the factors step is complete or skipped as appropriate.
- **Regression case**: test with Siège + 2+ sites and verify the initial active tab is Siège, followed by each site in declared order.

#### 2. Synthèse: replace generic "Total jour à auditer" with useful annual per-site detail
- **Observed / requested change**: the global **Total jour à auditer** value in Synthèse is not useful enough as currently presented.
- **Required presentation**: show, **per year and per site**, the **total audit duration**, with a breakdown of the duration **per standard**.
- The presentation should make it possible to understand how the annual total for each site is composed by standard, rather than only exposing one aggregated "Total jour à auditer" number.
- Preserve the underlying calculation results; this is a Synthèse information-architecture/presentation change unless implementation proves the data itself is missing.
- **Multi-site regression case**: verify each site has its own annual total and standard-by-standard duration details, and that values are not mixed between sites.

#### 3. Numeric duration controls: + / − increments and manual typing
- **Observed behavior**: the current **+ / −** controls can produce unexpected/weird values.
- **Expected behavior**:
  - + increases the value by exactly **0.01**.
  - − decreases the value by exactly **0.01**.
  - The user can manually type a value directly into the field.
  - Values must remain numerically valid and should not acquire malformed floating-point artifacts through repeated increments/decrements.
- Apply the correction to the affected numeric duration controls without changing unrelated numeric fields.
- **Regression examples**: 1.00 → + → 1.01; 1.01 → − → 1.00; manually type 2.35; repeated +/- operations must remain at two-decimal precision.

#### 4. Remove bottom "Retour" from Synthèse
- **Observed behavior**: Synthèse currently contains a bottom **Retour** button.
- **Required behavior**: remove this redundant button.
- Navigation is already available through the top **phases progress** navigation and the **breadcrumb**. Do not create a third back-navigation mechanism.
- This aligns with BUG-025, which already requires the report/navigation experience to follow the breadcrumb hierarchy rather than using separate back controls.

#### Implementation / verification order
1. Correct Facteurs multi-site sequencing and initial Siège selection.
2. Correct + / − numeric behavior and preserve manual typing.
3. Redesign Synthèse duration presentation to annual totals per site with per-standard breakdown.
4. Remove the redundant Synthèse bottom Retour button.
5. Test single-site and multi-site flows, including multiple standards per site.
6. Run TypeScript/build checks and verify the actual deployed mobile/browser interaction before marking the findings VERIFIED.

---

### 2026-09-01 (second session) — BUG-025 #1/#2/#3 and BUG-026 fixed; BUG-027 #3 partially fixed; BUG-027 #4 fixed

**Environment available to this session**: no PHP, no MariaDB, no browser/device. `node`/`npm`/`npx` available with network access to the npm registry. Evidence below is therefore capped at STATICALLY VERIFIED / BUILD-VERIFIED, never VERIFIED (no real interaction test was possible). Do not upgrade these to VERIFIED without an actual browser/device pass.

**BUG-025 #3 — root cause found (not merely hypothesis) and fixed.**
The Synthèse per-site standard tab read `stdTab`, a value derived from `activeStandardTab` scoped to `activeSite` (`sites[activeSiteIndex]`) — i.e. whichever site was last active during the **Facteurs** step, not the site being rendered in the Synthèse loop. Two concrete consequences, confirmed by reading the derivation at the old line 345 (`stdTab = activeStandardTab && activeSite.activeStandards.includes(activeStandardTab) ? activeStandardTab : activeSite.activeStandards[0]`) against the Synthèse render loop:
  - Tapping a second-standard tab for a Synthèse site other than the Facteurs-active one had no visible effect whenever the Facteurs-active site\'s own standards didn\'t include the tapped standard — `stdTab` fell back to the Facteurs-active site\'s first standard regardless of the click.
  - Even where a click "worked," the single shared state meant selecting a standard for one site could change the displayed standard for a different site that happened to also offer it — the exact multi-site leak the bug report warned against.
  - **Fix**: added `syntheseStandardTabBySite: Record<string, StandardCode>`, keyed by `siteResult.siteId`, fully independent of the Facteurs-step `activeStandardTab`/`stdTab`. Each Synthèse site row now resolves and sets its own entry.
  - **File**: `audit-mobile/src/screens/CalculationWizardScreen.tsx`.

**BUG-025 #2 — fixed.**
`Breadcrumbs.tsx` only ever rendered text; the wizard rendered "Accueil" as a separate `Ionicons` "home-outline" button entirely outside the breadcrumb trail, while `ClientsListScreen`/`ClientDetailScreen` rendered "Accueil" as a plain-text breadcrumb item. Extended the `Crumb` type with an optional `icon` field (rendered via the same `Ionicons` glyph used elsewhere) and switched all three screens to the same icon-crumb for "Accueil." No emoji was ever present in source for this control — the divergence was icon-button-outside-breadcrumb vs. text-inside-breadcrumb, both now unified into one icon-crumb.
  - **Files**: `audit-mobile/src/components/Breadcrumbs.tsx`, `CalculationWizardScreen.tsx`, `ClientsListScreen.tsx`, `ClientDetailScreen.tsx`.

**BUG-025 #1 — fixed.**
`CalculationReportScreen` had no breadcrumb and relied on the native stack header\'s default back arrow (`headerShown` was not set to `false` for that route, unlike every other in-app screen). Added a `Breadcrumbs` row identical in structure to the wizard\'s (home icon → Clients → client name → dossier ref → "Rapport" as the current/non-pressable crumb), set `headerShown: false` for the `CalculationReport` route in `App.tsx`, and used `navigation.goBack()` for the "return to calculation" crumb (correct here because the report is reached by a stack **push** from the wizard, so `goBack()` restores the exact in-progress wizard state rather than resetting it). Added `clientId` to the `CalculationReport` route params (needed to reconstruct the "Clients"/client-name crumb targets) and threaded it through the `navigation.navigate("CalculationReport", ...)` call site.
  - **Files**: `App.tsx`, `CalculationReportScreen.tsx`, `CalculationWizardScreen.tsx`.
  - **Scope discipline**: report content/calculation logic in `CalculationReportScreen.tsx` was not touched, per the bug\'s scope warning.

**BUG-027 #4 — fixed.**
Removed the Synthèse step\'s own bottom "Retour" button (`CalculationWizardScreen.tsx`, previously just before the closing of the `synthese` step block). `StepTabs` (rendered above the step content on desktop, and as a fixed bottom bar on mobile, independent of `currentStep`) already provides navigation back to "Facteurs" on every platform, confirmed by reading its render conditions (`{!isMobile && <StepTabs .../>}` near the top of the step content, `{isMobile && <StepTabs .../>}` after the `ScrollView`) — the removal does not remove the only path back.

**BUG-027 #3 — PARTIALLY fixed. The increment-precision half is done; manual typing is still missing.**
`RoundingStepper`\'s `nudge()` already rounded via `Math.round((value + delta) * 100) / 100`, which is float-drift-safe for two-decimal precision — the actual defect in the +/- behavior was simply that every Synthèse call site relied on the component\'s default `step` of `0.25` (a quarter-day) instead of the requested `0.01`. Added `step={0.01}` to all 5 `RoundingStepper` invocations in the Synthèse step (Étape 1, Étape 2, Rédaction du rapport ×2 including the per-year loop, Visite sur site).
  - **Still open, do not mark this sub-bug closed**: re-reading `RoundingStepper.tsx` while writing this entry shows the value is rendered as a plain non-editable `<Text>{safeValue.toFixed(2)}</Text>`, not a `TextInput`. The bug\'s second requirement — "the user can manually type a value directly into the field" — is **not implemented at all**, in this session or any prior one found in this log. Next developer: convert that `Text` to an editable numeric `TextInput` (handle comma-vs-period decimal input, reject non-numeric characters, commit on blur/submit, and keep the existing +/- buttons and the 0.001-tolerance "adjusted" comparison working against whatever the field currently holds while being typed into).
  - **File**: `CalculationWizardScreen.tsx` (call sites); `RoundingStepper.tsx` itself still needs the typing capability added.

**BUG-026 — root cause found and fixed.**
Siège/site "Nom" and "Adresse" fields were built with the shared `NumberField` component, which hardcodes `keyboardType="numeric"` — correct for calculation inputs, wrong for free-text business fields. Added a new `TextField` component (`keyboardType="default"`, `autoCapitalize="sentences"`, no numeric suffix support since none is needed) and swapped it in for exactly those two fields. No other `NumberField` usage was changed, so genuinely numeric fields elsewhere keep numeric-only validation as required.
  - **Files**: new `audit-mobile/src/components/TextField.tsx`; `CalculationWizardScreen.tsx` (site name/address fields only).

**VERIFICATION PERFORMED THIS SESSION (real, not assumed)**
- `npm ci` in `audit-mobile/`: clean install, 515 packages, no errors.
- `npx tsc --noEmit`: **zero errors** against the full changed tree (Breadcrumbs, both client screens, the wizard, the report screen, App.tsx, the new TextField component).
- `npx expo export --platform web --clear` with a placeholder `EXPO_PUBLIC_API_URL`: **succeeded**, produced `dist/index.html`, a single web JS bundle, and all expected assets — this is the same build step CI runs before publishing, so the change is known to actually bundle for production, not just typecheck.

**NOT DONE / explicitly still open**
- No real browser/device interaction test was performed (no such environment was available here). In particular:
  - BUG-025 #3\'s fix is a source-level correction of a confirmed logic error, but the actual tap-to-switch interaction on a real Synthèse screen with 2+ sites × 2+ standards has not been clicked through.
  - BUG-027 #3: manual typing into the stepper value is **not implemented** (see the BUG-027 #3 entry above) — this sub-bug must stay open, not just unverified.
- BUG-025\'s own step-navigation "Retour" (Facteurs step, not Synthèse) was intentionally left alone — out of scope for BUG-027 #4\'s specific wording.
- BUG-027 #1 (Facteurs multi-site sequencing/initial-Siège-selection) and BUG-027 #2 (Synthèse annual/per-standard total presentation) are **untouched** — not started, do not assume any part of them is addressed by this session\'s commit.
- Backend (`duration-calculator-php/`) was not touched or tested this session — no PHP/MariaDB was available in this sandbox. BUG-004\'s backend persistence status from the prior session (16/16 HTTP suite pass) is unaffected and unchanged.
- Per the mandatory source/deployment separation rule: none of this is deployed. The change exists only in the source repository until `build-test-publish.yml` runs and publishes to `macerti/duration_calculator`.

**Dependency / hand-off**: next developer with real device/browser access should run through BUG-025\'s "Incremental implementation / verification order" step 3-6 checklist to upgrade these from STATICALLY/BUILD-VERIFIED to VERIFIED, then tackle BUG-027 #1/#2 (fully open) and the still-missing manual-typing capability for BUG-027 #3.

---

### 2026-09-01 (third session) — BUG-027 #1, #2, #3 all addressed (source only); BUG-027 now fully source-complete pending device verification

**Environment available to this session**: no PHP, no MariaDB, no browser/device — identical constraint to the second session. `node`/`npm`/`npx` available with npm-registry network access. Evidence below is capped at STATICALLY VERIFIED / BUILD-VERIFIED for the same reason.

**BUG-027 #3 — now FULLY fixed (increment precision was already done; manual typing added this session).**
`RoundingStepper.tsx`\'s value display was a non-editable `<Text>`. Replaced it with a controlled `TextInput`:
  - Local `text` state mirrors the committed value except while the field is focused, so external updates (+/-, reset, guide-apply) don\'t clobber an in-progress edit, and an in-progress edit isn\'t lost on every parent re-render.
  - Accepts comma or period as the decimal separator (normalizes `,`→`.` on commit); strips non-numeric characters as typed.
  - Commits on blur or submit via the same `Math.max(0, Math.round(parsed*100)/100)` used by `nudge()`, so typed and stepped values can never diverge in rounding precision.
  - Invalid/empty input reverts to the last valid value instead of propagating `NaN` or leaving the field blank.
  - **File**: `audit-mobile/src/components/RoundingStepper.tsx`.

**BUG-027 #1 — fixed: Facteurs multi-site sequencing and initial Siège selection.**
Root cause: `activeSiteIndex` is shared state across the Effectif and Facteurs steps. Effectif lets the user freely switch site tabs (including via the "Aller à l\'effectif de …" jump button), and whichever site was last active there stayed active when Facteurs opened — this is exactly the reported "opens on the last site instead of Siège."
  - Added a `prevStepRef`-guarded `useEffect` that resets `activeSiteIndex` to `0` only on the transition **into** `"factors"` (from any other step, whether via the "Continuer" button or a direct step-tab click) — it does not fire on renders while already in the step, so it can\'t fight the new in-step navigation below.
  - Replaced the Facteurs step\'s fixed "Retour / Calculer" footer with sequential navigation when `sites.length > 1`: "Retour" becomes "Précédent (‹site name›)" and steps backward through sites before finally returning to Effectif at index 0; the forward button reads "Site suivant — ‹next site name›" until the last site, where it becomes "Calculer" — so Calculer is only ever the immediate action once every site has been reached.
  - Clicking "Site suivant" without entering any factors is the "explicit skip" the bug asked for — Facteurs entry has no validation gate, so there was nothing else to build for that requirement. The existing site-tab row is left in place for direct jumps; sequential buttons are the new *guided default*, not the only path.
  - Single-site cases (Siège only) are unaffected: `activeSiteIndex < sites.length - 1` is `0 < 0` → false, so "Calculer" still shows immediately, same as before.
  - **File**: `audit-mobile/src/screens/CalculationWizardScreen.tsx`.

**BUG-027 #2 — fixed: Synthèse annual/per-standard breakdown, added per site.**
Added a "Récapitulatif annuel" block to each site\'s Synthèse card, below the existing per-standard detail. For every year found across that site\'s standards, it shows the year\'s **total** (summed across all active standards) and, when more than one standard is active, a per-standard breakdown line.
  - Derived entirely from the same `getRounded(roundKey(...))` values already driving the `RoundingStepper`s and the pre-existing grand `finalTotal` — it cannot disagree with either, since it performs no new calculation, only re-aggregates by year instead of only by the single global sum.
  - Keyed by year number (via a `Map`) rather than assuming every standard\'s `.years` array has the same length, in case cycle length ever legitimately differs per standard.
  - The pre-existing single "Durée totale à auditer" grand total at the bottom of Synthèse was **left in place** — it\'s still a legitimate all-sites-all-years figure (e.g. for overall quoting) and the bug\'s own wording only asked to add the missing per-site/per-year/per-standard detail, not remove the aggregate.
  - **File**: `audit-mobile/src/screens/CalculationWizardScreen.tsx` (new derived block + 7 new style entries).

**VERIFICATION PERFORMED THIS SESSION (real, not assumed)**
- `npm ci` in `audit-mobile/`: clean install, 515 packages, no errors.
- `npx tsc --noEmit`: zero errors against the full changed tree (`RoundingStepper.tsx`, `CalculationWizardScreen.tsx`).
- `npx expo export --platform web --clear` with a placeholder `EXPO_PUBLIC_API_URL`: succeeded twice (once per round of changes), producing `dist/index.html` and a single web JS bundle each time.
- Spot-checked the built bundle for the new UI strings ("Site suivant", "Précédent (", "Récapitulatif annuel") to confirm the changes are actually on the shipped code path, not just typechecking in isolation.

**NOT DONE / explicitly still open**
- No real browser/device interaction test was performed (same environment gap as every prior session). In particular:
  - BUG-027 #1\'s sequential flow and Siège-first entry have not been clicked through on a real multi-site case.
  - BUG-027 #2\'s annual breakdown has not been visually checked for a site with 2+ standards and a multi-year cycle (e.g. `cycleYears=3`) to confirm the layout reads well, only that it renders without error and the numbers are correctly derived from source.
  - BUG-027 #3\'s typed-input UX (decimal keyboard behavior, comma/period handling in a real browser vs. native app) is untested interactively.
- Backend (`duration-calculator-php/`) was not touched or tested this session — still no PHP/MariaDB available in this sandbox.
- Per the mandatory source/deployment separation rule: none of this is deployed. The change exists only in the source repository until `build-test-publish.yml` runs and publishes to `macerti/duration_calculator`.

**Dependency / hand-off**: BUG-027 is now source-complete (#1/#2/#3/#4 all addressed) but entirely at STATICALLY/BUILD-VERIFIED evidence level. The next developer with real device/browser access should click through all four sub-bugs with a case containing Siège + 2 sites × 2+ standards each, paying particular attention to: (a) whether "Site suivant" reads naturally as a skip action or whether product wants an explicitly labeled "Passer" button instead; (b) whether the annual breakdown\'s placement (per-site, below the standard-tab detail) is the right information architecture, or whether product wants it surfaced more prominently (e.g. always-visible instead of requiring standard-tab context); (c) BUG-025\'s own outstanding device-verification checklist, which this session did not re-touch.



## 2026-09-01 — Delivery priority / acceptance gate

The active sequence is: FEAT-003 versioning → repository architecture consolidation → real user/browser/mobile feedback gate → remaining bugs → remaining requested features. BUG-025/026/027 source fixes require real user acceptance before definitive closure. Record user feedback as USER-ACCEPTED, REOPENED, NEW BUG, or CHANGE REQUEST.' WHERE code = 'BUG-027';

UPDATE tracker_items SET technical_description = '## First real live-annotation batch (8 items, two admins, one sitting): navigation double-chrome, unreachable/unscrollable Profile, save-button position jump, export filename collision, and annotation element-reference blind spot

- **Reported by**: Mahdi AIBA (annotations #1–#5) and a second admin, "Mail Certi" (annotations #6–#8), via the FEAT-006 annotation tool itself, then exported (BUG-049\'s own export path) and handed to this session as `annotations-open__1_.md`. This is the first time the annotation feature has actually been used for its intended purpose end-to-end — worth noting on its own: BUG-049\'s fix and BUG-049/FEAT-006\'s build-verification both held up under real use.
- **Mahdi separately reported, before the export was even read**: he couldn\'t find the annotation-export screen at all on a prior pass — turned out to be BUG-050 #1 below (Profile couldn\'t scroll), not a missing feature. Worth recording as its own lesson: "I can\'t find X" and "X doesn\'t exist" are different reports, and this project\'s own logs should keep treating them as different until confirmed which one it is.

#### #1 — Profile — "Cant scroll"
- **Root cause**: `ProfileScreen.tsx` wrapped its entire form (account summary, editable profile, password change, and — gated — the admin entry-points card, plus logout) in a plain `<View style={styles.container}>`, never a `ScrollView`. On any viewport shorter than the combined content height, everything past the fold was completely unreachable — including the "Gérer les annotations" button, which is why Mahdi originally couldn\'t find annotation export at all (see note above): it was never missing, just permanently below an unscrollable fold.
- **Confirmed systemic scope before fixing**: grepped every screen for `ScrollView`/`FlatList` usage. `AdminAnnotationsScreen`, `AdminRolesScreen`, `AdminUsersScreen`, `CalculationReportScreen`, `CalculationWizardScreen` already correctly use one of the two. `HomeScreen`, `LoginScreen`, `RegisterScreen`, `ForgotPasswordScreen`, `ResetPasswordScreen` don\'t, but their content is short and fixed — checked `HomeScreen` specifically (title + subtitle + one CTA button) and confirmed no overflow risk. `ProfileScreen` was the one real outlier.
- **Fix**: `ProfileScreen.tsx`\'s outer `<View>` is now a `<ScrollView style={styles.container} contentContainerStyle={styles.scrollContent}>`, with the old `container` style\'s `padding`/`paddingBottom` moved onto the new `scrollContent` (a `ScrollView`\'s own `style` prop sizes the scrollable viewport, not its content — padding belongs on `contentContainerStyle`, not `style`, or it does nothing visually while still being present in the style object).

#### #2 — Profile — "Dont need this header and back button anywhere on app" / #3 — ClientsList — "Dont want this header, also where is profile?"
- **Root cause, one mechanism behind both reports**: `App.tsx`\'s `Stack.Navigator` left React Navigation\'s default native-stack header (title text + OS-style back chevron) enabled on every screen except `CalculationWizard`/`CalculationReport` (which already set `headerShown: false`). Every other screen — `ClientsList`, `ClientDetail`, `Profile`, `AdminUsers`, `AdminRoles`, `AdminAnnotations` — renders its **own** `<Breadcrumbs>` component immediately inside that native header, meaning every one of those screens showed two stacked pieces of navigation chrome: React Navigation\'s native bar on top, this app\'s own breadcrumb trail directly under it. Separately, `navigation.navigate("Profile")` was only ever reachable from a "Profil" text link in `HomeScreen`\'s own `headerRight` — the *only* entry point into Profile in the entire app. The moment a user left Home (e.g. straight into `ClientsList`, the app\'s very next screen), that link was gone and there was no other way back to Profile short of resetting all the way to Home first. `AdminUsersScreen`/`AdminRolesScreen`/`AdminAnnotationsScreen` had separately already worked around this by adding their own mid-trail `{ label: "Profil", onPress: ... }` breadcrumb item — `ClientsList`/`ClientDetail`/`CalculationWizard`/`CalculationReport` had not.
- **Fix, two parts**:
  1. `App.tsx`: added `headerShown: false` to `ClientsList`, `ClientDetail`, `Profile`, `AdminUsers`, `AdminRoles`, `AdminAnnotations` — every screen now has exactly one navigation chrome (its own `Breadcrumbs`), matching the pattern `CalculationWizard`/`CalculationReport` already used. `HomeScreen` was deliberately left alone: it\'s the root screen (no "back" concept applies), doesn\'t render `Breadcrumbs` at all, and wasn\'t the subject of either report.
  2. `Breadcrumbs.tsx`: added an optional `onProfilePress` prop. When passed, it renders a small right-aligned profile icon (`person-circle-outline`, pushed to the far right via `marginLeft: "auto"` on its own wrapper so it never disturbs the existing crumb-trail layout), giving every screen a persistent, one-tap path to Profile now that the native header\'s old side-channel link is gone. Wired into `ClientsListScreen`, `ClientDetailScreen`, `CalculationWizardScreen`, `CalculationReportScreen` — the four screens that didn\'t already have a "Profil" crumb in their own trail. Deliberately **not** added to `AdminUsersScreen`/`AdminRolesScreen`/`AdminAnnotationsScreen` (already have their own "Profil" text crumb — adding a second, different-looking affordance for the same destination would be redundant clutter) or to `ProfileScreen` itself (no point linking to the screen you\'re already on).
- **Risk this touches, read before assuming it\'s safe**: every screen\'s own "back"/"home" navigation was already implemented independently via each screen\'s `Breadcrumbs` `onPress` handlers (mostly `navigation.dispatch(CommonActions.reset(...))` back to a specific stack shape, not a bare `goBack()`) — confirmed this **before** removing the native header, specifically to rule out any screen silently depending on the native header\'s own back chevron as its only way back. None do. Android\'s hardware back button is a separate mechanism (handled by the stack navigator itself, independent of `headerShown`) and is unaffected either way.

#### #4 — CalculationWizard — "The save button shows in a position near the breadcrumb then goes right, fix it"
- **Root cause, found in `CalculationWizardScreen.tsx`\'s `topRow` style block**: the row holds `[Breadcrumbs, savedIndicator?, headerSaveBtn]`, and it was `savedIndicator` — the conditionally-rendered "Enregistré HH:MM:SS" text, which only exists once `lastSavedAt` is set after the *first* successful autosave — that carried `marginLeft: "auto"`. Before that first autosave completes, the row has only two children (`Breadcrumbs`, `headerSaveBtn`) sitting directly adjacent — exactly "near the breadcrumb." The instant `lastSavedAt` populates and `savedIndicator` mounts as a new middle child, *its* auto-margin consumed all remaining row width and shoved itself — and the save button after it — out to the far right edge. Reported precisely: near the breadcrumb, then jumps right.
- **Fix**: moved `marginLeft: "auto"` off `savedIndicator` and onto `headerSaveBtn` instead — the row\'s last, *unconditionally* rendered child. This pins the save button to the right edge of the row at all times, whether or not the saved-indicator text happens to be mounted yet, instead of the button\'s position depending on transient autosave state.

#### #5 — CalculationWizard — "This total is useless"
- **Investigated, not fixed.** Position (x=316, y=598) doesn\'t map unambiguously to one element without live device access — the Synthèse tab has two candidate "total" displays in that general area: a per-year subtotal (`yearlyBreakdownTotal`, inside the "Récapitulatif annuel" box added by BUG-027 #2 specifically so a site\'s total could be seen broken down by year) and the single site-level `finalTotalBox` grand total below it. Deliberately did **not** guess which one and did **not** remove or alter either — this is an audit-duration calculator; a displayed total may carry real regulatory/audit meaning that isn\'t obvious from the UI alone, and this project\'s own standing rule is not to change calculation-adjacent UI without understanding why it\'s there. **Needs Mahdi to clarify** which specific total he means (screenshot, or re-annotate directly on the element) before anyone touches this.

#### #6 — AdminRoles — layout + desktop-width complaint
- **Investigated, partially scoped, not fixed this session** — see `docs/ROADMAP.md` item 11 for the full write-up (root cause confirmed: flat role-card list, no tabs/matrix; `ResponsiveContainer` capped at 640–800px on this screen vs. 1100px on the wizard). Splitting into a quick `maxWidth` bump (safe, isolated) vs. an actual list→tabs/matrix redesign (needs a design decision, not a blind implementation) — logged as ROADMAP item 11, not attempted here.

#### #7 — AdminAnnotations — "annotations file name should be timestamped"
- **Root cause, confirmed directly from the reported filename**: `exportFilename()` in `AdminAnnotationsScreen.tsx` returned `annotations-{filter}.{ext}` — no timestamp, so every export under the same filter+format landed under the exact same name. `annotations-open__1_.md` (the actual file this bug was reported from) is the browser\'s own download-manager disambiguating a *second* identically-named download with its own `(1)` suffix — direct proof of the collision, not an inference.
- **Fix**: `exportFilename()` now appends a local `YYYYMMDD-HHmmss` stamp: `annotations-{filter}-{stamp}.{ext}`. Computed fresh on each call (not memoized), so repeated exports in the same session get distinct names. The export\'s own content already carries an authoritative UTC "Exported … UTC" header line (unchanged) — this filename stamp is for at-a-glance freshness/uniqueness in a file browser, not the source of truth for when the export was actually generated.

#### #8 — AdminAnnotations — "give more details regarding the element the user pointed at... its name its container or technical designation"
- **Root cause confirmed, not guessed**: `grep -rn "testID=" src/` across the entire frontend returns **zero** matches. `AnnotationCapture.tsx`\'s `resolveWebElementRef()` (the mechanism FEAT-006\'s own spec — `docs/ROADMAP.md` item 10 — already flagged as "opportunistic, tied to whichever components already carry a `testID`") walks up from the click target looking for `data-testid` or `id`; with no `testID`s anywhere in the codebase, it has nothing to ever match. All 8 real annotations captured this session (by two different admins, on six different screens) came back with `elementRef: null` — confirming this isn\'t a rare miss, it\'s the default outcome in practice.
- **Not a rearchitecture — exactly what the original spec anticipated as the improvement path**: "improving coverage later means adding `testID`s to more components over time." **Started this session, opportunistically, on components already being touched for other BUG-050 fixes** (not a dedicated sweep): `ProfileScreen`\'s three admin-nav buttons (`profile-admin-users-button`, `profile-admin-roles-button`, `profile-admin-annotations-button`), `AdminAnnotationsScreen`\'s three export buttons (`annotations-export-copy-button`, `annotations-export-share-button`, `annotations-export-download-button`), and `Breadcrumbs`\' new profile button (`breadcrumbs-profile-button`). This is real but small — nowhere near "coverage" — see hand-off item 4 below.

### Verification this session

- **`npx tsc --noEmit`: clean**, run once after all of the above edits, as a minimal safety gate before committing — **by explicit instruction this session, nothing further was run**: no `npx expo export`, no `make build-deploy`, no `scripts/check-repo-hygiene.sh`, and **no backend regression suite**, despite this session\'s changes touching `App.tsx`\'s navigation config for every screen in the stack. A clean typecheck confirms the code compiles; it confirms nothing about runtime navigation behavior, `expo export`\'s bundler output, or the deploy-artifact hygiene checks. **Treat this push as source-complete and typecheck-clean only** — see hand-off below for what a next session must still run before telling Mahdi any of BUG-050\'s 8 items are actually confirmed fixed on a real device.
- **No live click-through of any of these fixes** — same standing limitation as every frontend fix in this project\'s history; this sandbox has never had browser/device access.
- **No CI-confirmed green run yet for this push.**

**Security note (recurring — see prior sessions\' identical note)**: a live GitHub PAT was again pasted in plaintext directly in the requesting chat this session (first message). Used only transiently for `git clone`/the push at the end of this session; never written to any log, commit, or this project\'s persistent memory. **Mahdi should rotate this token** — now flagged in at least five separate sessions (tenth, eighteenth, thirty-fourth, thirty-fifth, thirty-seventh, this one).

**Hand-off — 4 explicit tasks for the next developer, by Mahdi\'s own direct instruction this session (do not skip logging these even though no code was touched for them):**
1. **Run the full verification suite** — this session deliberately skipped it. Minimum: fresh DB → `migrate.php` (idempotent check too) → `seed.php` → `smoke_test.php` (expect 24/24) → live `php -S 127.0.0.1:8080` → `http_api_test.php` (expect 65/65) — needed because `App.tsx`\'s navigation config changed, even though the diff is frontend-only. Then `npx expo export --platform web --clear` and `make build-deploy` (all 4 `scripts/check-deploy-artifact.sh` checks) — neither has been run since before this session\'s edits. Then `scripts/check-repo-hygiene.sh`.
2. **Finish `CalculationReportScreen.tsx`\'s design-token migration** — only the `theme/tokens` import was added this session; none of its ~24 `StyleSheet.create` values were converted. See `docs/ROADMAP.md` item 6 for the exact current status and the substitution approach used on the other 8 files.
3. **Finish AdminRoles (`docs/ROADMAP.md` item 11)** — at minimum the quick, low-risk `maxWidth` bump; the list→tabs/matrix redesign is a bigger, separate design decision (see that item for the full breakdown).
4. **Write up whatever #1–#3 find, in this file** — specifically: confirm (or correct) the smoke/HTTP test numbers above once actually run, note the `expo export`/`build-deploy`/hygiene results, and record the `CalculationReportScreen.tsx`/AdminRoles work the same way every other session in this log has (done/not-done/verification, not just a commit message).

Also still outstanding, carried over rather than newly introduced: annotation #5 needs Mahdi\'s clarification (see above); annotation #8\'s `testID` coverage is a real ongoing pass, not a one-session task; a live click-through of everything in this entry.

**Dependency / hand-off**: item 1 blocks trusting anything else in this entry — do it first. Items 2 and 3 are independent of each other and of item 1\'s outcome (both are additive, low-interaction-risk changes), and can proceed in parallel once picked up. Item 4 is the wrap-up step once 1–3 are done.

### Update, same day — hand-off item 1 (full verification) now done, against the actual pushed commit `4408bfa`

- **Backend regression — first attempt gave a false-alarm 44 passed/21 failed**, not a real regression: this sandbox\'s MariaDB data directory still had 2 leftover user rows from the pre-session check earlier the same day (a stale, non-dropped DB reused across separate `http_api_test.php` invocations in one persistent sandbox). That broke the "first-ever registrant is bootstrapped as administrateur" test and every admin-permission-gated test after it in sequence (all correctly got `403` — the bootstrapped admin literally wasn\'t the first row anymore, so it never got granted the role). **Worth naming for future sessions**: `http_api_test.php`\'s bootstrap-admin assumption requires a truly empty `users` table — re-running the full suite twice against the same DB without `DROP DATABASE` first will reliably produce this exact false failure. Not a code bug; a test-fixture assumption.
- **Re-run against a freshly dropped-and-recreated DB**: `migrate.php` (3 new, then idempotent 0 new on a second run) → `seed.php` → `smoke_test.php` **24/24** → live `http_api_test.php` **65/65, 0 failed**. This is the real result for `4408bfa`.
- **`npx expo export --platform web --clear`**: succeeds, 558 modules (same module count as the thirty-sixth session\'s last confirmed-good export — consistent, no unexpected bundle bloat/breakage from this session\'s navigation changes).
- **`make build-deploy`**: succeeds; all 4 `scripts/check-deploy-artifact.sh` checks pass (allowlist, no forbidden files, no vendored `node_modules` tree, every `__DIR__`-relative `require`/`require_once` resolves).
- **`scripts/check-repo-hygiene.sh`**: all 4 checks pass, including the secret-token scan — confirms the GitHub PAT pasted in chat this session never made it into any tracked file.
- **CI**: `4408bfa` confirmed `completed` / `success` via the GitHub Actions API — independent confirmation of the same result.
- **Hand-off item 1 is now closed.** Items 2 (`CalculationReportScreen.tsx` tokens), 3 (AdminRoles, `docs/ROADMAP.md` item 11), annotation #5\'s clarification, and a live click-through of BUG-050\'s fixes remain open — unchanged from above.

### Update, same day — hand-off item 2 done: `CalculationReportScreen.tsx` design tokens finished, ROADMAP item 6 fully closed (9/9)

- Converted the file\'s ~24 remaining raw `StyleSheet.create` values to `src/theme/tokens.ts`, same substitution rules used on the other 8 files this item touched: exact hex matches convert directly (`#1c1c1e`→`colors.contentPrimary`/`colors.borderStrong` depending on role, `#555`→`colors.contentSecondary`, `#e2e2e5`→`colors.borderDefault`, `#fff8e6`→`colors.warningSurface`), near-matches convert to the closest semantic role (`#7a5c00`→`colors.warning`, `#777`→`colors.contentTertiary`), off-scale numbers (17, 18, 60, the two `marginBottom: 3`s) left as plain numbers rather than forced onto the spacing scale.
- `npx tsc --noEmit`: clean. `npx expo export --platform web --clear`: succeeds, 558 modules — same count as before this change, no bundle regression.
- **This closes ROADMAP item 6 entirely** — confirmed with the same grep used to find the original 9 files, now returning nothing: no screen or component under `src/components`/`src/screens` uses `StyleSheet.create` without importing `theme/tokens`.
- Hand-off item 3 (AdminRoles, `docs/ROADMAP.md` item 11) is the only code item still open from this entry\'s original 4-item hand-off.' WHERE code = 'BUG-050';
