<?php
declare(strict_types=1);

namespace AuditEngine;

/**
 * Dossier reference (dossierRef) codification — FEAT-008 slice 1. Storage
 * created by migration 011_dossier_ref_codification.sql (see that file's
 * header comment for the full design rationale). Mirrors the RuntimeException
 * + French user-facing message convention used by trackerRepo.php/
 * annotationRepo.php, so api/index.php can catch and turn a validation
 * failure into a 400 the same way it already does for those.
 *
 * Two responsibilities, deliberately kept separate:
 * - getDossierRefConfig() / saveDossierRefConfig(): read/write the settings
 *   an admin controls (not yet exposed in any UI — see hand-off notes in
 *   docs/DEV_STATUS.md's fifty-third-session entry).
 * - generateNextDossierRef(): the actual per-case generation, called from
 *   api/index.php's POST /cases route only when dossierRef is blank AND
 *   the config's `enabled` flag is on — every existing manual-entry
 *   workflow is completely unaffected by this file's existence until an
 *   admin flips that flag.
 */

const DOSSIER_REF_RESET_PERIODS = ['never', 'yearly', 'monthly'];

function mapDossierRefConfigRow(array $r): array
{
    return [
        'enabled' => (bool)$r['enabled'],
        'prefix' => $r['prefix'],
        'suffix' => $r['suffix'],
        'dateFormat' => $r['date_format'],
        'counterDigits' => (int)$r['counter_digits'],
        'resetPeriod' => $r['reset_period'],
        'nextCounter' => (int)$r['next_counter'],
        'lastPeriodKey' => $r['last_period_key'],
        'updatedAt' => $r['updated_at'],
        // A live preview of what the *next* generated reference would look
        // like with the current settings, without consuming the counter —
        // lets a future settings screen show "e.g. DC-2026-0007" as the
        // admin edits the pattern. Purely a display convenience; the real
        // value is only ever assigned (and the counter only ever advanced)
        // inside generateNextDossierRef()'s own transaction.
        'previewSample' => formatDossierRef($r, (int)$r['next_counter']),
    ];
}

function formatDossierRef(array $config, int $counter): string
{
    $dateComponent = '';
    if (trim((string)$config['date_format']) !== '') {
        $dateComponent = date((string)$config['date_format']);
    }
    $counterStr = str_pad((string)$counter, (int)$config['counter_digits'], '0', STR_PAD_LEFT);
    // A literal "-" joins the date component to the counter when a date
    // component is present, so e.g. prefix "DC-" + date "2026" + counter
    // "0007" reads as "DC-2026-0007", not the ambiguous "DC-20260007".
    // With no date component, prefix and counter are adjacent (the admin's
    // own prefix is expected to supply any needed separator, e.g. "DC-").
    $middle = $dateComponent !== '' ? $dateComponent . '-' . $counterStr : $counterStr;
    return $config['prefix'] . $middle . $config['suffix'];
}

function getDossierRefConfig(): array
{
    $stmt = getPdo()->query('SELECT * FROM dossier_ref_config WHERE id = 1');
    $row = $stmt->fetch();
    if (!$row) {
        // Should be unreachable — migration 011 seeds this row — but fail
        // with a clear message rather than a null-array-access notice if
        // a deployment somehow skipped that seed.
        throw new \RuntimeException("Configuration de codification introuvable (migration 011 non appliquée ?).");
    }
    return mapDossierRefConfigRow($row);
}

/**
 * Partial update, same convention as updateTrackerItem()/updateRole():
 * only keys present in $data are changed; everything else keeps its
 * current DB value. Never touches next_counter/last_period_key — those
 * are exclusively generateNextDossierRef()'s to manage, so an admin
 * editing the pattern can never accidentally rewind or skip the counter.
 */
function saveDossierRefConfig(array $data): array
{
    $sets = [];
    $params = [];

    if (array_key_exists('enabled', $data)) {
        $sets[] = 'enabled = ?';
        $params[] = $data['enabled'] ? 1 : 0;
    }
    if (array_key_exists('prefix', $data)) {
        $prefix = (string)$data['prefix'];
        if (mb_strlen($prefix) > 32) {
            throw new \RuntimeException("Le préfixe doit contenir 32 caractères maximum.");
        }
        $sets[] = 'prefix = ?';
        $params[] = $prefix;
    }
    if (array_key_exists('suffix', $data)) {
        $suffix = (string)$data['suffix'];
        if (mb_strlen($suffix) > 32) {
            throw new \RuntimeException("Le suffixe doit contenir 32 caractères maximum.");
        }
        $sets[] = 'suffix = ?';
        $params[] = $suffix;
    }
    if (array_key_exists('dateFormat', $data)) {
        $dateFormat = (string)$data['dateFormat'];
        if (mb_strlen($dateFormat) > 32) {
            throw new \RuntimeException("Le format de date doit contenir 32 caractères maximum.");
        }
        // Fail fast on a garbage format rather than silently storing
        // something that would blow up on the next generation attempt —
        // date() itself never throws, so the only real check available is
        // "does this look like it's made of date() tokens/literals", which
        // isn't reliably verifiable short of trying it. We settle for
        // rejecting characters date() cannot ever consume meaningfully:
        // none, actually — date() accepts arbitrary text as literals. So
        // instead we just cap length (above) and let a garbage-but-valid
        // format through, same as a free-text field; a bad choice here is
        // a UX problem for the (future) settings screen to catch with a
        // live preview, not a data-integrity problem for this layer.
        $sets[] = 'date_format = ?';
        $params[] = $dateFormat;
    }
    if (array_key_exists('counterDigits', $data)) {
        $digits = (int)$data['counterDigits'];
        if ($digits < 1 || $digits > 10) {
            throw new \RuntimeException("Le nombre de chiffres du compteur doit être compris entre 1 et 10.");
        }
        $sets[] = 'counter_digits = ?';
        $params[] = $digits;
    }
    if (array_key_exists('resetPeriod', $data)) {
        $resetPeriod = (string)$data['resetPeriod'];
        if (!in_array($resetPeriod, DOSSIER_REF_RESET_PERIODS, true)) {
            throw new \RuntimeException("Période de réinitialisation invalide.");
        }
        $sets[] = 'reset_period = ?';
        $params[] = $resetPeriod;
    }

    if (empty($sets)) {
        return getDossierRefConfig();
    }

    $sql = 'UPDATE dossier_ref_config SET ' . implode(', ', $sets) . ' WHERE id = 1';
    $stmt = getPdo()->prepare($sql);
    $stmt->execute($params);

    return getDossierRefConfig();
}

/**
 * Atomically generates and reserves the next dossierRef, advancing the
 * counter (and resetting it first if the configured period has rolled
 * over) in one transaction with SELECT ... FOR UPDATE, so two concurrent
 * case-creation requests can never be handed the same reference — same
 * transactional-write shape as parameterSetRepo.php's saveParameterSet().
 *
 * Caller's responsibility: only call this when the config is enabled AND
 * the case's own dossierRef field was left blank (see api/index.php's
 * POST /cases route) — this function itself does not check `enabled`,
 * so a caller that wants the manual-entry behavior simply never calls it.
 */
function generateNextDossierRef(): string
{
    $pdo = getPdo();
    $pdo->beginTransaction();
    try {
        $stmt = $pdo->prepare('SELECT * FROM dossier_ref_config WHERE id = 1 FOR UPDATE');
        $stmt->execute();
        $row = $stmt->fetch();
        if (!$row) {
            throw new \RuntimeException("Configuration de codification introuvable (migration 011 non appliquée ?).");
        }

        $resetPeriod = $row['reset_period'];
        $currentPeriodKey = null;
        if ($resetPeriod === 'yearly') {
            $currentPeriodKey = date('Y');
        } elseif ($resetPeriod === 'monthly') {
            $currentPeriodKey = date('Y-m');
        }

        $counter = (int)$row['next_counter'];
        if ($currentPeriodKey !== null && $row['last_period_key'] !== $currentPeriodKey) {
            // Period rolled over (or this is the very first generation
            // under a yearly/monthly policy) — start the counter fresh
            // rather than continuing the previous period's sequence.
            $counter = 1;
        }

        $ref = formatDossierRef($row, $counter);

        $update = $pdo->prepare(
            'UPDATE dossier_ref_config SET next_counter = ?, last_period_key = ? WHERE id = 1'
        );
        $update->execute([$counter + 1, $currentPeriodKey]);

        $pdo->commit();
        return $ref;
    } catch (\Throwable $e) {
        $pdo->rollBack();
        throw $e;
    }
}
