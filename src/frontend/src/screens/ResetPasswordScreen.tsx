import React, { useState } from "react";
import { View, Text, StyleSheet, Pressable, ActivityIndicator } from "react-native";
import { colors, spacing, radius, typography } from "../theme/tokens";
import TextField from "../components/TextField";
import { AuthResult } from "../hooks/useAuth";

interface Props {
  /** From useAuth().resetToken — extracted from the email link's
   * ?reset_token=... query param. Null means this screen was somehow
   * reached without a token (e.g. direct navigation, or the token was
   * already cleared) — shown as an error state below rather than letting
   * the form submit with an empty token. */
  token: string | null;
  onResetPassword: (token: string, newPassword: string) => Promise<AuthResult>;
  onNavigateLogin: () => void;
}

// Mirrors db/userRepo.php's MIN_PASSWORD_LENGTH/MAX_PASSWORD_LENGTH — see
// RegisterScreen's identical comment for why this is a client-side hint
// only, not the source of truth.
const MIN_PASSWORD_LENGTH = 10;
const MAX_PASSWORD_LENGTH = 72;

/**
 * ResetPasswordScreen — the form the password-reset email's link lands
 * on. POST /auth/reset-password auto-signs the user in on success (see
 * that route's own comment), so on success this screen does nothing
 * further — useAuth's resetPassword() sets `user`, AuthGate's
 * isAuthenticated flips to true, and the app re-renders into the
 * authenticated stack on its own. No explicit navigation call needed.
 */
type FieldErrors = { password?: string; confirm?: string };

function validatePassword(v: string): string | undefined {
  if (v.length < MIN_PASSWORD_LENGTH) return `Le mot de passe doit contenir au moins ${MIN_PASSWORD_LENGTH} caractères.`;
  if (v.length > MAX_PASSWORD_LENGTH) return `Le mot de passe ne doit pas dépasser ${MAX_PASSWORD_LENGTH} caractères.`;
  return undefined;
}
function validateConfirm(confirm: string, password: string): string | undefined {
  return confirm !== password ? "Les mots de passe ne correspondent pas." : undefined;
}

export default function ResetPasswordScreen({ token, onResetPassword, onNavigateLogin }: Props) {
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [fieldErrors, setFieldErrors] = useState<FieldErrors>({});
  const [confirmTouched, setConfirmTouched] = useState(false);
  const [serverError, setServerError] = useState<string | null>(null);

  if (!token) {
    return (
      <View style={styles.root}>
        <View style={styles.card}>
          <Text style={styles.heading}>Lien invalide</Text>
          <Text style={styles.body}>
            Ce lien de réinitialisation est invalide ou a expiré. Demandez un nouveau lien depuis l'écran de
            connexion.
          </Text>
          <Pressable onPress={onNavigateLogin} accessibilityRole="button" style={styles.linkRow}>
            <Text style={styles.linkText}>Retour à la connexion</Text>
          </Pressable>
        </View>
      </View>
    );
  }

  const handlePasswordBlur = () =>
    setFieldErrors((prev) => ({
      ...prev,
      password: validatePassword(newPassword),
      confirm: confirmTouched ? validateConfirm(confirmPassword, newPassword) : prev.confirm,
    }));
  const handleConfirmBlur = () => {
    setConfirmTouched(true);
    setFieldErrors((prev) => ({ ...prev, confirm: validateConfirm(confirmPassword, newPassword) }));
  };

  const submit = async () => {
    setServerError(null);
    const errors: FieldErrors = {
      password: validatePassword(newPassword),
      confirm: validateConfirm(confirmPassword, newPassword),
    };
    setFieldErrors(errors);
    setConfirmTouched(true);
    if (Object.values(errors).some(Boolean)) return;

    setSubmitting(true);
    const result = await onResetPassword(token, newPassword);
    setSubmitting(false);
    if (!result.ok) {
      setServerError(result.error ?? "Réinitialisation impossible.");
    }
    // On success: nothing to do here — see the function comment above.
  };

  return (
    <View style={styles.root}>
      <View style={styles.card}>
        <Text style={styles.heading}>Nouveau mot de passe</Text>

        {serverError ? (
          <View style={styles.errorBanner}>
            <Text style={styles.errorBannerText}>⚠ {serverError}</Text>
          </View>
        ) : null}

        <TextField
          label="Nouveau mot de passe"
          value={newPassword}
          onChangeText={setNewPassword}
          onBlur={handlePasswordBlur}
          placeholder="10 caractères minimum"
          secureTextEntry
          autoCapitalize="none"
          autoComplete="new-password"
          error={fieldErrors.password}
        />
        <TextField
          label="Confirmer le nouveau mot de passe"
          value={confirmPassword}
          onChangeText={setConfirmPassword}
          onBlur={handleConfirmBlur}
          placeholder="••••••••••"
          secureTextEntry
          autoCapitalize="none"
          autoComplete="new-password"
          error={fieldErrors.confirm}
        />

        <Pressable
          style={({ pressed }) => [styles.primaryButton, pressed && styles.buttonPressed]}
          onPress={submit}
          disabled={submitting}
          accessibilityRole="button"
          accessibilityLabel="Réinitialiser le mot de passe"
        >
          {submitting ? (
            <ActivityIndicator size="small" color={colors.contentInverse} />
          ) : (
            <Text style={styles.primaryButtonText}>Réinitialiser le mot de passe</Text>
          )}
        </Pressable>

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
  errorBanner: {
    backgroundColor: colors.errorSurface,
    borderRadius: radius.md,
    padding: spacing.md,
    marginBottom: spacing.md,
    borderLeftWidth: 3,
    borderLeftColor: colors.error,
  },
  errorBannerText: {
    color: colors.error,
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
