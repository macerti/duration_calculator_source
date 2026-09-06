<?php
declare(strict_types=1);

namespace AuditEngine\Auth;

/**
 * Minimal driver-based mailer — no Composer/PHPMailer, matching this
 * codebase's existing "raw PHP, no framework" style (same reasoning as
 * MicrosoftOAuth.php/GoogleOAuth.php using raw cURL instead of a client
 * library). Two drivers:
 *
 *  - 'log'  — writes the email to a local file instead of sending it.
 *             Safe default for local/dev work; this is what this
 *             session's own local config.php used.
 *  - 'smtp' — a hand-rolled SMTP client (AUTH LOGIN, STARTTLS or implicit
 *             TLS) for real sending, e.g. through Mahdi's info@macerti.com
 *             mailbox once its SMTP host/port/username/password are known.
 *             NOT YET LIVE-TESTED against a real mail server — see
 *             docs/DEV_STATUS.md's hand-off note for exactly what's needed
 *             before this can be trusted in production.
 *
 * Config shape expected in config.php's 'mail' key:
 *   'driver'    => 'log' | 'smtp'
 *   'log_path'  => string   (only used by 'log')
 *   'host'      => string   (only used by 'smtp')
 *   'port'      => int      (only used by 'smtp', e.g. 587 or 465)
 *   'encryption'=> 'tls' | 'ssl' | ''  (only used by 'smtp')
 *   'username'  => string   (only used by 'smtp')
 *   'password'  => string   (only used by 'smtp')
 *   'from_email'=> string   (required — e.g. info@macerti.com)
 *   'from_name' => string   (required)
 */

/**
 * @throws \RuntimeException on send failure (caller decides what, if
 *         anything, to tell the end user — never leak SMTP internals to
 *         the client, consistent with this codebase's existing error-
 *         response discipline, see SECURITY.md)
 */
function sendMail(array $config, string $toEmail, string $toName, string $subject, string $htmlBody, string $textBody): void
{
    $mailConfig = $config['mail'] ?? [];
    $driver = $mailConfig['driver'] ?? 'log';

    if ($driver === 'log') {
        sendMailViaLog($mailConfig, $toEmail, $toName, $subject, $htmlBody, $textBody);
        return;
    }

    if ($driver === 'smtp') {
        sendMailViaSmtp($mailConfig, $toEmail, $toName, $subject, $htmlBody, $textBody);
        return;
    }

    throw new \RuntimeException("Pilote d'envoi d'e-mail inconnu : $driver");
}

function sendMailViaLog(array $mailConfig, string $toEmail, string $toName, string $subject, string $htmlBody, string $textBody): void
{
    $path = $mailConfig['log_path'] ?? (sys_get_temp_dir() . '/audit_app_mail_log.txt');
    $entry = "==== " . date('Y-m-d H:i:s') . " ====\n"
        . "To: $toName <$toEmail>\n"
        . "Subject: $subject\n"
        . "--- text ---\n$textBody\n"
        . "--- html ---\n$htmlBody\n\n";
    $written = @file_put_contents($path, $entry, FILE_APPEND | LOCK_EX);
    if ($written === false) {
        throw new \RuntimeException("Impossible d'écrire le journal d'e-mails de test ($path).");
    }
}

function sendMailViaSmtp(array $mailConfig, string $toEmail, string $toName, string $subject, string $htmlBody, string $textBody): void
{
    $host = $mailConfig['host'] ?? '';
    $port = (int)($mailConfig['port'] ?? 587);
    $encryption = $mailConfig['encryption'] ?? 'tls'; // 'tls' (STARTTLS) | 'ssl' (implicit) | ''
    $username = $mailConfig['username'] ?? '';
    $password = $mailConfig['password'] ?? '';
    $fromEmail = $mailConfig['from_email'] ?? '';
    $fromName = $mailConfig['from_name'] ?? '';

    if ($host === '' || $fromEmail === '') {
        throw new \RuntimeException("Configuration SMTP incomplète (host/from_email manquant).");
    }

    $transport = $encryption === 'ssl' ? "ssl://$host" : $host;
    $socket = @stream_socket_client("$transport:$port", $errno, $errstr, 15, STREAM_CLIENT_CONNECT);
    if ($socket === false) {
        throw new \RuntimeException("Connexion SMTP impossible ($host:$port) : $errstr");
    }
    stream_set_timeout($socket, 15);

    $expect = function (string $context) use ($socket): string {
        $line = '';
        do {
            $chunk = fgets($socket, 515);
            if ($chunk === false) break;
            $line .= $chunk;
        } while (isset($chunk[3]) && $chunk[3] === '-'); // multi-line SMTP replies use "250-"
        if ($line === '' || !preg_match('/^[23]\d\d/', $line)) {
            fclose($socket);
            throw new \RuntimeException("Erreur SMTP ($context) : " . trim($line));
        }
        return $line;
    };
    $send = function (string $cmd) use ($socket): void {
        fwrite($socket, $cmd . "\r\n");
    };

    $expect('connect');
    $localHost = $_SERVER['SERVER_NAME'] ?? 'localhost';
    $send("EHLO $localHost");
    $expect('EHLO');

    if ($encryption === 'tls') {
        $send('STARTTLS');
        $expect('STARTTLS');
        if (!@stream_socket_enable_crypto($socket, true, STREAM_CRYPTO_METHOD_TLS_CLIENT)) {
            fclose($socket);
            throw new \RuntimeException("Échec de la négociation TLS avec le serveur SMTP.");
        }
        $send("EHLO $localHost");
        $expect('EHLO (post-STARTTLS)');
    }

    if ($username !== '') {
        $send('AUTH LOGIN');
        $expect('AUTH LOGIN');
        $send(base64_encode($username));
        $expect('AUTH username');
        $send(base64_encode($password));
        $expect('AUTH password');
    }

    $send("MAIL FROM:<$fromEmail>");
    $expect('MAIL FROM');
    $send("RCPT TO:<$toEmail>");
    $expect('RCPT TO');
    $send('DATA');
    $expect('DATA');

    $boundary = 'ddc-mail-' . bin2hex(random_bytes(8));
    $headers = [
        'From: ' . encodeHeader($fromName) . " <$fromEmail>",
        'To: ' . encodeHeader($toName) . " <$toEmail>",
        'Subject: ' . encodeHeader($subject),
        'MIME-Version: 1.0',
        "Content-Type: multipart/alternative; boundary=\"$boundary\"",
        'Date: ' . date('r'),
    ];
    $body = implode("\r\n", $headers) . "\r\n\r\n"
        . "--$boundary\r\nContent-Type: text/plain; charset=UTF-8\r\nContent-Transfer-Encoding: 8bit\r\n\r\n"
        . dotStuff($textBody) . "\r\n"
        . "--$boundary\r\nContent-Type: text/html; charset=UTF-8\r\nContent-Transfer-Encoding: 8bit\r\n\r\n"
        . dotStuff($htmlBody) . "\r\n"
        . "--$boundary--\r\n";

    $send($body . '.');
    $expect('end of DATA');
    $send('QUIT');
    fclose($socket);
}

/** RFC 5321 transparency: a line starting with "." must be escaped as "..". */
function dotStuff(string $body): string
{
    return preg_replace('/^\./m', '..', $body) ?? $body;
}

function encodeHeader(string $value): string
{
    if (preg_match('/^[\x20-\x7E]*$/', $value)) {
        return $value; // pure ASCII, no encoding needed
    }
    return '=?UTF-8?B?' . base64_encode($value) . '?=';
}

// =========================================================================
// Branded HTML email shell (BUG-047 #2, Mahdi's 2026-09-06 live-verification
// finding: the registration email should be well-designed HTML following
// the macerti.com brand theme, with a proper layout for emails).
//
// Colors match the brand palette already recorded for Macerti's visual
// identity: Ink Charcoal #2F3E46, Slate #526D82, Sage Teal #5F8A8B, Paper
// #F5F7F8. Table-based layout, every style inline: deliberate, not a
// stylistic regression — most email clients (Outlook desktop's Word
// rendering engine especially) strip <style> blocks and ignore flexbox/
// grid entirely, so table+inline-style is still the only layout approach
// that renders consistently across clients. No external logo image: an
// inline text wordmark survives mail clients that block remote images by
// default (the common case before a recipient clicks "display images"),
// so the brand identity is never lost to a broken-image icon.
// =========================================================================

function renderBrandedEmail(string $appName, string $preheader, string $bodyHtml): string
{
    $ink = '#2F3E46';
    $slate = '#526D82';
    $paper = '#F5F7F8';

    return <<<HTML
<!DOCTYPE html>
<html lang="fr">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>{$appName}</title>
</head>
<body style="margin:0;padding:0;background-color:{$paper};font-family:-apple-system,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;">
<div style="display:none;max-height:0;overflow:hidden;opacity:0;">{$preheader}</div>
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background-color:{$paper};padding:32px 16px;">
<tr><td align="center">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:520px;background-color:#ffffff;border-radius:12px;overflow:hidden;border:1px solid #e2e2e5;">
<tr><td style="background-color:{$ink};padding:28px 32px;">
<span style="color:{$paper};font-size:20px;font-weight:700;letter-spacing:2px;text-transform:uppercase;">Macerti</span>
</td></tr>
<tr><td style="padding:36px 32px;">
{$bodyHtml}
</td></tr>
<tr><td style="padding:20px 32px;background-color:{$paper};border-top:1px solid #e2e2e5;">
<p style="margin:0;color:{$slate};font-size:12px;line-height:1.6;">
Macerti — organisme de certification et d'audit.<br>
Cet e-mail vous a été envoyé automatiquement par {$appName}, merci de ne pas y répondre directement.
</p>
</td></tr>
</table>
</td></tr>
</table>
</body>
</html>
HTML;
}

function renderEmailButton(string $link, string $label): string
{
    return '<table role="presentation" cellpadding="0" cellspacing="0" style="margin:24px 0;"><tr>'
        . '<td style="border-radius:8px;background-color:#5F8A8B;">'
        . '<a href="' . $link . '" style="display:inline-block;padding:14px 28px;color:#ffffff;font-size:15px;'
        . 'font-weight:600;text-decoration:none;border-radius:8px;">' . $label . '</a></td></tr></table>';
}

// =========================================================================
// Auth-specific email templates
// =========================================================================

function sendVerificationEmail(array $config, string $toEmail, string $toName, string $rawToken): void
{
    $appUrl = rtrim($config['app_url'] ?? '', '/');
    $appName = $config['app_name'] ?? 'Audit Duration Calculator';
    // BUG-047 #3 (Mahdi, 2026-09-06 live verification — clicking this exact
    // link returned "404 not found"). Original bug: this hardcoded a
    // literal '/api/...' suffix ON TOP OF config['basePath'], producing
    // '/duration_calculator/api/api/auth/verify-email' in production
    // (basePath is already the full '/duration_calculator/api' prefix —
    // see config.example.php).
    // First attempted fix (dropping basePath, keeping the literal '/api/'
    // — mirroring MicrosoftOAuth/GoogleOAuth's redirect_uri pattern in
    // api/index.php) turned out to be wrong too, caught by actually
    // running this against a local server rather than trusting the
    // analogy: locally the API is served at the ORIGIN root (basePath ==
    // ''), so a hardcoded '/api/' 404s there just as surely as the double
    // one did in production — the OAuth analogy only ever got verified in
    // production (real Microsoft/Google redirects), never locally, so its
    // own latent version of this same fragility was never exposed.
    // Correct construction: basePath is defined (api/index.php's own
    // comment, config.example.php) as the full path from the ORIGIN root
    // to the API — not from app_url's path — so it must be combined with
    // app_url's origin (scheme+host) only, never app_url's full value
    // (which in production already contains '/duration_calculator', the
    // same segment basePath starts with — concatenating both would
    // duplicate that instead, the mirror image of the original bug).
    $origin = $appUrl;
    $urlParts = parse_url($appUrl);
    if ($urlParts !== false && isset($urlParts['scheme'], $urlParts['host'])) {
        $origin = $urlParts['scheme'] . '://' . $urlParts['host'] . (isset($urlParts['port']) ? ':' . $urlParts['port'] : '');
    }
    $basePath = rtrim($config['basePath'] ?? '', '/');
    // Why CI's 50/50 never caught the original bug: http_api_test.php used
    // to build its own "$base/auth/verify-email?token=..." URL directly
    // from the token it extracts from the mail log, rather than parsing
    // the real link out of the email body — so the route handler was
    // tested, but this link-construction code never was. Closed by adding
    // latestMailLink() there, which is what caught THIS fix's own first
    // (locally-404ing) attempt before it went any further — see
    // docs/BUGLOG.md BUG-047 for the full trail.
    $link = $origin . $basePath . '/auth/verify-email?token=' . urlencode($rawToken);

    $subject = "Confirmez votre adresse e-mail — $appName";
    $text = "Bonjour $toName,\n\nConfirmez votre adresse e-mail en cliquant sur ce lien :\n$link\n\n"
        . "Ce lien expire dans 24 heures. Si vous n'êtes pas à l'origine de cette demande, ignorez cet e-mail.\n\n$appName";

    $body = "<p style=\"margin:0 0 16px;color:#2F3E46;font-size:16px;\">Bonjour $toName,</p>"
        . "<p style=\"margin:0;color:#526D82;font-size:15px;line-height:1.6;\">Merci de votre inscription. "
        . "Confirmez votre adresse e-mail pour activer votre compte :</p>"
        . renderEmailButton($link, 'Confirmer mon adresse e-mail')
        . "<p style=\"margin:0;color:#888888;font-size:13px;line-height:1.6;\">Si le bouton ne fonctionne pas, "
        . "copiez ce lien dans votre navigateur :<br><a href=\"$link\" style=\"color:#5F8A8B;word-break:break-all;\">$link</a></p>"
        . "<p style=\"margin:20px 0 0;color:#888888;font-size:12px;\">Ce lien expire dans 24 heures. "
        . "Si vous n'êtes pas à l'origine de cette demande, ignorez cet e-mail.</p>";

    $html = renderBrandedEmail($appName, "Confirmez votre adresse e-mail pour activer votre compte $appName.", $body);

    sendMail($config, $toEmail, $toName, $subject, $html, $text);
}

function sendPasswordResetEmail(array $config, string $toEmail, string $toName, string $rawToken): void
{
    $appUrl = rtrim($config['app_url'] ?? '', '/');
    $appName = $config['app_name'] ?? 'Audit Duration Calculator';
    // Unlike email verification, this link goes straight to the frontend
    // (not a backend redirect) — the user still has to type a new
    // password, so there's a form to show, not a one-shot action. See
    // docs/DEV_STATUS.md's design note on why this differs from the
    // verify-email link shape. (Never had the BUG-047 #3 double-'/api'
    // problem — it never touched basePath/'/api/' to begin with.)
    $link = $appUrl . '/?reset_token=' . urlencode($rawToken);

    $subject = "Réinitialisation de votre mot de passe — $appName";
    $text = "Bonjour $toName,\n\nCliquez sur ce lien pour choisir un nouveau mot de passe :\n$link\n\n"
        . "Ce lien expire dans 1 heure et ne peut être utilisé qu'une seule fois. "
        . "Si vous n'êtes pas à l'origine de cette demande, ignorez cet e-mail — votre mot de passe actuel reste inchangé.\n\n$appName";

    $body = "<p style=\"margin:0 0 16px;color:#2F3E46;font-size:16px;\">Bonjour $toName,</p>"
        . "<p style=\"margin:0;color:#526D82;font-size:15px;line-height:1.6;\">Cliquez sur le bouton ci-dessous "
        . "pour choisir un nouveau mot de passe :</p>"
        . renderEmailButton($link, 'Choisir un nouveau mot de passe')
        . "<p style=\"margin:0;color:#888888;font-size:13px;line-height:1.6;\">Si le bouton ne fonctionne pas, "
        . "copiez ce lien dans votre navigateur :<br><a href=\"$link\" style=\"color:#5F8A8B;word-break:break-all;\">$link</a></p>"
        . "<p style=\"margin:20px 0 0;color:#888888;font-size:12px;\">Ce lien expire dans 1 heure et ne peut être "
        . "utilisé qu'une seule fois. Si vous n'êtes pas à l'origine de cette demande, ignorez cet e-mail — "
        . "votre mot de passe actuel reste inchangé.</p>";

    $html = renderBrandedEmail($appName, "Choisissez un nouveau mot de passe pour votre compte $appName.", $body);

    sendMail($config, $toEmail, $toName, $subject, $html, $text);
}
