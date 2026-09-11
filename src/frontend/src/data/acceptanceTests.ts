/**
 * FEAT-007 — structured source data for Guided Test Mode
 * (screens/GuidedTestRunnerScreen.tsx).
 *
 * This is a transcription of docs/TEST_CHECKLIST.md's numbered scenarios
 * into a data shape the app can render and walk a tester through
 * in-app, instead of the tester following a separate markdown file by
 * hand. Every scenario keeps its original stable ID (e.g. "HOME-01") —
 * those IDs are the cross-reference key used in bug reports and in
 * TEST_CHECKLIST.md's own "Test History" log, and this file does not
 * invent new ones.
 *
 * SOURCE OF TRUTH NOTE: docs/TEST_CHECKLIST.md remains the canonical,
 * human-edited checklist (it also carries the running "Test History" log
 * and process notes this file does not attempt to duplicate). This file
 * is a snapshot transcription, current as of v5.4.0 (2026-09-11). If a
 * scenario is added/changed/removed in TEST_CHECKLIST.md, this file must
 * be updated to match by hand — there is no automated sync. Worth
 * revisiting later (see DEBT candidate noted in this session's DEV_STATUS
 * hand-off) if the two ever drift.
 *
 * PRE-EXISTING NUMBERING QUIRK, carried over deliberately rather than
 * silently "fixed": TEST_CHECKLIST.md's own section headings go ...,
 * "12. Toast system", "14. BUG-004 wizard persistence regression tests",
 * "13. Security spot-checks" — 13 and 14 are out of numeric order in the
 * source file itself. This data preserves that same order and those same
 * numbers rather than renumbering, since renumbering here would make this
 * file disagree with the still-canonical markdown for no functional
 * reason (the scenario IDs, not the section numbers, are what's actually
 * referenced elsewhere).
 */

export interface AcceptanceTestItem {
  id: string;
  description: string;
}

export interface AcceptanceTestSection {
  number: number;
  title: string;
  items: AcceptanceTestItem[];
}

export const ACCEPTANCE_TEST_SECTIONS: AcceptanceTestSection[] = [
  {
    number: 1,
    title: "Connectivity & Home",
    items: [
      { id: "HOME-01", description: "Open the app fresh. A small status indicator (dot + text) appears near the top, not a large card. It shows \"Connecté\" (or similar) within a couple seconds." },
      { id: "HOME-02", description: "Tap the status indicator. It re-checks and updates." },
      { id: "HOME-03", description: "One primary button, \"Mes clients\" — no separate \"NAE Calculator\"/\"Case Calculator\" buttons." },
    ],
  },
  {
    number: 2,
    title: "Client management (CRUD + undo)",
    items: [
      { id: "CLI-01", description: "Tap \"Mes clients\". Empty state shows helpful text if you have no clients yet." },
      { id: "CLI-02", description: "Tap \"+ Nouveau client\", leave the name blank, tap \"Créer\". The input field shakes and a red label appears: \"Le nom du client est obligatoire.\" No client is created." },
      { id: "CLI-03", description: "Type a name, tap \"Créer\". You land on that client's detail page. The client now appears in the clients list." },
      { id: "CLI-04", description: "On a client's detail page, tap the pencil icon next to the name, change it, save. The new name shows immediately and persists after navigating away and back." },
      { id: "CLI-05", description: "On the clients list, tap the trash icon next to a client. The client disappears immediately — no confirmation dialog. A toast appears at the bottom of the screen with \"Annuler\" and a visibly depleting progress bar." },
      { id: "CLI-06", description: "Repeat CLI-05, but tap \"Annuler\" before the bar empties. The client reappears in the list." },
      { id: "CLI-07", description: "Repeat CLI-05, let the bar run out fully (~30s) without tapping Annuler. Refresh the list — the client is genuinely gone." },
      { id: "CLI-08", description: "Delete a client that has existing calculations (CLI-07-style, let it expire). Its calculations are not deleted — check via the database or by noting the total calculation count elsewhere didn't drop." },
    ],
  },
  {
    number: 3,
    title: "Calculations list per client (CRUD + undo)",
    items: [
      { id: "CASE-01", description: "On a client's detail page, tap \"+ Nouveau calcul\" — lands in the wizard, Step 1." },
      { id: "CASE-02", description: "After saving a calculation (see Section 7), it appears in the client's calculation list with a status badge (Brouillon/Calculé/Validé) and the total days shown." },
      { id: "CASE-03", description: "Tap the trash icon on a saved calculation. Same immediate-removal + undo-toast behavior as CLI-05/06/07." },
      { id: "CASE-04", description: "Tap a saved calculation (not its trash icon). It opens back into the wizard, landing on the Récapitulatif step with the saved results shown." },
    ],
  },
  {
    number: 4,
    title: "Wizard Step 1 — Sites & Secteurs",
    items: [
      { id: "SITE-01", description: "Type a partial sector name without accents, e.g. \"telecom\". Results including \"Télécommunication\" appear." },
      { id: "SITE-02", description: "Search a number, e.g. \"39\". Results include sectors whose NACE or EAC code contains that number, not just description matches." },
      { id: "SITE-03", description: "Select a sector. It appears as a chip with both its NACE and EAC code shown." },
      { id: "SITE-04", description: "Select a second sector for the same site. Both appear. There is no hard limit of 2 — try adding a third if you have a real-world case that needs it." },
      { id: "SITE-05", description: "With 2+ sectors selected and at least one standard active, a \"risque retenu\" summary appears per standard — confirm it shows the more severe of the sectors' risk levels for each standard (you may need to pick sectors you know have different risk levels per standard to verify this meaningfully)." },
      { id: "SITE-06", description: "Select multiple standards (ISO9001, ISO45001, ISO14001) as chips for one site." },
      { id: "SITE-07", description: "Add a second site (\"+ Ajouter un site\"). Give it a different name, different sector(s), different standards." },
      { id: "SITE-08", description: "Remove a site (when 2+ exist). Confirm the remaining site's data is untouched." },
      { id: "SITE-09", description: "Try to continue to the next step with a site missing a sector or a standard — the \"Continuer\" button is disabled with an explanatory hint." },
    ],
  },
  {
    number: 5,
    title: "Wizard Step 2 — Effectif (NAE)",
    items: [
      { id: "NAE-01", description: "Enter a total headcount. The next question (indirect) appears immediately below — no need to scroll to a separate section." },
      { id: "NAE-02", description: "Enter indirect headcount. The next question names the exact remaining count: \"Parmi les X personnes restantes (fonction directe), combien...\"" },
      { id: "NAE-03", description: "Enter non-posté headcount. If people remain, the shift-team section appears, again naming the exact remaining count." },
      { id: "NAE-04", description: "Fill the first shift team's headcount. If people still remain unattributed, a second shift row appears automatically — you should never need to tap an \"add shift\" button mid-flow." },
      { id: "NAE-05", description: "Keep filling shifts until the remaining count hits zero — no further rows should appear once fully attributed." },
      { id: "NAE-06", description: "(the contradiction bug) With 2+ sites, deliberately leave one site's headcount mismatched (e.g. 5 people unaccounted for) while the other site's is correct. Switch to the correctly-filled site's tab — it should not show a red \"incomplete\" message contradicting a green \"correct\" one. Instead, expect a clear blue message like: 'L'effectif de \"X\" est complet. L'effectif de \"Y\" doit encore être renseigné.' and the primary button should read \"Aller à l'effectif de Y\" — tapping it should jump you straight to that site's personnel tab." },
      { id: "NAE-07", description: "Fix the mismatched site so all sites validate. The button reverts to \"Continuer vers les facteurs\" and becomes enabled." },
      { id: "NAE-08", description: "(data-loss regression check) Fill in Step 2 partially, switch to Step 1 via the step tabs (not the Retour button), then switch back to Step 2. Your entered data must still be there. Repeat switching rapidly (tap Step 1, immediately tap Step 2, immediately type something) a few times — data should never silently vanish or get overwritten." },
    ],
  },
  {
    number: 6,
    title: "Wizard Step 3 — Facteurs",
    items: [
      { id: "FAC-01", description: "With only 1 active standard on a site, no \"Synergie\" panel appears." },
      { id: "FAC-02", description: "With 2+ active standards on the same site, a \"Synergie / Intégration\" panel appears. Toggle it on, pick an integration level, add at least one auditor with a qualification count." },
      { id: "FAC-03", description: "Tick a few augmentation and reduction factors for one standard. Switch to a different standard (same site) via its panel — confirm the factors you just ticked did not carry over to the other standard (each standard's factors are independent)." },
      { id: "FAC-04", description: "With 2+ sites, tick factors for the Siège specifically (not a regular site) — confirm at the Récap/Report stage that the siège's factor percentage is reflected in its own total, distinctly from any other site's." },
      { id: "FAC-05", description: "Leave justification text blank for a standard with factors ticked — proceed anyway (this only warns, doesn't block) and confirm the report later shows \"— non renseignée —\" for that standard." },
      { id: "FAC-06", description: "Fill in justification text — confirm it appears verbatim in the report later." },
    ],
  },
  {
    number: 7,
    title: "Wizard Step 4 — Récapitulatif",
    items: [
      { id: "REC-01", description: "Tap \"Calculer\" from Step 3. Results appear grouped visually by year — \"Visite initiale\" as one bordered block (Étape 1, Étape 2, Rédaction du rapport), then a separate bordered block per surveillance year. The grouping should be immediately obvious at a glance, not just a small text label." },
      { id: "REC-02", description: "Each duration line shows a small gray \"suggestion : X j\" hint when the calculated value isn't already a clean quarter-day. Tapping the suggestion applies it as the new value." },
      { id: "REC-03", description: "Manually adjust a value with the +/− stepper. The line shows \"(ajusté manuellement)\" and a reset icon (↺) appears — tapping it restores the original calculated value." },
      { id: "REC-04", description: "The final total at the bottom updates live as you adjust individual values." },
      { id: "REC-05", description: "Tap \"📄 Voir le rapport de calcul complet\" — opens the full report (see Section 8)." },
      { id: "REC-06", description: "Tap \"Enregistrer\". A success toast appears. Go back to the client's calculation list — the calculation is there with the correct status and total." },
    ],
  },
  {
    number: 8,
    title: "Calculation Report",
    items: [
      { id: "RPT-01", description: "NAE section shows the actual numeric substitution for the shift-team aggregation, e.g. \"50 (équipe clé) + √50 (somme des autres équipes) = 50 + 7.071 = 57.071 → 58 NAE\" — not just a formula shape with no numbers." },
      { id: "RPT-02", description: "Risk/base-duration section shows the actual resolved risk level by name, and the real numeric substitution for the stage coefficient (e.g. \"10 j (base) × 1.000 (coefficient d'étape 'Initial') = 10.000 j\")." },
      { id: "RPT-03", description: "Factors section lists each ticked factor by its real label (not \"Facteur #3\"), with its percentage and the justification text." },
      { id: "RPT-04", description: "If synergy was configured, its section shows the capacity percentage and the resulting reduction." },
      { id: "RPT-05", description: "Programme d'audit section is grouped by year with the same visual separation as the Récap step." },
      { id: "RPT-06", description: "Sector section shows both NACE and EAC codes." },
    ],
  },
  {
    number: 9,
    title: "Navigation",
    items: [
      { id: "NAV-01", description: "In the wizard, the home affordance is a small icon, not an emoji, and sits at the start of the breadcrumb row (before \"Clients\"), not isolated on the opposite side." },
      { id: "NAV-02", description: "From deep in the wizard, tap the home icon — lands cleanly on Home." },
      { id: "NAV-03", description: "From the wizard, tap \"Clients\" in the breadcrumb — lands on the clients list. Now check the browser/native back button — it should go to Home, not back into the wizard screen you just left (this was a real bug — confirm it stays fixed)." },
      { id: "NAV-04", description: "Same check one level deeper: from the wizard, tap the client name in the breadcrumb — lands on that client's detail page. Back button from there should go to the clients list, not back into the wizard." },
      { id: "NAV-05", description: "Every wizard step is directly clickable in the step tabs once unlocked (not just reachable via Next/Retour) — clicking a step tab never loses previously entered data (see NAE-08 above, same principle applies to Step 3/4 too)." },
    ],
  },
  {
    number: 10,
    title: "Responsive layout",
    items: [
      { id: "RESP-01", description: "On a narrow/mobile-width window, the wizard's step navigation is a bottom-fixed tab bar." },
      { id: "RESP-02", description: "On a wide/desktop-width window, the step navigation moves to a top row instead, and content doesn't stretch edge-to-edge — text and cards stay a reasonable reading width, centered." },
      { id: "RESP-03", description: "The clients list shows 2 columns at desktop width, 1 column on mobile." },
      { id: "RESP-04", description: "Resize the browser window across the mobile/tablet/desktop breakpoints while on any screen — layout should adapt without anything visually breaking (overlapping text, cut-off buttons)." },
    ],
  },
  {
    number: 11,
    title: "Data persistence & backward compatibility",
    items: [
      { id: "DATA-01", description: "(the blank-page bug) Open a calculation that was saved before this version, if you have one from before this fix. It should open normally — showing the Récap with whatever data it has — not a blank white page." },
      { id: "DATA-02", description: "If anything ever does crash while you're using the app, confirm you see an actual error screen (\"Un problème est survenu...\") with a \"Retour à l'accueil\" button — never a silent blank page. If you ever see a truly blank page again, that's a real bug — please report exactly what you did right before it happened." },
    ],
  },
  {
    number: 12,
    title: "Toast system",
    items: [
      { id: "TOAST-01", description: "Simple toasts (save confirmations, error messages) appear and auto-dismiss after a few seconds, positioned near the bottom of the screen." },
      { id: "TOAST-02", description: "Undo toasts (delete actions) show the depleting progress bar clearly, and don't visually overlap with the wizard's bottom step tabs when both could theoretically be on screen." },
      { id: "TOAST-03", description: "Trigger multiple toasts in quick succession (e.g. delete two clients back to back) — they should stack sensibly, not overlap illegibly." },
    ],
  },
  {
    // Numbered 14 in TEST_CHECKLIST.md's own heading, appearing before
    // section 13 there too — see the file-level note above.
    number: 14,
    title: "BUG-004 wizard persistence regression tests",
    items: [
      { id: "SAVE-01", description: "Start a brand-new calculation with the API available and MariaDB connected. The wizard's initial draft POST succeeds and receives a case ID. The wizard may then autosave by PUT; no false unsaved state is shown." },
      { id: "SAVE-02", description: "Make the initial draft POST fail (stop the PHP API or block the request). The wizard must not silently mark itself hydrated. It must show an explicit draft-save error and provide Réessayer l'enregistrement." },
      { id: "SAVE-03", description: "Restore the API and tap Réessayer l'enregistrement. A case ID is obtained and subsequent autosave PUTs are allowed." },
      { id: "SAVE-04", description: "Run the MariaDB + PHP HTTP regression suite in backend/tests/http_api_test.php. It must pass: health/DB → POST draft → PUT case → GET persisted case/status/rounding overrides → NACE search → NACE code → DELETE cleanup." },
      { id: "SAVE-05", description: "Test the exact browser/device lifecycle: mount → initial draft POST → edit wizard → calculate → Enregistrer → leave → reopen the calculation. Confirm the saved calculation opens with the expected persisted data." },
    ],
  },
  {
    number: 13,
    title: "Security spot-checks (things you can verify yourself, no dev tools needed)",
    items: [
      { id: "SEC-01", description: "Visit https://tools.macerti.com/duration_calculator/db/schema.sql directly in a browser. Expect a 403 Forbidden, never the raw file." },
      { id: "SEC-02", description: "Visit .../data/raw/nace_risque_table.csv directly. Same — expect 403." },
      { id: "SEC-03", description: "Visit .../config.php directly. Since PHP executes rather than serves this file's text, you should see a blank page or a redirect — never the file's actual PHP source or your DB password in plain text." },
      { id: "SEC-04", description: "If you ever get an unexpected error from the app, check that the on-screen message is generic (not a raw PHP error mentioning file paths or database details) — if you ever see a raw technical error message on screen, that's a regression worth reporting immediately." },
    ],
  },
];

export const TOTAL_ACCEPTANCE_TEST_COUNT = ACCEPTANCE_TEST_SECTIONS.reduce(
  (sum, section) => sum + section.items.length,
  0
);
