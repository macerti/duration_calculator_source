<?php
declare(strict_types=1);

namespace AuditEngine;

/**
 * Session/action log — API layer for the table created by migration 007.
 * Mirrors trackerRepo.php's shape (map-row / list / create, throwing
 * \RuntimeException with a French, user-facing message on validation
 * failure for api/index.php to catch and turn into a 400) with one
 * deliberate difference: no update/delete function exists here at all,
 * not just unwired — see migration 007's comment, point 5, for why this
 * table is append-only by design, not just by convention.
 */

function mapSessionLogRow(array $r): array
{
    return [
        'id' => (int)$r['id'],
        'sessionLabel' => $r['session_label'],
        'summary' => $r['summary'],
        'trigger' => $r['trigger_text'],
        'done' => $r['done_text'],
        'notDone' => $r['not_done_text'],
        'handoff' => $r['handoff_text'],
        'commitHash' => $r['commit_hash'],
        'ciStatus' => $r['ci_status'],
        'createdAt' => $r['created_at'],
    ];
}

/**
 * @param int|null $limit cap the number of rows returned, most recent
 *   first (a cold-start session wants the last few entries, not the
 *   entire project history); null returns everything.
 */
function listSessionLog(?int $limit = null): array
{
    $pdo = getPdo();
    $sql = 'SELECT id, session_label, summary, trigger_text, done_text, not_done_text, handoff_text, commit_hash, ci_status, created_at
            FROM session_log ORDER BY created_at DESC, id DESC';
    if ($limit !== null) {
        $sql .= ' LIMIT ' . max(1, min(500, $limit));
    }
    $stmt = $pdo->prepare($sql);
    $stmt->execute();
    return array_map(fn($r) => mapSessionLogRow($r), $stmt->fetchAll());
}

/**
 * @param array $fields sessionLabel, summary required; trigger/done/
 *   notDone/handoff/commitHash/ciStatus all optional
 * @throws \RuntimeException on invalid input
 */
function createSessionLogEntry(array $fields): array
{
    $sessionLabel = trim((string)($fields['sessionLabel'] ?? ''));
    if ($sessionLabel === '') {
        throw new \RuntimeException('Le libellé de session est obligatoire.');
    }
    if (mb_strlen($sessionLabel) > 100) {
        throw new \RuntimeException('Le libellé de session ne peut pas dépasser 100 caractères.');
    }
    $summary = trim((string)($fields['summary'] ?? ''));
    if ($summary === '') {
        throw new \RuntimeException('Le résumé est obligatoire.');
    }
    if (mb_strlen($summary) > 500) {
        throw new \RuntimeException('Le résumé ne peut pas dépasser 500 caractères.');
    }
    $commitHash = trim((string)($fields['commitHash'] ?? ''));
    if ($commitHash !== '' && !preg_match('/^[0-9a-f]{7,40}$/i', $commitHash)) {
        throw new \RuntimeException('Le hash de commit doit être hexadécimal (7 à 40 caractères).');
    }
    $ciStatus = trim((string)($fields['ciStatus'] ?? ''));
    if (mb_strlen($ciStatus) > 100) {
        throw new \RuntimeException('Le statut CI ne peut pas dépasser 100 caractères.');
    }
    $nullableText = fn($v) => ($v === null || trim((string)$v) === '') ? null : trim((string)$v);

    $pdo = getPdo();
    $stmt = $pdo->prepare(
        'INSERT INTO session_log (session_label, summary, trigger_text, done_text, not_done_text, handoff_text, commit_hash, ci_status)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?)'
    );
    $stmt->execute([
        $sessionLabel, $summary,
        $nullableText($fields['trigger'] ?? null),
        $nullableText($fields['done'] ?? null),
        $nullableText($fields['notDone'] ?? null),
        $nullableText($fields['handoff'] ?? null),
        $commitHash !== '' ? $commitHash : null,
        $ciStatus !== '' ? $ciStatus : null,
    ]);
    $id = (int)$pdo->lastInsertId();
    $stmt = $pdo->prepare(
        'SELECT id, session_label, summary, trigger_text, done_text, not_done_text, handoff_text, commit_hash, ci_status, created_at
         FROM session_log WHERE id = ?'
    );
    $stmt->execute([$id]);
    $row = $stmt->fetch();
    if ($row === false) {
        // Should be unreachable (we just inserted it) — same defensive
        // pattern as trackerRepo.php's createTrackerItem().
        throw new \RuntimeException('Entrée créée mais introuvable après insertion.');
    }
    return mapSessionLogRow($row);
}
