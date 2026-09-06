import React, { useState } from "react";
import { View, Text, StyleSheet, Pressable, ActivityIndicator } from "react-native";
import { colors, spacing, radius, typography } from "../theme/tokens";
import TextField from "../components/TextField";
import { AuthResult } from "../hooks/useAuth";

interface Props {
  onForgotPassword: (email: string) => Promise<AuthResult>;
  onNavigateLogin: () => void;
}

/**
 * ForgotPasswordScreen — POST /auth/forgot-password always returns the
 * same generic message regardless of whether the email exists (see that
 * route's own comment in api/index.php), so this screen always shows the
 * server's message as a success state, never a targeted error — showing
 * anything else here would defeat the backend's own anti-enumeration
 * design.
 */
// BUG-047 #4: shared between onBlur and submit, same pattern as
// RegisterScreen/ResetPasswordScreen/LoginScreen.
function validateEmailRequired(v: string): string | undefined {
  return v.trim() === "" ? "Renseignez votre adresse e-mail." : undefined;
}

export default function ForgotPasswordScreen({ onForgotPassword, onNavigateLogin }: Props) {
  const [email, setEmail] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [fieldError, setFieldError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  const handleEmailBlur = () => setFieldError(validateEmailRequired(email) ?? null);

  const submit = async () => {
    const error = validateEmailRequired(email) ?? null;
    setFieldError(error);
    if (error) return;
    setSubmitting(true);
    const result = await onForgotPassword(email.trim());
    setSubmitting(false);
    // Always show a message, win or lose — mirrors the backend's own
    // deliberately generic response.
    setMessage(result.message ?? "Si un compte existe avec cette adresse, un e-mail a été envoyé.");
  };

  return (
    <View style={styles.root}>
      <View style={styles.card}>
        <Text style={styles.heading}>Mot de passe oublié</Text>
        <Text style={styles.body}>
          Indiquez votre adresse e-mail. Si un compte existe, vous recevrez un lien pour réinitialiser votre mot de
          passe.
        </Text>

        {message ? (
          <View style={styles.noticeBanner}>
            <Text style={styles.noticeBannerText}>✓ {message}</Text>
          </View>
        ) : (
          <>
            <TextField
              label="Adresse e-mail"
              value={email}
              onChangeText={setEmail}
              onBlur={handleEmailBlur}
              placeholder="prenom.nom@macerti.com"
              keyboardType="email-address"
              autoCapitalize="none"
              autoComplete="email"
              error={fieldError}
            />
            <Pressable
              style={({ pressed }) => [styles.primaryButton, pressed && styles.buttonPressed]}
              onPress={submit}
              disabled={submitting}
              accessibilityRole="button"
              accessibilityLabel="Envoyer le lien"
            >
              {submitting ? (
                <ActivityIndicator size="small" color={colors.contentInverse} />
              ) : (
                <Text style={styles.primaryButtonText}>Envoyer le lien</Text>
              )}
            </Pressable>
          </>
        )}

        <Pressable onPress={onNavigateLogin} accessibilityRole="button" style={styles.linkRow}>
          <Text style={styles.linkText}>Retour à la connexion</Text>
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: colors.surfaceSunken,
    justifyContent: "center",
    alignItems: "center",
    padding: spacing.lg,
  },
  card: {
    backgroundColor: colors.surfaceBase,
    borderRadius: radius.xxl,
    padding: spacing.xxl,
    width: "100%",
    maxWidth: 420,
    borderWidth: 1,
    borderColor: colors.borderDefault,
  },
  heading: {
    fontSize: typography.title,
    fontWeight: "700",
    color: colors.contentPrimary,
    marginBottom: spacing.sm,
  },
  body: {
    fontSize: typography.body,
    color: colors.contentSecondary,
    marginBottom: spacing.lg,
    lineHeight: 19,
  },
  noticeBanner: {
    backgroundColor: colors.successSurface,
    borderRadius: radius.md,
    padding: spacing.md,
    marginBottom: spacing.md,
    borderLeftWidth: 3,
    borderLeftColor: colors.success,
  },
  noticeBannerText: {
    color: colors.success,
    fontSize: typography.small,
    fontWeight: "600",
  },
  primaryButton: {
    backgroundColor: colors.actionPrimary,
    borderRadius: radius.lg,
    paddingVertical: 14,
    alignItems: "center",
    justifyContent: "center",
    marginTop: spacing.xs,
    marginBottom: spacing.md,
  },
  primaryButtonText: {
    color: colors.actionPrimaryText,
    fontSize: typography.bodyLarge,
    fontWeight: "700",
  },
  buttonPressed: {
    opacity: 0.85,
    transform: [{ scale: 0.985 }],
  },
  linkRow: {
    alignItems: "center",
    marginTop: spacing.sm,
  },
  linkText: {
    color: colors.link,
    fontSize: typography.small,
    fontWeight: "600",
  },
});
