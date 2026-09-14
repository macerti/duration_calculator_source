# Project Orientations

Standing technical and process rules for this project. Not business logic —
GS0106/IAF calculation rules live in `README.md`/code comments. This file is
about *how we build and ship*, and it should stay true regardless of which
tool or feature we're working on. Read this before starting new work; update
it when we settle a new convention or reverse an old one.

## Logging — rewritten 2026-09-13 (fifty-seventh session), resolving DEBT-005

**Bug/feature/tech-debt status and dev-session history are database tables,
not hand-maintained markdown files.** This section used to describe a
"five standing files" convention (below, kept for history) that had drifted
badly out of sync with actual practice — `BUGLOG.md` said it was where
"every bug gets its own entry" long after bugs had lived in `tracker_items`
since migration `008` (2026-09-09), and the list never mentioned
`DEV_STATUS.md` despite it being the single most-used file in this
project's entire history. DEBT-005 flagged this drift; this rewrite
resolves it per Mahdi's own direct instruction (2026-09-13) to stop
maintaining the same information by hand in two places and "unify
definitively."

**What changed**: `docs/DEV_STATUS.md` (56 dated session narratives plus its
own front-matter conventions) and `docs/BUGLOG.md` (50 closed-bug entries)
were archived **verbatim, in full** into this database — every session
section into `session_log.done_text` (migration `017`), `BUGLOG.md`'s
preamble into one more `session_log` row (migration `019`), and 4 of
`BUGLOG.md`'s 50 bug entries that had genuine post-`008` additions synced
into their `tracker_items.technical_description` first (migration `018`,
found by diffing the file against the live table entry-by-entry — 45 of the
50 already matched migration `008`'s original transcription exactly). Both
source files were then deleted (along with the stray root-level
`SESSION_LOG_2026_09_03_21.md`, a single-session file superseded by, and
already archived from within, `DEV_STATUS.md`). Nothing was lost: every
byte survives in the database, and git history still has the original
files at any commit before this one regardless.

**What did NOT change**: `CHANGELOG.md`, `ROADMAP.md`, `SECURITY.md`, and
`TEST_CHECKLIST.md` are kept, deliberately, not archived — see each below.
Unlike `DEV_STATUS.md`/`BUGLOG.md`, none of these is a pure historical log
with a live DB equivalent already superseding it: `CHANGELOG.md` is a
standard semver artifact; `ROADMAP.md` holds substantial not-yet-built
feature specs (full acceptance criteria etc.) with no equivalent depth
anywhere in the database; `SECURITY.md` is this project's only audit trail
of its kind (the DB has no security-findings table); `TEST_CHECKLIST.md` is
the canonical scenario list `src/frontend/src/data/acceptanceTests.ts`
snapshots from (FEAT-007) — deleting it would remove the source of truth
that snapshot depends on. If a future session wants these unified into the
database too, that's a real, separate design decision (new tables for
security findings and test scenarios, at minimum) — flag it to Mahdi rather
than assuming this rewrite already covers it.

- **The database** (`tracker_items`/`tracker_updates`/`session_log`,
  migrations `004`/`007`) — single source of truth for bugs, features, tech
  debt, annotations (`type='annotation'` since migration `009`), and
  dev-session hand-off history. Query it directly when you have local DB
  access (`GET /admin/tracker/items`, `GET /admin/session-log`).
- **`docs/TRACKER_SNAPSHOT.md`** (auto-generated — do not edit by hand) — a
  recent, read-only view of those same tables, refreshed every 6 hours by
  `.github/workflows/dev-export-snapshot.yml` and committed straight into
  this repo. Built 2026-09-12 (fifty-fourth session) specifically so that
  pulling this repo — by a human or an AI dev session starting fresh, with
  no standing database access — also gets a recent read of the actual live
  "problems," not just the code. **Read this at the start of a session.**
  See `GET /dev-export` in `api/index.php` and `dev_export_secret` in
  `config.example.php` for how it's generated and the one-time setup that
  secret needs.
- **`CHANGELOG.md`** — one entry per version. Versioning is `x.y.z`:
  - **x** = overhaul: new concept, architecture change, or a big/visible new
    capability.
  - **y** = a feature request landed (one bump per requested feature, roughly).
  - **z** = a bug was found and fixed (one bump per bug — cross-reference its
    `tracker_items` code).
- **`ROADMAP.md`** — backlog of requested-but-not-built features, plus parked
  ideas, plus a running list of decisions already made (so future sessions
  don't re-litigate settled questions). Shipped items get struck through, not
  deleted — keep the history.
- **`SECURITY.md`** — audit findings and their status (done / in-progress /
  todo), not a wishlist. Every entry names the concrete risk, what it affects
  (confidentiality/integrity/availability), and either the fix applied or
  what fixing it would require. Reviewed and extended whenever new input,
  a new endpoint, or new stored data is introduced — see the "Security"
  section below for the standing principles this log tracks against.
- **`TEST_CHECKLIST.md`** — scenario-based test cases covering everything
  built so far, organized so a person can work through them methodically
  rather than testing whatever comes to mind. Includes a test-history log so
  results are recorded per version over time, not just the latest pass.

These four files always exist and always get updated in the same pass as
the code change that prompted them.

## Deployment target: PHP + MySQL/MariaDB, single self-contained folder

This project deploys to DirectAdmin **shared hosting**: no Node.js runtime,
SSH not guaranteed, no build step possible on the server. Given that:

- **Backend is PHP.** Always available on shared hosting, needs no process
  manager (Apache/PHP-FPM runs it natively), no separate deployment step.
- **Database is MySQL/MariaDB** — whatever the host provides. No other DB engine.
- **One folder, not separate frontend/backend projects.** The deployable
  artifact is a single self-contained folder: frontend static files at the
  root, PHP backend in an `api/` subfolder inside that same folder, engine
  source (`engine/`, `data/`, `db/`) as siblings of `api/` (not nested inside
  it, so `api/index.php`'s relative `require`s stay simple).
- **The app lives in a subfolder of a subdomain**, not the domain root (e.g.
  `tools.macerti.com/duration_calculator/`, with room for sibling tools under
  the same subdomain later). Any static-site build step **must** be told this
  subpath at build time — for Expo specifically, `app.json`'s
  `expo.experiments.baseUrl`. Getting this wrong produces a blank white page
  in production that looks fine in every naive local test (see BUG-005 in
  `BUGLOG.md` for exactly this happening).
- **Ship as one deliverable**: a single zip, containing one folder, ready to
  extract and upload as-is via FTP/File Manager. Never hand over separate
  frontend/backend zips or a repo layout that needs assembling — that's real
  friction on shared hosting with no build tooling.

## Protecting what ends up in a public webroot

Because everything lives in one web-accessible folder, anything that
shouldn't be downloadable needs explicit protection:

- Raw data files (`.csv`) and schema files (`.sql`) — blocked via `.htaccess`
  `FilesMatch`/`RewriteRule`, not by trying to move them outside the webroot
  (defeats the "one simple folder" goal).
- `.php` source files do **not** need blocking — Apache executes them rather
  than serving their text, so browsing to `engine/nae.php` directly just runs
  it (harmlessly, since these files only define functions). Don't build
  fragile allow/deny coordination between a root `.htaccess` and an `api/`
  `.htaccess` to route around this non-problem — simpler is more robust here.
- `config.php` (DB credentials) — after upload, permissions locked to `600`/`640`.
  Always call this out as an explicit deploy step, not an assumption.

## Testing standard before calling anything "done"

- Run the actual test suite (`tests/smoke_test.php` or equivalent) and report
  the pass count, not just "looks right."
- Test at the **real deployment URL depth**, not just from the tool's own
  folder. `tools.macerti.com/duration_calculator/api/...` has different
  path-stripping behavior than testing `api/index.php` as if it were sitting
  at a domain root — this exact gap caused a real routing bug once (see
  `BUGLOG.md`). PHP's built-in dev server doesn't process `.htaccess`, so
  rewrite/deny behavior needs either a hand-rolled router that faithfully
  simulates it, or a note that it's unverifiable locally and needs a manual
  post-deploy check (call this out explicitly in `DEPLOY.md` rather than
  silently assuming it works).
- Check what the **browser would actually load**, not just that a file exists
  at a path you already know to check. Inspect generated HTML's own asset
  references (`<script src>`, `<link href>`) — a file "existing and returning
  200 when requested directly" is not the same as "the app correctly
  requests it."
- Extract the actual zip about to be shipped, fresh, in a clean location, and
  re-run the test suite from there — not just from the working directory used
  to build it. Confirms the shipped artifact, not just the source tree.

## DEPLOY.md is always current, not historical

`DEPLOY.md` describes the folder structure as it actually is *right now*. If
the deployment topology changes (e.g. two-folder → single-folder), `DEPLOY.md`
gets rewritten to match, not patched around — stale deploy docs that reference
an old structure are worse than none, since they read as authoritative.

## When another review (human or AI) finds something we missed

Treat it the same as any other bug: verify it's real, find the *actual*
mechanism behind the fix (not just copy the patched output), confirm our own
fix arrives at the same result independently when possible, log it honestly
in `BUGLOG.md` including what changes about our own process as a result, and
merge forward anything else genuinely better from that review rather than
discarding it out of ownership over the original version.

## UI Visual System

Standing rule, adapted for this project from a general UI Visual-System
principle: style by **semantic role**, not by component. Before writing any
color, spacing, or radius value, ask "what is this element's role relative to
what's around it" — not "what color should this be."

**Concrete implementation**: `src/theme/tokens.ts` is the single source of
truth. Every new component imports `colors`/`spacing`/`radius`/`typography`
from it and references a named role (`colors.contentSecondary`,
`spacing.md`) — never a raw hex value or a bare number for anything the
token file already names. If a genuinely new role is needed, add it to
`tokens.ts` with a comment explaining the role, then use it — don't invent a
one-off value at the call site.

**This project's visual language** (already established, tokens formalize
it rather than replace it — see the principle of preserving the chosen
aesthetic): a monochrome black/white/gray base (`#1c1c1e` primary,
white/light-gray surfaces) with semantic accent colors reserved for meaning,
not decoration — green for success/positive results, amber for warnings,
red for errors/destructive actions, blue for links/info. Elevation is
expressed through subtle background-tone steps (`surfaceBase` →
`surfaceSunken` → `surfaceRaised`) and hairline borders, not heavy shadows —
this is a flat, content-forward style, and elevation cues should stay quiet
enough not to fight that.

**Hierarchy ladder this app uses** (each tier has a token — use the one that
matches the role, not whichever one "looks close enough"):
- Surfaces: `surfaceBase` (page) → `surfaceSunken` (recessed: inputs, chips)
  → `surfaceRaised` (cards, panels) → `surfaceOverlay` (modal backdrops)
- Content: `contentPrimary` (headings, primary values) → `contentSecondary`
  (body/labels) → `contentTertiary`/`contentQuaternary` (captions, meta,
  calculated-value footnotes) → `contentDisabled`
- Borders: `borderSubtle` (in-card dividers) → `borderDefault` (card/input
  outlines) → `borderStrong` (emphasis — active site card, year-group accent)
- Actions: `actionPrimary`/`actionPrimaryText` (primary buttons) →
  `actionSecondary`/`actionSecondaryText` (secondary/ghost buttons) →
  `actionDisabled` → `link` (breadcrumbs, tappable hints)
- State: `success`/`warning`/`error`/`info`, each with a matching `*Surface`
  tone for the container a message of that kind sits in (e.g. a warning
  message uses `warning` for text and `warningSurface` for its background —
  never a state color as a bare text color on the default surface, since
  that loses the surface-level grouping cue)

**Typography**: `typography.*` fixes the size scale (`caption` through
`hero`); weight and color are still set per call site (React Native's
StyleSheet doesn't support real token composition), but the *size* must
come from the scale, never a bare number. Don't maximize contrast for every
line — primary values get `contentPrimary` + bold, secondary/tertiary text
recedes through the content-color ladder above, not through arbitrary
opacity tweaks.

**States** (default/hover/focus/active/selected/disabled/loading/success/
warning/error): distinguish these by more than color alone where practical
— the app already does this in places worth keeping as the pattern (e.g.
`RoundingStepper`'s "ajusté manuellement" label text alongside the color
change, not color alone; disabled buttons get both a token-driven color
*and* reduced opacity). Extend this habit to new interactive states rather
than reintroducing color-only signaling.

**Current status**: `tokens.ts` exists and is adopted in the small shared
components (`Toast`, `RoundingStepper`, `Breadcrumbs`, `StepTabs`,
`StatusPill`, `SegmentedPicker`) and, as of 5.0.0, the components rewritten
for that release (`DualSectorPicker`, `FactorPicker`, `AutreFactorList`,
`StandardConfigPanel`, `SynergyPanel`, `CalculationWizardScreen`) — adopted
opportunistically because those files were being touched anyway, exactly
the intended pattern. Still not migrated: `HomeScreen`, `ClientsListScreen`,
`ClientDetailScreen`, `CalculationReportScreen`, `NumberField`,
`PersonnelForm`, `ErrorBoundary` — tracked as a migration item in
`ROADMAP.md`, not attempted all at once. Any of these files touched for an
unrelated change should have their colors migrated to tokens in the same
pass, opportunistically, rather than waiting for a dedicated migration pass
that may never come.

## Security

Standing discipline, not a one-time task — reviewed and extended every time
new user input, a new endpoint, or new stored data is introduced. Findings
and their status live in `SECURITY.md` (audit log, same spirit as
`BUGLOG.md` — done/in-progress/todo, not just a wishlist). The principles
here are what govern new work by default:

- **Prepared statements, always, no exceptions.** Every PDO query in this
  codebase uses parameter binding — never string-interpolate a value into
  SQL, including values that "can't possibly" contain injection payloads
  (an internal ID, a hardcoded status string). Consistency here is what
  prevents the one exception that becomes the vulnerability.
- **Never trust client input**, including input the client-side UI already
  validates. Client-side validation is a UX courtesy; server-side
  enforcement (type checks, bounds, required fields) is what actually
  protects data integrity — assume every API call could come from
  something other than this app's own frontend.
- **Fail closed on error responses.** Never return a raw exception message
  or stack trace to the client — log the detail server-side
  (`error_log()`), return a generic message. A detailed error is a gift to
  an attacker mapping the app's internals.
- **Least privilege on what's web-reachable.** Anything that doesn't need
  to be directly requestable (source data, schema files, config) stays
  blocked at the webserver level (`.htaccess`), not just "not linked to."
  Assume anything in the web root will eventually be requested directly.
- **Defense in depth over a single control.** Don't rely on one layer (e.g.
  "the frontend won't send that") when a second layer is cheap (server-side
  validation of the same constraint). Redundant checks that never fire
  aren't wasted — they're what holds when the first layer is bypassed or
  simply wrong.
- **Confidentiality, integrity, and availability are three separate
  questions** — a fix for one doesn't cover the others. When reviewing a
  feature, ask explicitly: what happens if this data leaks (confidentiality),
  what happens if this data or request is tampered with in transit or storage
  (integrity), and what happens if this component is unavailable or
  overwhelmed (availability) — not just "is this safe."


## Mandatory source/deployment separation

**SOURCE REPOSITORY RULE:** this repository is the source of truth and is never the deployable artifact. Every application change must be made here first, tested here, then built/packaged and published to **macerti/duration_calculator**. For PHP, the deployable tree is produced from src/backend/ (no compilation). For src/frontend/, the deployable frontend is the generated Expo web export; source-only frontend changes are not deployed until the generated artifact is published to duration_calculator. Never fix application behavior only in the deployment repository. Every hand-off must record the source commit and deployment-artifact commit, or explicitly state that deployment is pending. A task is not deployed until the corresponding artifact exists in duration_calculator and its deployment workflow has been run/passed where applicable.


## Current delivery priority — 2026-09-01

The authoritative sequence is: versioning → repository architecture → user feedback/acceptance gate → remaining bugs → remaining features. Admin/parameter administration UI is prioritized ahead of authentication/SSO. Microsoft/Google SSO remains requested but is explicitly deprioritized until this order is changed by a later dated decision.
