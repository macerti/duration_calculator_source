<?php
declare(strict_types=1);

namespace AuditEngine;

function getActiveParameterSet(): ?array
{
    $stmt = getPdo()->query('SELECT data FROM parameter_sets WHERE is_active = 1 LIMIT 1');
    $row = $stmt->fetch();
    if (!$row) return null;
    return json_decode($row['data'], true);
}

function saveParameterSet(array $params, bool $activate = false, ?string $changedBy = null, ?string $changeSummary = null): void
{
    $pdo = getPdo();
    $pdo->beginTransaction();
    try {
        $stmt = $pdo->prepare(
            'INSERT INTO parameter_sets (id, version, is_active, change_note, data) VALUES (?, ?, 0, ?, ?)'
        );
        $stmt->execute([$params['id'], $params['version'], $params['changeNote'] ?? null, json_encode($params)]);

        if ($activate) {
            $pdo->exec('UPDATE parameter_sets SET is_active = 0');
            $stmt = $pdo->prepare('UPDATE parameter_sets SET is_active = 1 WHERE id = ?');
            $stmt->execute([$params['id']]);
        }

        if ($changeSummary) {
            $stmt = $pdo->prepare(
                'INSERT INTO parameter_change_log (parameter_set_id, changed_by, change_summary) VALUES (?, ?, ?)'
            );
            $stmt->execute([$params['id'], $changedBy, $changeSummary]);
        }

        $pdo->commit();
    } catch (\Throwable $e) {
        $pdo->rollBack();
        throw $e;
    }
}

function seedDefaultParameterSet(): array
{
    $bootstrap = loadDefaultParameterSet();
    saveParameterSet($bootstrap, true, 'system', 'Initial seed from source CSVs + GS0106 spec transcription (PHP port)');
    return $bootstrap;
}

// --- FEAT-008 slice 2: admin-facing parameter set history/edit support ---
// Everything below is additive on top of the three functions above (which
// predate this slice and are unchanged) — no existing caller's behavior
// changes.

/**
 * Version list for an admin history view — deliberately excludes the
 * (potentially large — IAF tables + ~90-row factor catalogue + synergy
 * grid + a ~600-row NACE table) `data` blob. Use getParameterSetById() to
 * fetch one specific version's full data.
 */
function listParameterSetVersions(): array
{
    $stmt = getPdo()->query(
        'SELECT id, version, is_active, change_note, created_at FROM parameter_sets ORDER BY version DESC'
    );
    $rows = $stmt->fetchAll();
    return array_map(fn($r) => [
        'id' => $r['id'],
        'version' => (int)$r['version'],
        'isActive' => (bool)$r['is_active'],
        'changeNote' => $r['change_note'],
        'createdAt' => $r['created_at'],
    ], $rows);
}

function getParameterSetById(string $id): ?array
{
    $stmt = getPdo()->prepare('SELECT data FROM parameter_sets WHERE id = ?');
    $stmt->execute([$id]);
    $row = $stmt->fetch();
    if (!$row) return null;
    return json_decode($row['data'], true);
}

/**
 * Activates an already-saved version without creating a new one — the
 * "roll back to (or re-activate) an existing version" flow, distinct from
 * saveNewParameterSetVersion() below which always creates a fresh row.
 */
function activateParameterSetVersion(string $id, ?string $changedBy = null): array
{
    $target = getParameterSetById($id);
    if ($target === null) {
        throw new \RuntimeException("Aucune version de paramètres avec l'identifiant \"$id\".");
    }
    $pdo = getPdo();
    $pdo->beginTransaction();
    try {
        $pdo->exec('UPDATE parameter_sets SET is_active = 0');
        $stmt = $pdo->prepare('UPDATE parameter_sets SET is_active = 1 WHERE id = ?');
        $stmt->execute([$id]);
        $stmt = $pdo->prepare(
            'INSERT INTO parameter_change_log (parameter_set_id, changed_by, change_summary) VALUES (?, ?, ?)'
        );
        $stmt->execute([$id, $changedBy, "Activated version {$target['version']} (no data change)."]);
        $pdo->commit();
    } catch (\Throwable $e) {
        $pdo->rollBack();
        throw $e;
    }
    return $target;
}

/**
 * The admin "save my edits" entry point: takes a full parameter-set data
 * array (typically the active set with some leaf values edited by an
 * admin in the browser), assigns it a fresh id/version automatically
 * (never lets the caller pick — avoids any chance of an admin overwriting
 * an existing historical version by supplying its id), and inserts it via
 * the existing saveParameterSet(), activating immediately unless told not
 * to. changeNote is mandatory here (unlike saveParameterSet() itself)
 * since every admin-driven edit should be able to say what changed and
 * why — this project's own accreditation-defensibility convention
 * (see factors.php's identical requirement on factor-selection
 * justification text).
 */
function saveNewParameterSetVersion(array $data, string $changeNote, bool $activate, ?string $changedBy = null): array
{
    if (trim($changeNote) === '') {
        throw new \RuntimeException("Une note de modification est obligatoire pour enregistrer une nouvelle version des paramètres.");
    }
    $stmt = getPdo()->query('SELECT COALESCE(MAX(version), 0) AS maxVersion FROM parameter_sets');
    $nextVersion = (int)$stmt->fetch()['maxVersion'] + 1;

    $data['id'] = 'custom-v' . $nextVersion;
    $data['version'] = $nextVersion;
    $data['createdAt'] = date('c');
    $data['changeNote'] = $changeNote;

    saveParameterSet($data, $activate, $changedBy, $changeNote);
    return $data;
}
