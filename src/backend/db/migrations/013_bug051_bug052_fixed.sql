-- Audit Duration Engine -- update BUG-051 and BUG-052's tracker_items rows
-- now that both have been fixed, following Mahdi's direct decisions given
-- live in chat this session (both had been open/p2/blocked on his input
-- for seven-plus consecutive sessions per the tracker's own history).
-- Migration: 013_bug051_bug052_fixed
-- Created: 2026-09-12
-- Author: Claude (dev session, 2026-09-12, fifty-fourth session)
--
-- BUG-051 (ErrorBoundary's onGoHome was a no-op on native): Mahdi said
-- "add the fix". Implemented in App.tsx -- a `errorResetKey` state used as
-- the root <ErrorBoundary>'s `key`; on native, onGoHome now bumps that key,
-- forcing React to fully unmount/remount the entire tree (ErrorBoundary's
-- own state included), the same practical effect as web's existing
-- `window.location.reload()`. Deliberately NOT expo-updates (the option
-- this bug's own original entry floated) -- that needs an EAS-built native
-- binary to actually do anything, for an app currently shipped only as the
-- web export (REPOSITORY_ARCHITECTURE.md); a plain remount fixes the same
-- problem today without an unbuildable/unverifiable native dependency.
--
-- BUG-052 ("this total is useless", ambiguous which total): Mahdi
-- clarified directly -- "the total of 03 years the grand total", i.e. the
-- finalTotalBox ("Duree totale a auditer") that summed every site, every
-- standard and every year into one blended figure, not the per-year
-- "Recapitulatif annuel" breakdown above it. Removed the box entirely (not
-- relabeled) per his "useless" wording; confirmed purely presentational
-- first (not saved to the case, not read by CalculationReportScreen.tsx),
-- so this changes no calculation or stored data, only the Synthese tab's
-- display.
--
-- Both 'fixed_unverified', not 'verified'/'closed' -- same standing gap as
-- every frontend change in this project's history: no live device/browser
-- click-through has ever been possible from this sandboxed environment.
-- tsc clean and expo export (563 modules) confirm both compile and bundle;
-- neither confirms how either actually looks/behaves on a real screen.

UPDATE tracker_items
SET
  status = 'fixed_unverified',
  technical_description = CONCAT(
    technical_description,
    ' -- FIXED 2026-09-12 (fifty-fourth session), per Mahdi''s direct "add the fix": ',
    'App.tsx gained an `errorResetKey` state used as the root <ErrorBoundary>''s `key`; ',
    'on native, onGoHome now increments it, forcing a full unmount/remount of the entire ',
    'tree (ErrorBoundary''s own error state included) -- the same practical recovery as ',
    'web''s existing window.location.reload(), without adding expo-updates (would need an ',
    'EAS-built native binary to do anything, for an app shipped today only as the web export).'
  ),
  tests_to_do = 'Live native build: trigger a state-dependent render crash (not just a one-off), tap "Retour a l''accueil", confirm the app actually recovers to a working Home screen instead of re-crashing immediately -- unverifiable from this sandbox, same standing gap as every native-specific claim in this project''s history.',
  comments = 'Fixed fifty-fourth session (2026-09-12) per Mahdi''s direct chat decision. tsc clean, expo export 563 modules, backend baseline unaffected (24/24, 117/117 -- this is a frontend-only, non-calculation change). Needs a live native build to fully verify recovery from a real crash.'
WHERE code = 'BUG-051';

UPDATE tracker_items
SET
  status = 'fixed_unverified',
  technical_description = CONCAT(
    technical_description,
    ' -- RESOLVED 2026-09-12 (fifty-fourth session): Mahdi confirmed directly which total the ',
    'annotation meant -- "the total of 03 years the grand total", i.e. the finalTotalBox ',
    '("Duree totale a auditer"), not the per-year "Recapitulatif annuel" breakdown above it. ',
    'Removed the box (and its now-unused finalTotal computation/styles) from ',
    'CalculationWizardScreen.tsx entirely, per his "useless" wording -- confirmed first that ',
    'the value was purely presentational (not saved to the case, not read by ',
    'CalculationReportScreen.tsx), so this changes no calculation or stored data.'
  ),
  tests_to_do = 'Live click-through of the Synthese tab: confirm the layout still reads cleanly with the box gone (spacing above the "Voir le rapport" button) -- unverifiable from this sandbox.',
  comments = 'Fixed fifty-fourth session (2026-09-12) per Mahdi''s direct chat clarification. tsc clean, expo export 563 modules, backend baseline unaffected (24/24, 117/117 -- purely a frontend display removal, no calculation touched).'
WHERE code = 'BUG-052';

INSERT INTO tracker_updates (item_code, done, next)
VALUES (
  'BUG-051',
  'Mahdi said "add the fix" directly in chat. Implemented a full-tree remount via a `key` bump on the root <ErrorBoundary> (App.tsx) as the native equivalent of web''s window.location.reload(), instead of expo-updates (unbuildable/unverifiable from this sandbox, and the app isn''t shipped as a native build today anyway). tsc clean, expo export 563 modules, backend baseline unaffected.',
  'Live native build test of an actual crash-and-recover cycle would close this out fully -- same standing sandbox limitation as every other frontend item.'
),
(
  'BUG-052',
  'Mahdi clarified directly in chat which total the original annotation meant: the finalTotalBox ("Duree totale a auditer", summing every site/standard/year), not the per-year breakdown. Removed it entirely from CalculationWizardScreen.tsx per his "useless" wording, after confirming it was purely presentational with no other reader. tsc clean, expo export 563 modules, backend baseline unaffected.',
  'Live click-through of the Synthese tab layout post-removal would close this out fully.'
);
