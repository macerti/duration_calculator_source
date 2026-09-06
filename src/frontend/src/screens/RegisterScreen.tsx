import React, { useState } from "react";
import { View, Text, StyleSheet, Pressable, ActivityIndicator } from "react-native";
import { colors, spacing, radius, typography } from "../theme/tokens";
import TextField from "../components/TextField";
import { AuthResult } from "../hooks/useAuth";

interface Props {
  onRegister: (name: string, email: string, password: string) => Promise<AuthResult>;
  onNavigateLogin: () => void;
}

// Mirrors db/userRepo.php's MIN_PASSWORD_LENGTH/MAX_PASSWORD_LENGTH
// (validatePassword()) — checked client-side only to give an immediate
// inline hint; the server re-validates independently and its message
// wins if the two ever drift (never trust client input, per
// ORIENTATIONS.md's Security section).
const MIN_PASSWORD_LENGTH = 10;
const MAX_PASSWORD_LENGTH = 72;

/**
 * RegisterScreen — local account creation (docs/ROADMAP.md item 9).
 *
 * On success the backend always requires email confirmation before the
 * account can log in (POST /auth/register never auto-signs-in) — so this
 * screen shows the server's own message and a link back to login rather
 * than attempting to render an authenticated state.
 */
export default function RegisterScreen({ onRegister, onNavigateLogin }: Props) {
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [fieldErrors, setFieldErrors] = useState<{ name?: string; email?: string; password?: string; confirm?: string }>({});
  const [serverError, setServerError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  const submit = async () => {
    setServerError(null);
    const errors: typeof fieldErrors = {};
    if (name.trim() === "") errors.name = "Le nom est obligatoire.";
    if (email.trim() === "") {
      errors.email = "L'adresse e-mail est obligatoire.";
    }
    if (password.length < MIN_PASSWORD_LENGTH) {
      errors.password = `Le mot de passe doit contenir au moins ${MIN_PASSWORD_LENGTH} caractères.`;
    } else if (password.length > MAX_PASSWORD_LENGTH) {
      errors.password = `Le mot de passe ne doit pas dépasser ${MAX_PASSWORD_LENGTH} caractères.`;
    }
    if (confirmPassword !== password) errors.confirm = "Les mots de passe ne correspondent pas.";
    setFieldErrors(errors);
    if (Object.keys(errors).length > 0) return;

    setSubmitting(true);
    const result = await onRegister(name.trim(), email.trim(), password);
    setSubmitting(false);
    if (!result.ok) {
      setServerError(result.error ?? "Inscription impossible.");
      return;
    }
    setSuccessMessage(result.message ?? "Compte créé. Vérifiez votre boîte mail pour confirmer votre adresse.");
  };

  return (
    <View style={styles.root}>
      <View style={styles.card}>
        <Text style={styles.heading}>Créer un compte</Text>

        {successMessage ? (
          <>
            <View style={styles.noticeBanner}>
              <Text style={styles.noticeBannerText}>✓ {successMessage}</Text>
            </View>
            <Pressable
              style={({ pressed }) => [styles.primaryButton, pressed && styles.buttonPressed]}
              onPress={onNavigateLogin}
              accessibilityRole="button"
            >
              <Text style={styles.primaryButtonText}>Retour à la connexion</Text>
            </Pressable>
          </>
        ) : (
          <>
            {serverError ? (
              <View style={styles.errorBanner}>
                <Text style={styles.errorBannerText}>⚠ {serverError}</Text>
              </View>
            ) : null}

            <TextField
              label="Nom complet"
              value={name}
              onChangeText={setName}
              placeholder="Prénom Nom"
              autoComplete="name"
              error={fieldErrors.name}
            />
            <TextField
              label="Adresse e-mail"
              value={email}
              onChangeText={setEmail}
              placeholder="prenom.nom@macerti.com"
              keyboardType="email-address"
              autoCapitalize="none"
              autoComplete="email"
              error={fieldErrors.email}
            />
            <TextField
              label="Mot de passe"
              value={password}
              onChangeText={setPassword}
              placeholder="10 caractères minimum"
              secureTextEntry
              autoCapitalize="none"
              autoComplete="new-password"
              error={fieldErrors.password}
            />
            <TextField
              label="Confirmer le mot de passe"
              value={confirmPassword}
              onChangeText={setConfirmPassword}
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
              accessibilityLabel="Créer le compte"
            >
              {submitting ? (
                <ActivityIndicator size="small" color={colors.contentInverse} />
              ) : (
                <Text style={styles.primaryButtonText}>Créer le compte</Text>
              )}
            </Pressable>
          </>
        )}

        <Pressable onPress={onNavigateLogin} accessibilityRole="button" style={styles.linkRow}>
          <Text style={styles.linkText}>Déjà un compte ? Se connecter</Text>
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
    marginBottom: spacing.lg,
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
