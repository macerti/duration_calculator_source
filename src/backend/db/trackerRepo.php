<?php
declare(strict_types=1);

namespace AuditEngine;

/**
 * Bug/feature/tech-debt tracker — API layer for the tables created
 * schema-only by migration 004 (docs/BUGLOG.md → docs/DEV_STATUS.md's
 * thirty-ninth-session hand-off: "Build the CRUD API for
 * tracker_items/tracker_updates, gated behind the new manage_tracker
 * permission — annotationRepo.php is the closest existing pattern to
 * mirror"). Mirrors annotationRepo.php's shape deliberately: same
 * map-row / list / get / create / update / delete structure, same
 * pattern of throwing \RuntimeException with a French, user-facing
 * message on validation failure for api/index.php to catch and turn
 * into a 400.
 *
 * See migrations/004_add_bug_feature_tracker.sql's own header comment
 * for the full column-by-column design rationale (code-as-PK, why
 * `type` is VARCHAR not ENUM, why `status` IS an ENUM, the three
 * similar-looking free-text fields, tracker_updates as a second table).
 */

/**
 * `type` is a VARCHAR in the DB (migration 004, point 2: the set is
 * expected to grow without needing a migration). This allowlist is an
 * API-layer integrity check, not a DB constraint — extending it is a
 * one-line code change here, never an ALTER TABLE, which preserves the
 * migration's original intent while still stopping a typo'd type from
 * silently landing in the table (the DB layer alone can't do that for
 * a plain VARCHAR).
 */
const TRACKER_TYPES = ['bug', 'feature', 'techdebt', 'other'];
const TRACKER_STATUSES = ['open', 'in_progress', 'fixed_unverified', 'verified', 'closed'];
const TRACKER_PRIORITIES = ['p0', 'p1', 'p2', 'p3'];

function mapTrackerItemRow(array $r): array
{
    return [
        'code' => $r['code'],
        'type' => $r['type'],
        'title' => $r['title'],
        'userDescription' => $r['user_description'],
        'technicalDescription' => $r['technical_description'],
        'status' => $r['status'],
        'priority' => $r['priority'],
        'dependencies' => $r['dependencies'],
        'testsToDo' => $r['tests_to_do'],
        'comments' => $r['comments'],
        'createdAt' => $r['created_at'],
        'updatedAt' => $r['updated_at'],
    ];
}

function mapTrackerUpdateRow(array $r): array
{
    return [
        'id' => (int)$r['id'],
        'itemCode' => $r['item_code'],
        'done' => $r['done'],
        'next' => $r['next'],
        'createdAt' => $r['created_at'],
    ];
}

/**
 * @param string|null $status one of TRACKER_STATUSES, or null for no filter
 * @param string|null $type one of TRACKER_TYPES, or null for no filter
 * @param string|null $priority one of TRACKER_PRIORITIES, or null for no filter
 * @param string|null $search free-text search (code/title/user_description/
 *   technical_description/comments, case-insensitive substring), or null for
 *   no filter. Added so an admin can find a specific item across a backlog
 *   too large to scan visually — same motivation as the status/type/priority
 *   filters above, just unstructured instead of a fixed set of values.
 */
function listTrackerItems(?string $status = null, ?string $type = null, ?string $priority = null, ?string $search = null): array
{
    $pdo = getPdo();
    $sql = 'SELECT code, type, title, user_description, technical_description, status, priority, dependencies, tests_to_do, comments, created_at, updated_at FROM tracker_items';
    $where = [];
    $params = [];
    if ($status !== null) { $where[] = 'status = ?'; $params[] = $status; }
    if ($type !== null) { $where[] = 'type = ?'; $params[] = $type; }
    if ($priority !== null) { $where[] = 'priority = ?'; $params[] = $priority; }
    if ($search !== null && trim($search) !== '') {
        $needle = '%' . str_replace(['%', '_'], ['\\%', '\\_'], trim($search)) . '%';
        $where[] = '(code LIKE ? OR title LIKE ? OR user_description LIKE ? OR technical_description LIKE ? OR comments LIKE ?)';
        array_push($params, $needle, $needle, $needle, $needle, $needle);
    }
    if ($where) $sql .= ' WHERE ' . implode(' AND ', $where);
    // Open work first (priority p0→p3, NULL priority last), then most
    // recently touched — an admin scanning the list wants the most
    // urgent, most-active items at the top, not creation order.
    $sql .= " ORDER BY FIELD(status, 'open','in_progress','fixed_unverified','verified','closed'),
                       FIELD(priority, 'p0','p1','p2','p3'),
                       updated_at DESC";
    $stmt = $pdo->prepare($sql);
    $stmt->execute($params);
    return array_map(fn($r) => mapTrackerItemRow($r), $stmt->fetchAll());
}

/** Returns the item with its full `updates` history (oldest first — read
 * top to bottom like a session log) attached, or null if not found. */
function getTrackerItemByCode(string $code): ?array
{
    $stmt = getPdo()->prepare(
        'SELECT code, type, title, user_description, technical_description, status, priority, dependencies, tests_to_do, comments, created_at, updated_at
         FROM tracker_items WHERE code = ?'
    );
    $stmt->execute([$code]);
    $row = $stmt->fetch();
    if ($row === false) return null;
    $item = mapTrackerItemRow($row);
    $item['updates'] = listTrackerUpdates($code);
    return $item;
}

function listTrackerUpdates(string $itemCode): array
{
    $stmt = getPdo()->prepare(
        'SELECT id, item_code, done, next, created_at FROM tracker_updates WHERE item_code = ? ORDER BY created_at ASC, id ASC'
    );
    $stmt->execute([$itemCode]);
    return array_map(fn($r) => mapTrackerUpdateRow($r), $stmt->fetchAll());
}

/**
 * @param array $fields code, type, title required; the rest optional
 * @throws \RuntimeException on invalid input or a duplicate code
 */
function createTrackerItem(array $fields): array
{
    $code = strtoupper(trim((string)($fields['code'] ?? '')));
    if ($code === '' || !preg_match('/^[A-Z][A-Z0-9]*-[0-9]+$/', $code)) {
        throw new \RuntimeException("Le code doit ressembler à « BUG-051 », « FEAT-007 » ou « DEBT-003 » (lettres majuscules, tiret, numéro).");
    }
    if (mb_strlen($code) > 20) {
        throw new \RuntimeException('Le code ne peut pas dépasser 20 caractères.');
    }
    $type = strtolower(trim((string)($fields['type'] ?? '')));
    if (!in_array($type, TRACKER_TYPES, true)) {
        throw new \RuntimeException("Type invalide : $type (attendu : " . implode(', ', TRACKER_TYPES) . ').');
    }
    $title = trim((string)($fields['title'] ?? ''));
    if ($title === '') {
        throw new \RuntimeException('Le titre est obligatoire.');
    }
    if (mb_strlen($title) > 200) {
        throw new \RuntimeException('Le titre ne peut pas dépasser 200 caractères.');
    }
    $status = strtolower(trim((string)($fields['status'] ?? 'open')));
    if (!in_array($status, TRACKER_STATUSES, true)) {
        throw new \RuntimeException("Statut invalide : $status (attendu : " . implode(', ', TRACKER_STATUSES) . ').');
    }
    $priority = $fields['priority'] ?? null;
    if ($priority !== null) {
        $priority = strtolower(trim((string)$priority));
        if ($priority === '') { $priority = null; }
        elseif (!in_array($priority, TRACKER_PRIORITIES, true)) {
            throw new \RuntimeException("Priorité invalide : $priority (attendu : " . implode(', ', TRACKER_PRIORITIES) . ' ou vide).');
        }
    }
    $nullableText = fn($v) => ($v === null || trim((string)$v) === '') ? null : trim((string)$v);

    $pdo = getPdo();
    $existing = $pdo->prepare('SELECT code FROM tracker_items WHERE code = ?');
    $existing->execute([$code]);
    if ($existing->fetch() !== false) {
        throw new \RuntimeException("Le code $code existe déjà.");
    }

    $stmt = $pdo->prepare(
        'INSERT INTO tracker_items (code, type, title, user_description, technical_description, status, priority, dependencies, tests_to_do, comments)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)'
    );
    $stmt->execute([
        $code, $type, $title,
        $nullableText($fields['userDescription'] ?? null),
        $nullableText($fields['technicalDescription'] ?? null),
        $status, $priority,
        $nullableText($fields['dependencies'] ?? null),
        $nullableText($fields['testsToDo'] ?? null),
        $nullableText($fields['comments'] ?? null),
    ]);
    $created = getTrackerItemByCode($code);
    if ($created === null) {
        // Should be unreachable (we just inserted it), but keep the return
        // type honest rather than risk a null-dereferencing caller — same
        // defensive pattern as annotationRepo.php's createAnnotation().
        throw new \RuntimeException('Élément créé mais introuvable après insertion.');
    }
    return $created;
}

/**
 * Partial update: only keys present in $fields are changed. Accepts the
 * same field names as createTrackerItem() except `code` (immutable — see
 * migration 004, point 1) and `type` (changing an item's fundamental
 * category after creation is rare enough, and consequential enough for
 * filtering/reporting, that this deliberately isn't wired up as a casual
 * one-field PATCH; delete-and-recreate is the explicit path if a type was
 * really wrong).
 *
 * @throws \RuntimeException if the code doesn't exist or a value is invalid
 */
function updateTrackerItem(string $code, array $fields): array
{
    $existing = getTrackerItemByCode($code);
    if ($existing === null) {
        throw new \RuntimeException('Élément introuvable.');
    }
    $set = [];
    $params = [];
    $nullableText = fn($v) => ($v === null || trim((string)$v) === '') ? null : trim((string)$v);

    if (array_key_exists('title', $fields)) {
        $title = trim((string)$fields['title']);
        if ($title === '') throw new \RuntimeException('Le titre est obligatoire.');
        if (mb_strlen($title) > 200) throw new \RuntimeException('Le titre ne peut pas dépasser 200 caractères.');
        $set[] = 'title = ?'; $params[] = $title;
    }
    if (array_key_exists('userDescription', $fields)) {
        $set[] = 'user_description = ?'; $params[] = $nullableText($fields['userDescription']);
    }
    if (array_key_exists('technicalDescription', $fields)) {
        $set[] = 'technical_description = ?'; $params[] = $nullableText($fields['technicalDescription']);
    }
    if (array_key_exists('status', $fields)) {
        $status = strtolower(trim((string)$fields['status']));
        if (!in_array($status, TRACKER_STATUSES, true)) {
            throw new \RuntimeException("Statut invalide : $status (attendu : " . implode(', ', TRACKER_STATUSES) . ').');
        }
        $set[] = 'status = ?'; $params[] = $status;
    }
    if (array_key_exists('priority', $fields)) {
        $priority = $fields['priority'];
        if ($priority !== null) {
            $priority = strtolower(trim((string)$priority));
            if ($priority === '') { $priority = null; }
            elseif (!in_array($priority, TRACKER_PRIORITIES, true)) {
                throw new \RuntimeException("Priorité invalide : $priority (attendu : " . implode(', ', TRACKER_PRIORITIES) . ' ou vide).');
            }
        }
        $set[] = 'priority = ?'; $params[] = $priority;
    }
    if (array_key_exists('dependencies', $fields)) {
        $set[] = 'dependencies = ?'; $params[] = $nullableText($fields['dependencies']);
    }
    if (array_key_exists('testsToDo', $fields)) {
        $set[] = 'tests_to_do = ?'; $params[] = $nullableText($fields['testsToDo']);
    }
    if (array_key_exists('comments', $fields)) {
        $set[] = 'comments = ?'; $params[] = $nullableText($fields['comments']);
    }

    if (!$set) {
        // Nothing to change — not an error, just a no-op. Mirrors how a
        // caller sending an empty PUT body should behave: return current
        // state rather than throwing over an empty diff.
        return $existing;
    }

    $params[] = $code;
    $stmt = getPdo()->prepare('UPDATE tracker_items SET ' . implode(', ', $set) . ' WHERE code = ?');
    $stmt->execute($params);
    $updated = getTrackerItemByCode($code);
    if ($updated === null) {
        throw new \RuntimeException('Élément introuvable après mise à jour.');
    }
    return $updated;
}

/** ON DELETE CASCADE (migration 004) removes the item's tracker_updates
 * history in the same statement — no separate cleanup needed here. */
function deleteTrackerItem(string $code): void
{
    $stmt = getPdo()->prepare('DELETE FROM tracker_items WHERE code = ?');
    $stmt->execute([$code]);
}

/**
 * Logs one append-only history row (migration 004, point 6) and, per
 * that same design note, refreshes tracker_items.comments to the new
 * `next` value — comments is documented as "normally refreshed from
 * tracker_updates.next each time an update is logged," so this keeps
 * that promise in code instead of leaving it as a manual step a caller
 * could forget. Optionally also updates `status` in the same call
 * (logging progress and moving a status forward, e.g. open →
 * in_progress, is normally one action from the UI's point of view, not
 * two separate requests).
 *
 * @throws \RuntimeException if the item doesn't exist, $done is empty,
 *   or $newStatus is provided and invalid
 */
function addTrackerUpdate(string $itemCode, string $done, ?string $next, ?string $newStatus = null): array
{
    $existing = getTrackerItemByCode($itemCode);
    if ($existing === null) {
        throw new \RuntimeException('Élément introuvable.');
    }
    $done = trim($done);
    if ($done === '') {
        throw new \RuntimeException("Le champ « fait » ne peut pas être vide.");
    }
    $next = ($next === null || trim($next) === '') ? null : trim($next);
    if ($newStatus !== null) {
        $newStatus = strtolower(trim($newStatus));
        if (!in_array($newStatus, TRACKER_STATUSES, true)) {
            throw new \RuntimeException("Statut invalide : $newStatus (attendu : " . implode(', ', TRACKER_STATUSES) . ').');
        }
    }

    $pdo = getPdo();
    $pdo->beginTransaction();
    try {
        $stmt = $pdo->prepare('INSERT INTO tracker_updates (item_code, done, next) VALUES (?, ?, ?)');
        $stmt->execute([$itemCode, $done, $next]);

        $set = ['comments = ?'];
        $params = [$next];
        if ($newStatus !== null) {
            $set[] = 'status = ?';
            $params[] = $newStatus;
        }
        $params[] = $itemCode;
        $upd = $pdo->prepare('UPDATE tracker_items SET ' . implode(', ', $set) . ' WHERE code = ?');
        $upd->execute($params);

        $pdo->commit();
    } catch (\Throwable $e) {
        $pdo->rollBack();
        throw $e;
    }

    $updated = getTrackerItemByCode($itemCode);
    if ($updated === null) {
        throw new \RuntimeException('Élément introuvable après mise à jour.');
    }
    return $updated;
}

/**
 * Suggests the next free code for a given prefix (e.g. 'BUG' → 'BUG-053'
 * if BUG-052 is the highest existing BUG-* code) so a dev creating a new
 * item doesn't have to manually scan the list to avoid a collision. Pure
 * suggestion — createTrackerItem() still re-checks uniqueness itself, so
 * a stale suggestion (two devs suggesting at once) can never actually
 * create a duplicate.
 */
function suggestNextTrackerCode(string $prefix): string
{
    $prefix = strtoupper(trim($prefix));
    if ($prefix === '' || !preg_match('/^[A-Z][A-Z0-9]*$/', $prefix)) {
        throw new \RuntimeException('Préfixe invalide (lettres/chiffres, sans tiret).');
    }
    $stmt = getPdo()->prepare("SELECT code FROM tracker_items WHERE code LIKE ?");
    $stmt->execute([$prefix . '-%']);
    $max = 0;
    $width = 3;
    foreach ($stmt->fetchAll(\PDO::FETCH_COLUMN) as $existingCode) {
        if (preg_match('/^' . preg_quote($prefix, '/') . '-([0-9]+)$/', (string)$existingCode, $m)) {
            $n = (int)$m[1];
            if ($n > $max) { $max = $n; }
            $width = max($width, strlen($m[1]));
        }
    }
    $next = $max + 1;
    return $prefix . '-' . str_pad((string)$next, $width, '0', STR_PAD_LEFT);
}
