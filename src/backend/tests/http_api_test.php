<?php
declare(strict_types=1);

$base = rtrim($argv[1] ?? 'http://127.0.0.1:8080', '/');
// Matches Mailer.php's default when config.php sets no explicit
// mail.log_path — both this project's local config.php and CI's
// generated config.php rely on that same default, so this needs no
// special-casing between environments.
$mailLogPath = $argv[2] ?? sys_get_temp_dir() . '/audit_app_mail_log.txt';
$cookieJar = tempnam(sys_get_temp_dir(), 'audit_http_test_cookies_');
$failures = 0;
$passed = 0;

function check(bool $ok, string $name, string $detail = ''): void
{
    global $failures, $passed;
    if ($ok) { $passed++; echo "PASS $name\n"; }
    else { $failures++; echo "FAIL $name" . ($detail !== '' ? " — $detail" : '') . "\n"; }
}

/**
 * All calls share one cookie jar by default, so a login earlier in this
 * script keeps the session for every later call — including the
 * pre-existing /clients and /cases tests below, which now require
 * authentication (see api/index.php's requireAuth() gating).
 */
function request(string $method, string $url, ?array $body = null, ?string $csrfToken = null, bool $withSession = true): array
{
    global $cookieJar;
    $ch = curl_init($url);
    $headers = ['Content-Type: application/json'];
    if ($csrfToken !== null) $headers[] = 'X-CSRF-Token: ' . $csrfToken;
    $opts = [
        CURLOPT_RETURNTRANSFER => true,
        CURLOPT_CUSTOMREQUEST => $method,
        CURLOPT_HTTPHEADER => $headers,
        CURLOPT_TIMEOUT => 15,
        CURLOPT_HEADER => true,
    ];
    if ($withSession) {
        $opts[CURLOPT_COOKIEJAR] = $cookieJar;
        $opts[CURLOPT_COOKIEFILE] = $cookieJar;
    }
    curl_setopt_array($ch, $opts);
    if ($body !== null) curl_setopt($ch, CURLOPT_POSTFIELDS, json_encode($body));
    $raw = curl_exec($ch);
    $status = (int)curl_getinfo($ch, CURLINFO_HTTP_CODE);
    $headerSize = (int)curl_getinfo($ch, CURLINFO_HEADER_SIZE);
    $error = curl_error($ch);
    curl_close($ch);
    if ($raw === false) return [$status, null, '', $error, ''];
    $rawHeaders = substr($raw, 0, $headerSize);
    $rawBody = substr($raw, $headerSize);
    return [$status, $rawBody !== '' ? json_decode($rawBody, true) : null, $rawBody, $error, $rawHeaders];
}

function locationHeader(string $rawHeaders): ?string
{
    if (preg_match('/^Location:\s*(.+)$/mi', $rawHeaders, $m)) {
        return trim($m[1]);
    }
    return null;
}

/** Finds the most recently emailed link's raw token (64 hex chars). */
function latestMailToken(string $mailLogPath): ?string
{
    if (!is_file($mailLogPath)) return null;
    $content = file_get_contents($mailLogPath);
    if ($content === false) return null;
    preg_match_all('/token=([0-9a-f]{64})/', $content, $m);
    return $m[1] ? end($m[1]) : null;
}

/**
 * Finds the most recent absolute verify-email LINK Mailer.php actually
 * built and wrote to the log — as opposed to a URL this test constructs
 * itself from a bare token. Added 2026-09-06 (BUG-047 #3): the previous
 * version of this suite always built its own "$base/auth/verify-
 * email?token=..." string, so a real production bug in Mailer.php's link
 * construction (a duplicated '/api' segment, from combining
 * config['basePath'] with a literal '/api/...' suffix) went undetected
 * through a 50/50-passing run. Requires config.php's 'app_url' to match
 * the origin this test targets — see config.example.php's local-dev note.
 */
function latestMailLink(string $mailLogPath): ?string
{
    if (!is_file($mailLogPath)) return null;
    $content = file_get_contents($mailLogPath);
    if ($content === false) return null;
    preg_match_all('#https?://\S*?/auth/verify-email\?token=[0-9a-f]{64}#', $content, $m);
    return $m[0] ? end($m[0]) : null;
}

echo "Deployment-topology HTTP regression tests against $base\n";

[$status, $health] = request('GET', "$base/health", null, null, false);
check($status === 200, 'GET /health returns 200', "status=$status");
check(($health['dbConnected'] ?? false) === true, 'health reports MariaDB connected');

// --- POST/GET /migrate — production migration endpoint (BUG-045 / ROADMAP P1 item 0) ---
// Uses its own request() calls (withSession=false) since this endpoint is
// intentionally NOT session/CSRF-gated — auth here is the shared secret a
// real deploy sends via X-Migrate-Secret, which CI's generated config.php
// sets to $migrateSecret below (see build-test-publish.yml).
$migrateSecret = 'ci-test-migrate-secret-do-not-use-in-prod';
function requestWithSecret(string $method, string $url, ?string $secret): array
{
    $ch = curl_init($url);
    $headers = ['Content-Type: application/json'];
    if ($secret !== null) $headers[] = 'X-Migrate-Secret: ' . $secret;
    curl_setopt_array($ch, [
        CURLOPT_RETURNTRANSFER => true,
        CURLOPT_CUSTOMREQUEST => $method,
        CURLOPT_HTTPHEADER => $headers,
        CURLOPT_TIMEOUT => 15,
    ]);
    $raw = curl_exec($ch);
    $status = (int)curl_getinfo($ch, CURLINFO_HTTP_CODE);
    curl_close($ch);
    return [$status, $raw !== false && $raw !== '' ? json_decode($raw, true) : null];
}

[$status, $body] = requestWithSecret('GET', "$base/migrate", null);
check($status === 401, 'GET /migrate with no secret is rejected', "status=$status");

[$status, $body] = requestWithSecret('GET', "$base/migrate", 'the-wrong-secret');
check($status === 401, 'GET /migrate with wrong secret is rejected', "status=$status");

[$status, $body] = requestWithSecret('GET', "$base/migrate", $migrateSecret);
check($status === 200, 'GET /migrate with correct secret returns status', "status=$status");
check(($body['mode'] ?? '') === 'status', 'GET /migrate does not apply anything (status mode)');
check(is_array($body['migrations'] ?? null), 'GET /migrate lists migrations array');

[$status, $body] = requestWithSecret('POST', "$base/migrate", $migrateSecret);
check($status === 200, 'POST /migrate with correct secret applies migrations', "status=$status");
check(($body['success'] ?? false) === true, 'POST /migrate reports success');
// CI's own earlier "Run database migrations" workflow step already applied
// everything via the CLI before the HTTP server even started, so this call
// is expected to be a pure no-op — which is exactly the idempotence
// property this endpoint depends on when a real deploy calls it more than
// once (e.g. a retried workflow run).
check(($body['applied'] ?? -1) === 0, 'POST /migrate is a no-op when already current (idempotent)', 'applied=' . ($body['applied'] ?? '?'));

// =========================================================================
// Auth + RBAC — this test user is the first ever registered in this fresh
// CI/local database, so it auto-bootstraps as administrateur (see
// userRepo.php's createLocalUser). That lets this same script exercise
// the admin routes without needing a second account.
// =========================================================================

$testEmail = 'ci-' . bin2hex(random_bytes(4)) . '@macerti-ci.test';
$testPassword = 'ci regression test passphrase 1';

[$status] = request('GET', "$base/clients", null, null, false);
check($status === 401, 'GET /clients with no session is rejected', "status=$status (expected 401)");

[$status, $reg] = request('POST', "$base/auth/register", ['name' => 'CI Test User', 'email' => $testEmail, 'password' => $testPassword], null, false);
check($status === 201, 'POST /auth/register creates account', "status=$status " . json_encode($reg));

[$status, $dup] = request('POST', "$base/auth/register", ['name' => 'CI Test User', 'email' => $testEmail, 'password' => $testPassword], null, false);
check($status === 409, 'POST /auth/register rejects duplicate email', "status=$status");

[$status, $tooEarly] = request('POST', "$base/auth/login", ['email' => $testEmail, 'password' => $testPassword], null, false);
check($status === 403 && ($tooEarly['code'] ?? '') === 'email_not_verified', 'login blocked before email verification', "status=$status " . json_encode($tooEarly));

$verifyToken = latestMailToken($mailLogPath);
check($verifyToken !== null, 'verification token found in dev mail log');

// BUG-047 #3 regression guard: request the EXACT link Mailer.php built and
// wrote to the log, not a URL this test assembles itself — see
// latestMailLink()'s own comment for why the previous version of this
// check could never have caught that bug.
$verifyLink = latestMailLink($mailLogPath);
check($verifyLink !== null && str_starts_with($verifyLink, $base), 'mail log contains the real verify-email link, matching this test\'s own base URL', 'link=' . ($verifyLink ?? 'null') . ' base=' . $base);

[$status, , , , $verifyHeaders] = request('GET', $verifyLink ?? ("$base/auth/verify-email?token=" . urlencode((string)$verifyToken)), null, null, false);
$loc = locationHeader($verifyHeaders);
check($status === 302 && $loc !== null && str_contains($loc, 'verified=1'), 'GET /auth/verify-email redirects with verified=1', "status=$status location=$loc");

[$status, $wrongPass] = request('POST', "$base/auth/login", ['email' => $testEmail, 'password' => 'definitely the wrong one'], null, false);
check($status === 401, 'login rejects wrong password generically', "status=$status");

[$status, $login] = request('POST', "$base/auth/login", ['email' => $testEmail, 'password' => $testPassword]);
check($status === 200, 'POST /auth/login succeeds after verification', "status=$status " . json_encode($login));
check(($login['role']['name'] ?? '') === 'administrateur', 'first-ever registrant is bootstrapped as administrateur', json_encode($login['role'] ?? null));
check(in_array('manage_users', $login['permissions'] ?? [], true), 'bootstrap admin has manage_users permission');
$csrf = $login['csrfToken'] ?? null;
check(is_string($csrf) && strlen($csrf) > 10, 'login response includes a CSRF token');

[$status, $me] = request('GET', "$base/auth/me");
check($status === 200 && ($me['email'] ?? '') === $testEmail, 'GET /auth/me reflects the logged-in user', "status=$status");

// --- Admin routes (this user has manage_users + manage_roles) ---
[$status, $roles] = request('GET', "$base/admin/roles");
check($status === 200 && count($roles ?? []) === 3, 'GET /admin/roles lists the 3 seeded roles', "status=$status count=" . count($roles ?? []));

[$status, $newRole] = request('POST', "$base/admin/roles", ['name' => 'ci-role', 'description' => 'Test role', 'permissions' => ['manage_clients']], $csrf);
check($status === 201 && ($newRole['name'] ?? '') === 'ci-role', 'POST /admin/roles creates a role', "status=$status " . json_encode($newRole));
$newRoleId = (int)($newRole['id'] ?? 0);

[$status, $renamed] = request('PUT', "$base/admin/roles/$newRoleId", ['name' => 'ci-role-renamed', 'permissions' => ['manage_clients', 'manage_calculations']], $csrf);
check($status === 200 && ($renamed['name'] ?? '') === 'ci-role-renamed' && count($renamed['permissions'] ?? []) === 2, 'PUT /admin/roles/:id renames + updates permissions', "status=$status " . json_encode($renamed));

[$status, $noCsrf] = request('DELETE', "$base/admin/roles/$newRoleId");
check($status === 403, 'DELETE /admin/roles/:id without CSRF token is rejected', "status=$status");

[$status] = request('DELETE', "$base/admin/roles/$newRoleId", null, $csrf);
check($status === 200, 'DELETE /admin/roles/:id succeeds with CSRF token', "status=$status");

[$status, $perms] = request('GET', "$base/admin/permissions");
// 9, not 8: migration 011 (FEAT-008 slice 1) added manage_parameters —
// same one-line bump every prior permission-adding migration required
// here (see this test's own history for manage_annotations/manage_tracker).
check($status === 200 && count($perms ?? []) === 9, 'GET /admin/permissions lists the 9 seeded permissions', "status=$status count=" . count($perms ?? []));

[$status, $users] = request('GET', "$base/admin/users");
check($status === 200 && count($users ?? []) === 1, 'GET /admin/users lists the single CI user', "status=$status count=" . count($users ?? []));

[$status] = request('DELETE', "$base/admin/roles/1", null, $csrf); // administrateur is is_system-protected
check($status === 400, 'DELETE /admin/roles/:id refuses to delete the protected system role', "status=$status");

// --- FEAT-006: admin annotation/comment tool (docs/ROADMAP.md item 10) ---
[$status] = request('GET', "$base/admin/annotations", null, null, false);
check($status === 401, 'GET /admin/annotations with no session is rejected', "status=$status");

[$status, $emptyList] = request('GET', "$base/admin/annotations");
check($status === 200 && $emptyList === [], 'GET /admin/annotations starts empty', "status=$status " . json_encode($emptyList));

[$status, $badAnnotation] = request('POST', "$base/admin/annotations", ['screen' => 'HomeScreen', 'x' => 10, 'y' => 20, 'comment' => '   ', 'appVersion' => '5.1.10'], $csrf);
check($status === 400, 'POST /admin/annotations rejects a blank comment', "status=$status " . json_encode($badAnnotation));

[$status, $noCsrfAnnotation] = request('POST', "$base/admin/annotations", ['screen' => 'HomeScreen', 'x' => 10, 'y' => 20, 'comment' => 'ci test comment', 'appVersion' => '5.1.10']);
check($status === 403, 'POST /admin/annotations without CSRF token is rejected', "status=$status");

[$status, $annotation] = request('POST', "$base/admin/annotations", [
    'screen' => 'HomeScreen',
    'elementRef' => 'header-title',
    'x' => 123.5,
    'y' => 45,
    'comment' => 'ci test comment on the header',
    'appVersion' => '5.1.10',
], $csrf);
check($status === 201, 'POST /admin/annotations creates an annotation', "status=$status " . json_encode($annotation));
check(($annotation['status'] ?? '') === 'open' && ($annotation['elementRef'] ?? '') === 'header-title' && (float)($annotation['x'] ?? 0) === 123.5, 'created annotation has expected fields', json_encode($annotation));
$annotationId = (int)($annotation['id'] ?? 0);

[$status, $listed] = request('GET', "$base/admin/annotations");
check($status === 200 && count($listed ?? []) === 1, 'GET /admin/annotations now lists the 1 created annotation', "status=$status count=" . count($listed ?? []));

[$status, $filtered] = request('GET', "$base/admin/annotations?status=dismissed");
check($status === 200 && $filtered === [], 'GET /admin/annotations?status=dismissed filters correctly (none yet)', "status=$status " . json_encode($filtered));

[$status, $badStatus] = request('PUT', "$base/admin/annotations/$annotationId", ['status' => 'not-a-real-status'], $csrf);
check($status === 400, 'PUT /admin/annotations/:id rejects an invalid status value', "status=$status");

[$status, $actioned] = request('PUT', "$base/admin/annotations/$annotationId", ['status' => 'actioned'], $csrf);
check($status === 200 && ($actioned['status'] ?? '') === 'actioned', 'PUT /admin/annotations/:id updates status to actioned', "status=$status " . json_encode($actioned));

[$status, , $mdExport] = request('GET', "$base/admin/annotations/export");
check($status === 200 && str_contains($mdExport, 'ci test comment on the header') && str_contains($mdExport, 'header-title'), 'GET /admin/annotations/export (markdown) includes the comment text and element ref', "status=$status");

[$status, $jsonExport] = request('GET', "$base/admin/annotations/export?format=json");
check($status === 200 && ($jsonExport['count'] ?? 0) === 1 && is_array($jsonExport['annotations'] ?? null), 'GET /admin/annotations/export?format=json returns structured data', "status=$status " . json_encode($jsonExport));

[$status] = request('DELETE', "$base/admin/annotations/$annotationId", null, $csrf);
check($status === 200, 'DELETE /admin/annotations/:id succeeds', "status=$status");

[$status, $afterDelete] = request('GET', "$base/admin/annotations");
check($status === 200 && $afterDelete === [], 'GET /admin/annotations is empty again after delete', "status=$status " . json_encode($afterDelete));

// --- FEAT-010: bug/feature/tech-debt tracker (docs/ROADMAP.md item 12) ---
// migrations/005_seed_tracker_backlog.sql seeds 13 real backlog rows on a
// fresh DB (2 of type 'bug': BUG-051, BUG-052) — this block asserts
// against that real count, not an empty list, per the session that wrote
// these routes' own hand-off note to do exactly that.
[$status] = request('GET', "$base/admin/tracker/items", null, null, false);
check($status === 401, 'GET /admin/tracker/items with no session is rejected', "status=$status");

[$status, $trackerList] = request('GET', "$base/admin/tracker/items");
check($status === 200 && count($trackerList ?? []) === 64, 'GET /admin/tracker/items lists the 64 seeded items (14 original + 50 archived from BUGLOG.md, migration 008)', "status=$status count=" . count($trackerList ?? []));

[$status, $bugsOnly] = request('GET', "$base/admin/tracker/items?type=bug");
check($status === 200 && count($bugsOnly ?? []) === 52, 'GET /admin/tracker/items?type=bug filters to the 52 seeded bugs (2 original + 50 archived, migration 008)', "status=$status count=" . count($bugsOnly ?? []));

[$status, $badFilter] = request('GET', "$base/admin/tracker/items?status=not-a-status");
check($status === 400, 'GET /admin/tracker/items rejects an invalid status filter', "status=$status");

// ?search= — free-text match across code/title/user_description/
// technical_description/comments (case-insensitive substring).
[$status, $searchByCode] = request('GET', "$base/admin/tracker/items?search=BUG-051");
check($status === 200 && count($searchByCode ?? []) === 1 && ($searchByCode[0]['code'] ?? '') === 'BUG-051', 'GET /admin/tracker/items?search= matches by code', "status=$status count=" . count($searchByCode ?? []));

[$status, $searchByTitleWord] = request('GET', "$base/admin/tracker/items?" . http_build_query(['search' => 'annotation']));
check($status === 200 && count($searchByTitleWord ?? []) >= 1 && in_array('FEAT-006', array_column($searchByTitleWord ?? [], 'code'), true), 'GET /admin/tracker/items?search= matches by title substring', "status=$status count=" . count($searchByTitleWord ?? []));

[$status, $searchCaseInsensitive] = request('GET', "$base/admin/tracker/items?" . http_build_query(['search' => 'ANNOTATION']));
check($status === 200 && count($searchCaseInsensitive ?? []) === count($searchByTitleWord ?? []), 'GET /admin/tracker/items?search= is case-insensitive', "status=$status");

[$status, $searchNoMatch] = request('GET', "$base/admin/tracker/items?" . http_build_query(['search' => 'zzz-no-such-term-zzz']));
check($status === 200 && count($searchNoMatch ?? []) === 0, 'GET /admin/tracker/items?search= with no match returns an empty list', "status=$status count=" . count($searchNoMatch ?? []));

[$status, $searchCombined] = request('GET', "$base/admin/tracker/items?" . http_build_query(['search' => 'e', 'type' => 'bug']));
check($status === 200 && count(array_filter($searchCombined ?? [], fn($i) => $i['type'] !== 'bug')) === 0, 'GET /admin/tracker/items?search= combines with other filters', "status=$status count=" . count($searchCombined ?? []));

[$status, $searchTooLong] = request('GET', "$base/admin/tracker/items?" . http_build_query(['search' => str_repeat('x', 201)]));
check($status === 400, 'GET /admin/tracker/items?search= rejects an overlong term', "status=$status");

[$status, $nextCode] = request('GET', "$base/admin/tracker/next-code?prefix=TEST");
check($status === 200 && ($nextCode['code'] ?? '') === 'TEST-001', 'GET /admin/tracker/next-code suggests TEST-001 for an unused prefix', "status=$status " . json_encode($nextCode));

[$status, $noCsrfItem] = request('POST', "$base/admin/tracker/items", ['code' => 'TEST-001', 'type' => 'bug', 'title' => 'ci test item']);
check($status === 403, 'POST /admin/tracker/items without CSRF token is rejected', "status=$status");

[$status, $badCode] = request('POST', "$base/admin/tracker/items", ['code' => 'not a code', 'type' => 'bug', 'title' => 'ci test item'], $csrf);
check($status === 400, 'POST /admin/tracker/items rejects a malformed code', "status=$status " . json_encode($badCode));

[$status, $newItem] = request('POST', "$base/admin/tracker/items", [
    'code' => 'TEST-001',
    'type' => 'bug',
    'title' => 'ci test item',
    'priority' => 'p2',
    'userDescription' => 'reported by the CI script',
], $csrf);
check($status === 201 && ($newItem['status'] ?? '') === 'open' && ($newItem['priority'] ?? '') === 'p2' && ($newItem['updates'] ?? null) === [], 'POST /admin/tracker/items creates an item, open by default, empty history', "status=$status " . json_encode($newItem));

[$status, $fetched] = request('GET', "$base/admin/tracker/items/TEST-001");
check($status === 200 && ($fetched['title'] ?? '') === 'ci test item', 'GET /admin/tracker/items/:code returns the created item', "status=$status " . json_encode($fetched));

[$status] = request('GET', "$base/admin/tracker/items/NOPE-999");
check($status === 404, 'GET /admin/tracker/items/:code 404s for an unknown code', "status=$status");

[$status, $afterUpdate] = request('PUT', "$base/admin/tracker/items/TEST-001", ['status' => 'in_progress', 'technicalDescription' => 'root cause identified'], $csrf);
check($status === 200 && ($afterUpdate['status'] ?? '') === 'in_progress' && ($afterUpdate['technicalDescription'] ?? '') === 'root cause identified', 'PUT /admin/tracker/items/:code applies a partial update', "status=$status " . json_encode($afterUpdate));

[$status, $badStatusUpdate] = request('PUT', "$base/admin/tracker/items/TEST-001", ['status' => 'not-a-status'], $csrf);
check($status === 400, 'PUT /admin/tracker/items/:code rejects an invalid status value', "status=$status");

[$status, $afterLog] = request('POST', "$base/admin/tracker/items/TEST-001/updates", ['done' => 'Fixed the root cause', 'next' => 'Awaiting live verification', 'status' => 'fixed_unverified'], $csrf);
check($status === 201 && ($afterLog['status'] ?? '') === 'fixed_unverified' && ($afterLog['comments'] ?? '') === 'Awaiting live verification' && count($afterLog['updates'] ?? []) === 1, 'POST /admin/tracker/items/:code/updates logs history and moves status + comments', "status=$status " . json_encode($afterLog));

[$status, $blankDone] = request('POST', "$base/admin/tracker/items/TEST-001/updates", ['done' => '   '], $csrf);
check($status === 400, 'POST /admin/tracker/items/:code/updates rejects a blank done field', "status=$status");

[$status] = request('DELETE', "$base/admin/tracker/items/TEST-001");
check($status === 403, 'DELETE /admin/tracker/items/:code without CSRF token is rejected', "status=$status");

[$status] = request('DELETE', "$base/admin/tracker/items/TEST-001", null, $csrf);
check($status === 200, 'DELETE /admin/tracker/items/:code succeeds with CSRF token', "status=$status");

[$status, $backToBaseline] = request('GET', "$base/admin/tracker/items");
check($status === 200 && count($backToBaseline ?? []) === 64, 'GET /admin/tracker/items is back to the 64 seeded rows after delete', "status=$status count=" . count($backToBaseline ?? []));

// --- Multiselect status/type/priority filters (2026-09-10, AdminTrackerScreen.tsx filter rework) ---
// Comma-separated is the wire format; a bare single value must still work
// exactly as before (backward compatibility for any existing caller).
[$status, $multiStatus] = request('GET', "$base/admin/tracker/items?" . http_build_query(['status' => 'open,in_progress']));
check($status === 200 && count($multiStatus ?? []) > 0 && count(array_filter($multiStatus ?? [], fn($i) => !in_array($i['status'], ['open', 'in_progress'], true))) === 0, 'GET /admin/tracker/items?status= accepts a comma-separated multiselect', "status=$status count=" . count($multiStatus ?? []));

[$status, $multiType] = request('GET', "$base/admin/tracker/items?" . http_build_query(['type' => 'bug,feature']));
check($status === 200 && count($multiType ?? []) > 0 && count(array_filter($multiType ?? [], fn($i) => !in_array($i['type'], ['bug', 'feature'], true))) === 0, 'GET /admin/tracker/items?type= accepts a comma-separated multiselect', "status=$status count=" . count($multiType ?? []));

[$status] = request('GET', "$base/admin/tracker/items?" . http_build_query(['status' => 'open,not-a-real-status']));
check($status === 400, 'GET /admin/tracker/items?status= rejects a multiselect containing one invalid value', "status=$status");

[$status, $singleStillWorks] = request('GET', "$base/admin/tracker/items?type=bug");
check($status === 200 && count($singleStillWorks ?? []) === 52, 'GET /admin/tracker/items?type= (single bare value) still works after the multiselect change', "status=$status count=" . count($singleStillWorks ?? []));

// --- POST /admin/tracker/annotations (migration 009 merge: the in-app pin
// tool's new, single create path into the tracker instead of a separate
// annotations table — "why have two lists, merge them", Mahdi 2026-09-10) ---
[$status] = request('POST', "$base/admin/tracker/annotations", ['screen' => 'HomeScreen', 'x' => 10, 'y' => 20, 'comment' => 'ci pin test', 'appVersion' => '5.1.10'], null, false);
check($status === 401, 'POST /admin/tracker/annotations with no session is rejected', "status=$status");

[$status] = request('POST', "$base/admin/tracker/annotations", ['screen' => 'HomeScreen', 'x' => 10, 'y' => 20, 'comment' => 'ci pin test', 'appVersion' => '5.1.10']);
check($status === 403, 'POST /admin/tracker/annotations without CSRF token is rejected', "status=$status");

[$status, $blankPin] = request('POST', "$base/admin/tracker/annotations", ['screen' => 'HomeScreen', 'x' => 10, 'y' => 20, 'comment' => '   ', 'appVersion' => '5.1.10'], $csrf);
check($status === 400, 'POST /admin/tracker/annotations rejects a blank comment', "status=$status " . json_encode($blankPin));

[$status, $pinItem] = request('POST', "$base/admin/tracker/annotations", [
    'screen' => 'HomeScreen',
    'elementRef' => 'header-title',
    'x' => 123.5,
    'y' => 45,
    'comment' => 'ci test comment on the header via the merged pin tool',
    'appVersion' => '5.1.10',
], $csrf);
check(
    $status === 201
    && ($pinItem['type'] ?? '') === 'annotation'
    && ($pinItem['status'] ?? '') === 'open'
    && ($pinItem['screen'] ?? '') === 'HomeScreen'
    && ($pinItem['elementRef'] ?? '') === 'header-title'
    && (float)($pinItem['x'] ?? 0) === 123.5
    && ($pinItem['userDescription'] ?? '') === 'ci test comment on the header via the merged pin tool'
    && ($pinItem['technicalDescription'] ?? null) === null
    && ($pinItem['priority'] ?? null) === null
    && str_starts_with($pinItem['code'] ?? '', 'ANN-'),
    'POST /admin/tracker/annotations creates a tracker_items row directly (type=annotation, technicalDescription/priority left NULL for a dev to fill in later)',
    "status=$status " . json_encode($pinItem)
);

[$status, $withPinItem] = request('GET', "$base/admin/tracker/items?type=annotation");
check($status === 200 && count($withPinItem ?? []) === 1 && ($withPinItem[0]['code'] ?? '') === ($pinItem['code'] ?? ''), 'GET /admin/tracker/items?type=annotation lists the pinned item — one merged list, not two', "status=$status count=" . count($withPinItem ?? []));

// A dev now completes the row — exactly the hand-off workflow this merge is for.
[$status, $triaged] = request('PUT', "$base/admin/tracker/items/{$pinItem['code']}", ['technicalDescription' => 'Confirmed: header title tap target is too small', 'priority' => 'p2'], $csrf);
check($status === 200 && ($triaged['technicalDescription'] ?? '') === 'Confirmed: header title tap target is too small' && ($triaged['priority'] ?? '') === 'p2', 'a dev can PUT the NULL technicalDescription/priority fields in afterwards, same as any other tracker item', "status=$status " . json_encode($triaged));

[$status] = request('DELETE', "$base/admin/tracker/items/{$pinItem['code']}", null, $csrf);
check($status === 200, 'cleanup: DELETE the pinned test item', "status=$status");

// --- Session/action log (migration 007) ---
[$status] = request('GET', "$base/admin/session-log", null, null, false);
check($status === 401, 'GET /admin/session-log with no session is rejected', "status=$status");

[$status, $emptyLog] = request('GET', "$base/admin/session-log");
check($status === 200 && $emptyLog === [], 'GET /admin/session-log starts empty', "status=$status " . json_encode($emptyLog));

[$status] = request('POST', "$base/admin/session-log", ['sessionLabel' => 'ci test', 'summary' => 'ci test entry']);
check($status === 403, 'POST /admin/session-log without CSRF token is rejected', "status=$status");

[$status, $blankSummary] = request('POST', "$base/admin/session-log", ['sessionLabel' => 'ci test', 'summary' => '   '], $csrf);
check($status === 400, 'POST /admin/session-log rejects a blank summary', "status=$status");

[$status, $badHash] = request('POST', "$base/admin/session-log", ['sessionLabel' => 'ci test', 'summary' => 'x', 'commitHash' => 'not-hex!'], $csrf);
check($status === 400, 'POST /admin/session-log rejects a non-hex commit hash', "status=$status");

[$status, $newEntry] = request('POST', "$base/admin/session-log", [
    'sessionLabel' => 'ci test session',
    'summary' => 'automated regression entry',
    'trigger' => 'http_api_test.php',
    'done' => 'created via POST',
    'commitHash' => 'abc1234',
    'ciStatus' => 'pending',
], $csrf);
check($status === 201 && ($newEntry['sessionLabel'] ?? '') === 'ci test session' && ($newEntry['commitHash'] ?? '') === 'abc1234' && array_key_exists('notDone', $newEntry ?? []) && $newEntry['notDone'] === null, 'POST /admin/session-log creates an entry', "status=$status " . json_encode($newEntry));

[$status, $listedLog] = request('GET', "$base/admin/session-log");
check($status === 200 && count($listedLog ?? []) === 1 && ($listedLog[0]['id'] ?? null) === ($newEntry['id'] ?? null), 'GET /admin/session-log lists the created entry', "status=$status count=" . count($listedLog ?? []));

[$status, $limited] = request('GET', "$base/admin/session-log?limit=1");
check($status === 200 && count($limited ?? []) === 1, 'GET /admin/session-log?limit= is honoured', "status=$status count=" . count($limited ?? []));

// --- Dossier reference codification (FEAT-008 slice 1, migration 011) ---
[$status] = request('GET', "$base/admin/dossier-ref-config", null, null, false);
check($status === 401, 'GET /admin/dossier-ref-config with no session is rejected', "status=$status");

[$status, $refConfig] = request('GET', "$base/admin/dossier-ref-config");
check(
    $status === 200 && $refConfig['enabled'] === false && $refConfig['prefix'] === 'DC-'
        && $refConfig['dateFormat'] === 'Y' && $refConfig['counterDigits'] === 4 && $refConfig['resetPeriod'] === 'yearly',
    'GET /admin/dossier-ref-config returns migration 011 defaults, disabled',
    "status=$status " . json_encode($refConfig)
);

[$status] = request('PUT', "$base/admin/dossier-ref-config", ['enabled' => true, 'prefix' => 'CI-TEST-']);
check($status === 403, 'PUT /admin/dossier-ref-config without CSRF token is rejected', "status=$status");

[$status, $updatedRefConfig] = request('PUT', "$base/admin/dossier-ref-config", [
    'enabled' => true,
    'prefix' => 'CI-TEST-',
    'suffix' => '',
    'dateFormat' => 'Y',
    'counterDigits' => 3,
    'resetPeriod' => 'never',
], $csrf);
check(
    $status === 200 && $updatedRefConfig['enabled'] === true && $updatedRefConfig['prefix'] === 'CI-TEST-' && $updatedRefConfig['counterDigits'] === 3,
    'PUT /admin/dossier-ref-config applies a partial update',
    "status=$status " . json_encode($updatedRefConfig)
);
check(
    preg_match('/^CI-TEST-\d{4}-\d{3}$/', $updatedRefConfig['previewSample'] ?? '') === 1,
    'previewSample matches prefix + date + zero-padded counter pattern, uses current counter without consuming it',
    $updatedRefConfig['previewSample'] ?? ''
);

$refCasesToClean = [];
$refCasePayload = [
    'multiSite' => false,
    'sites' => [[
        'siteId' => 'site-ci-1', 'name' => 'Site principal', 'isHq' => true, 'naceCode' => '',
        'personnel' => [
            'siteId' => 'site-ci-1', 'declaredTotalHeadcount' => 0,
            'shiftTeams' => [['label' => 'Equipe 1', 'headcount' => 0, 'pctRepetitiveOrSimilar' => 0]],
            'nonShift' => ['headcount' => 0, 'pctRepetitiveOrSimilar' => 0],
            'indirect' => ['headcount' => 0],
        ],
        'standards' => [[
            'standard' => 'ISO9001', 'active' => true, 'stage' => 'Initial', 'riskLevel' => 'Moyen',
            'stage1Selected' => true, 'stage2Selected' => true,
            'factors' => ['standard' => 'ISO9001', 'ticked' => [], 'justificationText' => ''],
            'sampledThisYear' => [1 => true, 2 => true, 3 => true], 'isExtensionSite' => false,
        ]],
    ]],
];

[$status, $caseNoRef1] = request('POST', "$base/cases", $refCasePayload + ['status' => 'draft']);
check($status === 201, 'POST /cases with blank dossierRef auto-generates one when enabled', "status=$status");
$refCasesToClean[] = (int)($caseNoRef1['id'] ?? 0);
$generatedRef1 = $caseNoRef1['result']['dossierRef'] ?? null;
check(
    is_string($generatedRef1) && preg_match('/^CI-TEST-\d{4}-\d{3}$/', $generatedRef1) === 1,
    'auto-generated dossierRef matches the configured pattern',
    $generatedRef1 ?? 'null'
);

[$status, $caseNoRef2] = request('POST', "$base/cases", $refCasePayload + ['status' => 'draft']);
$refCasesToClean[] = (int)($caseNoRef2['id'] ?? 0);
$generatedRef2 = $caseNoRef2['result']['dossierRef'] ?? null;
check(
    is_string($generatedRef2) && $generatedRef2 !== $generatedRef1,
    'a second auto-generated dossierRef advances the counter, never repeats',
    ($generatedRef2 ?? 'null') . ' vs ' . ($generatedRef1 ?? 'null')
);

[$status, $caseWithRef] = request('POST', "$base/cases", $refCasePayload + ['status' => 'draft', 'dossierRef' => 'CI-MANUAL-REF']);
$refCasesToClean[] = (int)($caseWithRef['id'] ?? 0);
check(
    $status === 201 && ($caseWithRef['result']['dossierRef'] ?? null) === 'CI-MANUAL-REF',
    'an explicitly supplied dossierRef is never overridden by auto-generation',
    json_encode($caseWithRef['result']['dossierRef'] ?? null)
);

foreach ($refCasesToClean as $refCaseId) {
    if ($refCaseId > 0) request('DELETE', "$base/cases/$refCaseId");
}

// Restore the disabled default so this test file's own state never
// outlives the run it created it in (same convention as deleting the
// ci-role/annotation/tracker rows created above).
[$status] = request('PUT', "$base/admin/dossier-ref-config", [
    'enabled' => false, 'prefix' => 'DC-', 'suffix' => '', 'dateFormat' => 'Y', 'counterDigits' => 4, 'resetPeriod' => 'yearly',
], $csrf);
check($status === 200, 'dossier-ref-config restored to migration 011 defaults after the test', "status=$status");

// --- Forgot / reset password ---
[$status] = request('POST', "$base/auth/forgot-password", ['email' => $testEmail], null, false);
check($status === 200, 'POST /auth/forgot-password returns 200', "status=$status");

$resetToken = latestMailToken($mailLogPath);
$newPassword = 'a brand new ci passphrase 2';
[$status, $afterReset] = request('POST', "$base/auth/reset-password", ['token' => $resetToken, 'newPassword' => $newPassword]);
check($status === 200 && ($afterReset['email'] ?? '') === $testEmail, 'POST /auth/reset-password succeeds and auto-signs in', "status=$status " . json_encode($afterReset));
$csrf = $afterReset['csrfToken'] ?? $csrf;

[$status] = request('POST', "$base/auth/login", ['email' => $testEmail, 'password' => $newPassword], null, false);
check($status === 200, 'login with the newly reset password succeeds', "status=$status");

// --- Profile self-service ---
[$status, $renamedProfile] = request('PUT', "$base/auth/profile", ['name' => 'CI Test User Renamed'], $csrf);
check($status === 200 && ($renamedProfile['name'] ?? '') === 'CI Test User Renamed', 'PUT /auth/profile updates name', "status=$status");

// =========================================================================
// Existing business-data regression (now runs inside the authenticated
// session established above — these routes require login as of this
// session's RBAC work; see docs/DEV_STATUS.md)
// =========================================================================

[$status, $nace] = request('GET', "$base/nace/search?q=Cultures");
check($status === 200, 'GET /nace/search returns 200', "status=$status");
check(is_array($nace) && count($nace) > 0, 'NACE search returns results');

[$status, $nace01] = request('GET', "$base/nace/01");
check($status === 200, 'GET /nace/01 returns 200', "status=$status");
check(is_array($nace01) && ($nace01['codeNace'] ?? '') === '01', 'NACE code 01 is returned');

$input = [
    'dossierRef' => 'CI-' . bin2hex(random_bytes(4)),
    'multiSite' => false,
    'sites' => [[
        'siteId' => 'site-ci-1',
        'name' => 'Site principal',
        'isHq' => true,
        'naceCode' => '',
        'personnel' => [
            'siteId' => 'site-ci-1',
            'declaredTotalHeadcount' => 0,
            'shiftTeams' => [['label' => 'Equipe 1', 'headcount' => 0, 'pctRepetitiveOrSimilar' => 0]],
            'nonShift' => ['headcount' => 0, 'pctRepetitiveOrSimilar' => 0],
            'indirect' => ['headcount' => 0],
        ],
        'standards' => [[
            'standard' => 'ISO9001',
            'active' => true,
            'stage' => 'Initial',
            'riskLevel' => 'Moyen',
            'stage1Selected' => true,
            'stage2Selected' => true,
            'factors' => ['standard' => 'ISO9001', 'ticked' => [], 'justificationText' => ''],
            'sampledThisYear' => [1 => true, 2 => true, 3 => true],
            'isExtensionSite' => false,
        ]],
    ]],
];

[$status, $created] = request('POST', "$base/cases", $input + ['status' => 'draft']);
check($status === 201, 'POST /cases creates draft', "status=$status");
$id = (int)($created['id'] ?? 0);
check($id > 0, 'POST /cases returns case id');

$input['dossierRef'] .= '-UPDATED';
[$status, $updated] = request('PUT', "$base/cases/$id", [
    'input' => $input,
    'status' => 'calculated',
    'roundingOverrides' => ['site-ci-1:ISO9001:stage1' => 1.25],
]);
check($status === 200, 'PUT /cases/:id updates case', "status=$status");
check((int)($updated['id'] ?? 0) === $id, 'PUT returns same id');
check(isset($updated['result']) && is_array($updated['result']), 'PUT returns recalculated result');

[$status, $fetched] = request('GET', "$base/cases/$id");
check($status === 200, 'GET /cases/:id returns saved case', "status=$status");
check(($fetched['input']['dossierRef'] ?? '') === $input['dossierRef'], 'GET preserves updated input');
check(($fetched['status'] ?? '') === 'calculated', 'GET preserves status');
check(($fetched['roundingOverrides']['site-ci-1:ISO9001:stage1'] ?? null) === 1.25, 'GET preserves rounding overrides');

[$status] = request('DELETE', "$base/cases/$id");
check($status === 200, 'DELETE /cases/:id cleans regression case', "status=$status");

// --- Logout, then confirm the session is really gone ---
[$status] = request('POST', "$base/auth/logout");
check($status === 200, 'POST /auth/logout succeeds');

[$status] = request('GET', "$base/clients");
check($status === 401, 'GET /clients after logout is rejected again', "status=$status");

@unlink($cookieJar);
echo "---\n$passed passed, $failures failed\n";
exit($failures > 0 ? 1 : 0);
