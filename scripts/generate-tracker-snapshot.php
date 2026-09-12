#!/usr/bin/env php
<?php
declare(strict_types=1);

/**
 * Formats GET /dev-export's JSON into docs/TRACKER_SNAPSHOT.md — a
 * human- and AI-readable snapshot of the live tracker_items /
 * tracker_updates / session_log state, meant to be regenerated on a
 * schedule by .github/workflows/dev-export-snapshot.yml and committed
 * into this repo. The goal: `git pull` alone gets both the code and a
 * recent view of the actual live "problems" (bugs/features/tech debt/
 * annotations — annotations have lived inside tracker_items as
 * type='annotation' since migration 009), with no manual export step
 * and no standing database credentials handed to anyone pulling the repo.
 *
 * Usage: php scripts/generate-tracker-snapshot.php <path-to-dev-export.json>
 * Prints Markdown to stdout.
 *
 * This is a presentation layer only — it does not talk to the database
 * or the API itself; that separation keeps this script runnable and
 * testable with any saved JSON fixture, not just a live export.
 */

if ($argc < 2) {
    fwrite(STDERR, "Usage: php generate-tracker-snapshot.php <dev-export.json>\n");
    exit(1);
}

$raw = file_get_contents($argv[1]);
if ($raw === false) {
    fwrite(STDERR, "Could not read {$argv[1]}\n");
    exit(1);
}
$data = json_decode($raw, true);
if (!is_array($data) || !isset($data['trackerItems'])) {
    fwrite(STDERR, "Input does not look like a /dev-export response (missing trackerItems).\n");
    exit(1);
}

$items = $data['trackerItems'];
$updatesByCode = $data['trackerUpdatesByCode'] ?? [];
$sessionLog = $data['sessionLog'] ?? [];
$exportedAt = $data['exportedAt'] ?? gmdate('c');

// Open items first (the part that actually needs someone's attention),
// grouped by status then sorted by priority within each group — mirrors
// the ORIENTATIONS.md priority order (p0 > p1 > p2 > p3) rather than
// alphabetical or insertion order.
$priorityRank = ['p0' => 0, 'p1' => 1, 'p2' => 2, 'p3' => 3];
$statusGroups = [
    'open' => [],
    'in_progress' => [],
    'fixed_unverified' => [],
    'verified' => [],
    'closed' => [],
];
foreach ($items as $item) {
    $status = $item['status'] ?? 'open';
    $statusGroups[$status][] = $item;
}
foreach ($statusGroups as &$group) {
    usort($group, function ($a, $b) use ($priorityRank) {
        $pa = $priorityRank[$a['priority'] ?? 'p3'] ?? 3;
        $pb = $priorityRank[$b['priority'] ?? 'p3'] ?? 3;
        if ($pa !== $pb) return $pa <=> $pb;
        return strcmp($a['code'] ?? '', $b['code'] ?? '');
    });
}
unset($group);

function esc(?string $s): string
{
    return $s === null ? '' : str_replace(["\r\n", "\n"], ' ', trim($s));
}

echo "# Tracker snapshot (auto-generated)\n\n";
echo "> Generated {$exportedAt} by `.github/workflows/dev-export-snapshot.yml` calling `GET /dev-export`. ";
echo "Do not edit by hand — changes are overwritten on the next scheduled run. ";
echo "Source of truth is the live `tracker_items`/`tracker_updates`/`session_log` tables; this file exists ";
echo "so pulling this repo also gets you a recent read of them, without needing live database access.\n\n";

$statusLabels = [
    'open' => 'Open',
    'in_progress' => 'In progress',
    'fixed_unverified' => 'Fixed, unverified (needs a live click-through)',
    'verified' => 'Verified',
    'closed' => 'Closed',
];

foreach (['open', 'in_progress', 'fixed_unverified', 'verified', 'closed'] as $status) {
    $group = $statusGroups[$status];
    if (empty($group)) continue;
    // Closed items are historical noise for a "what needs doing" snapshot —
    // list codes only, no full detail, to keep the file from growing
    // unbounded as more items get closed over time.
    if ($status === 'closed') {
        echo "## " . $statusLabels[$status] . " (" . count($group) . ")\n\n";
        $codes = array_map(fn($i) => $i['code'], $group);
        echo implode(', ', $codes) . "\n\n";
        continue;
    }
    echo "## " . $statusLabels[$status] . " (" . count($group) . ")\n\n";
    foreach ($group as $item) {
        $code = $item['code'];
        $type = $item['type'];
        $priority = strtoupper($item['priority'] ?? '');
        $title = esc($item['title'] ?? '');
        echo "### [{$code}] ({$type}, {$priority}) {$title}\n\n";
        if (!empty($item['userDescription'])) {
            echo "- **Reported as**: " . esc($item['userDescription']) . "\n";
        }
        if (!empty($item['technicalDescription'])) {
            echo "- **Technical**: " . esc($item['technicalDescription']) . "\n";
        }
        if (!empty($item['testsToDo'])) {
            echo "- **Tests to do**: " . esc($item['testsToDo']) . "\n";
        }
        if (!empty($item['dependencies'])) {
            echo "- **Touches**: " . esc($item['dependencies']) . "\n";
        }
        if (!empty($item['comments'])) {
            echo "- **Comments**: " . esc($item['comments']) . "\n";
        }
        $updates = $updatesByCode[$code] ?? [];
        if (!empty($updates)) {
            echo "- **History**:\n";
            foreach ($updates as $u) {
                $when = esc($u['createdAt'] ?? '');
                $done = esc($u['done'] ?? '');
                $next = esc($u['next'] ?? '');
                echo "  - _{$when}_ — {$done}" . ($next !== '' ? " (next: {$next})" : "") . "\n";
            }
        }
        echo "\n";
    }
}

// Session log: most recent first, capped — this file is meant to be
// skimmed at the start of a session, not to replace docs/DEV_STATUS.md's
// full narrative history.
if (!empty($sessionLog)) {
    echo "## Recent session log (" . count($sessionLog) . " total, most recent 15 shown)\n\n";
    $recent = array_slice($sessionLog, 0, 15);
    foreach ($recent as $entry) {
        $label = esc($entry['sessionLabel'] ?? '');
        $when = esc($entry['createdAt'] ?? '');
        $summary = esc($entry['summary'] ?? '');
        echo "- **{$label}** _{$when}_ — {$summary}\n";
    }
    echo "\n";
}
