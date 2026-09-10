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
// 'annotation' added migration 009 (2026-09-10, annotations/tracker
// merge): the placeholder type a row created via the in-app pin tool
// gets, before a dev reclassifies it as bug/feature/techdebt/other and
// fills in the technical fields — see createAnnotationTrackerItem()
// below and migration 009's own header comment for the full workflow.
const TRACKER_TYPES = ['bug', 'feature', 'techdebt', 'other', 'annotation'];
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
        // Annotation-capture columns (migration 009) — NULL for every
        // normal dev-created row; only populated for a row created
        // through the in-app pin tool. See createAnnotationTrackerItem().
        'screen' => $r['screen'] ?? null,
        'elementRef' => $r['element_ref'] ?? null,
        'x' => isset($r['x']) && $r['x'] !== null ? (float)$r['x'] : null,
        'y' => isset($r['y']) && $r['y'] !== null ? (float)$r['y'] : null,
        'appVersion' => $r['app_version'] ?? null,
        'createdBy' => isset($r['created_by']) && $r['created_by'] !== null ? (int)$r['created_by'] : null,
        'sourceAnnotationId' => isset($r['source_annotation_id']) && $r['source_annotation_id'] !== null ? (int)$r['source_annotation_id'] : null,
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
 * @param array|string|null $status one or more of TRACKER_STATUSES, or
 *   null/[] for no filter. Accepts a single string too (old call shape,
 *   kept working rather than forcing every caller to wrap a lone value
 *   in an array) — normalized to an array internally either way.
 * @param array|string|null $type one or more of TRACKER_TYPES, or null/[]
 *   for no filter. Same single-string-or-array acceptance as $status.
 * @param array|string|null $priority one or more of TRACKER_PRIORITIES, or
 *   null/[] for no filter. Same single-string-or-array acceptance.
 * @param string|null $search free-text search (code/title/user_description/
 *   technical_description/comments, case-insensitive substring), or null for
 *   no filter. Added so an admin can find a specific item across a backlog
 *   too large to scan visually — same motivation as the status/type/priority
 *   filters above, just unstructured instead of a fixed set of values.
 *
 * Multiselect (arrays) added 2026-09-10 per Mahdi's request for
 * `AdminTrackerScreen.tsx`'s filters to let an admin check several
 * statuses/types/priorities at once instead of exactly one — e.g. "show
 * me everything that isn't closed" (open + in_progress + fixed_unverified
 * + verified all checked together) is the screen's new default view.
 */
function listTrackerItems($status = null, $type = null, $priority = null, ?string $search = null): array
{
    $normalize = function ($v): array {
        if ($v === null) return [];
        if (is_array($v)) return array_values(array_filter($v, fn($x) => $x !== null && $x !== ''));
        return $v === '' ? [] : [$v];
    };
    $statuses = $normalize($status);
    $types = $normalize($type);
    $priorities = $normalize($priority);

    $pdo = getPdo();
    $sql = 'SELECT code, type, title, user_description, technical_description, status, priority, dependencies, tests_to_do, comments,
                   screen, element_ref, x, y, app_version, created_by, source_annotation_id, created_at, updated_at
            FROM tracker_items';
    $where = [];
    $params = [];
    $inClause = fn(array $vals) => '(' . implode(',', array_fill(0, count($vals), '?')) . ')';
    if ($statuses) { $where[] = 'status IN ' . $inClause($statuses); array_push($params, ...$statuses); }
    if ($types) { $where[] = 'type IN ' . $inClause($types); array_push($params, ...$types); }
    if ($priorities) { $where[] = 'priority IN ' . $inClause($priorities); array_push($params, ...$priorities); }
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
        'SELECT code, type, title, user_description, technical_description, status, priority, dependencies, tests_to_do, comments,
                screen, element_ref, x, y, app_version, created_by, source_annotation_id, created_at, updated_at
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

/**
 * Creates a `tracker_items` row directly from the in-app annotation pin
 * tool (migration 009 — merging FEAT-006's `annotations` table into this
 * one) — "user creates an annotation directly in db, then a dev fills
 * the NULL fields in later," per Mahdi's 2026-09-10 request. This is now
 * `AnnotationCapture.tsx`'s only create path; `annotationRepo.php`'s
 * `createAnnotation()` is left in place but unlinked from any UI (see
 * migration 009's own header comment for why that table/function isn't
 * removed outright).
 *
 * Auto-generates the next free `ANN-NNN` code via `suggestNextTrackerCode()`
 * — same mechanism a human dev's "Suggérer" button in the manual create
 * form already uses — so pinning a comment stays a single tap-and-type
 * action; nobody has to think up a code for a quick in-app note.
 * `type='annotation'`, `status='open'`, and the six capture columns
 * below are the only things set. `technicalDescription`, `priority`,
 * `dependencies`, and `testsToDo` are deliberately left NULL — that is
 * the "fields for the next dev to fill in" this whole merge is for.
 *
 * @param string $screen screen/route name the pin was made on (frontend-
 *   supplied, free text — same as annotations.screen was)
 * @param string|null $elementRef best-effort UI element reference, or
 *   null (same semantics as annotations.element_ref)
 * @param float $x capture x position
 * @param float $y capture y position
 * @param string $comment the reporter's own words — becomes both
 *   `title` (truncated to 200 chars, migration 008's own truncation
 *   rule reused rather than reinvented) and the full `userDescription`
 * @param string $appVersion the app's own version-footer string at
 *   capture time (same single-source-of-truth reuse as annotations had)
 * @param int $createdBy the authenticated admin's user id
 * @throws \RuntimeException on blank/oversized input — same validation
 *   annotationRepo.php's createAnnotation() used to apply, mirrored here
 *   since this function replaces it as the only caller of these rules
 */
function createAnnotationTrackerItem(string $screen, ?string $elementRef, float $x, float $y, string $comment, string $appVersion, int $createdBy): array
{
    $screen = trim($screen);
    if ($screen === '') {
        throw new \RuntimeException("Le champ « screen » est obligatoire.");
    }
    if (mb_strlen($screen) > 150) {
        throw new \RuntimeException('Le champ « screen » ne peut pas dépasser 150 caractères.');
    }
    $elementRef = ($elementRef === null || trim($elementRef) === '') ? null : trim($elementRef);
    if ($elementRef !== null && mb_strlen($elementRef) > 150) {
        throw new \RuntimeException("Le champ « elementRef » ne peut pas dépasser 150 caractères.");
    }
    $comment = trim($comment);
    if ($comment === '') {
        throw new \RuntimeException('Le commentaire est obligatoire.');
    }
    if (mb_strlen($comment) > 5000) {
        throw new \RuntimeException('Le commentaire ne peut pas dépasser 5000 caractères.');
    }
    $appVersion = trim($appVersion);
    if ($appVersion === '') {
        throw new \RuntimeException("Le champ « appVersion » est obligatoire.");
    }
    if (mb_strlen($appVersion) > 30) {
        throw new \RuntimeException("Le champ « appVersion » ne peut pas dépasser 30 caractères.");
    }

    $code = suggestNextTrackerCode('ANN');
    $title = mb_strlen($comment) > 200 ? mb_substr($comment, 0, 197) . '...' : $comment;

    $stmt = getPdo()->prepare(
        'INSERT INTO tracker_items (code, type, title, user_description, status, screen, element_ref, x, y, app_version, created_by)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)'
    );
    $stmt->execute([$code, 'annotation', $title, $comment, 'open', $screen, $elementRef, $x, $y, $appVersion, $createdBy]);

    $created = getTrackerItemByCode($code);
    if ($created === null) {
        // Should be unreachable (we just inserted it) — same defensive
        // pattern as createTrackerItem()'s own equivalent check.
        throw new \RuntimeException('Élément créé mais introuvable après insertion.');
    }
    return $created;
}
