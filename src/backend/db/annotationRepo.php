<?php
declare(strict_types=1);

namespace AuditEngine;

/**
 * Annotations — FEAT-006, admin-only in-app comment/annotation tool. An
 * admin (gated behind `manage_annotations`) pins a timestamped, app-
 * version-stamped comment to an {x,y} position and, where resolvable, a
 * stable reference to the specific UI element under the pointer/touch at
 * capture time. See docs/ROADMAP.md item 10 for the full spec and
 * docs/DEV_STATUS.md's 2026-09-06 (thirty-fourth session) entry for the
 * session that built this.
 */

function mapAnnotationRow(array $r): array
{
    return [
        'id' => (int)$r['id'],
        'screen' => $r['screen'],
        'elementRef' => $r['element_ref'],
        'x' => (float)$r['x'],
        'y' => (float)$r['y'],
        'comment' => $r['comment'],
        'appVersion' => $r['app_version'],
        'status' => $r['status'],
        'createdAt' => $r['created_at'],
        'updatedAt' => $r['updated_at'],
        'createdBy' => (int)$r['created_by'],
        'createdByName' => $r['created_by_name'],
    ];
}

/** @param string|null $status pass null for no filter */
function listAnnotations(?string $status = null): array
{
    $pdo = getPdo();
    $sql = 'SELECT a.id, a.screen, a.element_ref, a.x, a.y, a.comment, a.app_version,
                   a.status, a.created_at, a.updated_at, a.created_by,
                   u.name AS created_by_name
            FROM annotations a
            JOIN users u ON u.id = a.created_by';
    $params = [];
    if ($status !== null) {
        $sql .= ' WHERE a.status = ?';
        $params[] = $status;
    }
    $sql .= ' ORDER BY a.created_at DESC';
    $stmt = $pdo->prepare($sql);
    $stmt->execute($params);
    return array_map(fn($r) => mapAnnotationRow($r), $stmt->fetchAll());
}

function getAnnotationById(int $id): ?array
{
    $stmt = getPdo()->prepare(
        'SELECT a.id, a.screen, a.element_ref, a.x, a.y, a.comment, a.app_version,
                a.status, a.created_at, a.updated_at, a.created_by, u.name AS created_by_name
         FROM annotations a JOIN users u ON u.id = a.created_by WHERE a.id = ?'
    );
    $stmt->execute([$id]);
    $row = $stmt->fetch();
    return $row ? mapAnnotationRow($row) : null;
}

/** @throws \RuntimeException if the comment is empty after trimming */
function createAnnotation(string $screen, ?string $elementRef, float $x, float $y, string $comment, string $appVersion, int $createdBy): array
{
    $comment = trim($comment);
    if ($comment === '') {
        throw new \RuntimeException('Le commentaire ne peut pas être vide.');
    }
    $stmt = getPdo()->prepare(
        'INSERT INTO annotations (screen, element_ref, x, y, comment, app_version, created_by)
         VALUES (?, ?, ?, ?, ?, ?, ?)'
    );
    $stmt->execute([
        trim($screen),
        ($elementRef !== null && trim($elementRef) !== '') ? trim($elementRef) : null,
        $x,
        $y,
        $comment,
        trim($appVersion),
        $createdBy,
    ]);
    $id = (int)getPdo()->lastInsertId();
    $created = getAnnotationById($id);
    if ($created === null) {
        // Should be unreachable (we just inserted it), but keep the return
        // type honest rather than risk a null-derefencing caller.
        throw new \RuntimeException('Annotation créée mais introuvable après insertion.');
    }
    return $created;
}

/** @throws \RuntimeException if the id doesn't exist or the status value is invalid */
function updateAnnotationStatus(int $id, string $status): array
{
    if (!in_array($status, ['open', 'actioned', 'dismissed'], true)) {
        throw new \RuntimeException("Statut invalide : $status");
    }
    $existing = getAnnotationById($id);
    if ($existing === null) {
        throw new \RuntimeException('Annotation introuvable.');
    }
    $stmt = getPdo()->prepare('UPDATE annotations SET status = ? WHERE id = ?');
    $stmt->execute([$status, $id]);
    $updated = getAnnotationById($id);
    if ($updated === null) {
        throw new \RuntimeException('Annotation introuvable après mise à jour.');
    }
    return $updated;
}

function deleteAnnotation(int $id): void
{
    $stmt = getPdo()->prepare('DELETE FROM annotations WHERE id = ?');
    $stmt->execute([$id]);
}
