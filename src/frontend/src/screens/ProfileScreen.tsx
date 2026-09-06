import React, { useState } from "react";
import { View, Text, StyleSheet, Pressable, ActivityIndicator } from "react-native";
import { NativeStackScreenProps } from "@react-navigation/native-stack";
import { CommonActions } from "@react-navigation/native";
import { RootStackParamList } from "../../App";
import { useAuthContext } from "../context/AuthContext";
import { useToast } from "../components/Toast";
import Breadcrumbs from "../components/Breadcrumbs";
import ResponsiveContainer from "../components/ResponsiveContainer";
import TextField from "../components/TextField";
import { colors, spacing, radius, typography } from "../theme/tokens";

type Props = NativeStackScreenProps<RootStackParamList, "Profile">;

const MIN_PASSWORD_LENGTH = 10;
const MAX_PASSWORD_LENGTH = 72;

/**
 * ProfileScreen — own account details + password change + entry points
 * into the admin screens, gated by permission (docs/ROADMAP.md item 9:
 * "profile screen showing the user's own role" + "admin UI to
 * grant/revoke access"). Reachable from Home's header button (see
 * App.tsx) — the only navigation entry point into this screen, by
 * design: it's an account-management destination, not part of the
 * client/calculation workflow.
 */
export default function ProfileScreen({ navigation }: Props) {
  const { user, logout, updateProfile, changePassword, hasPermission } = useAuthContext();
  const toast = useToast();

  const [name, setName] = useState(user?.name ?? "");
  const [email, setEmail] = useState(user?.email ?? "");
  const [savingProfile, setSavingProfile] = useState(false);

  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [passwordErrors, setPasswordErrors] = useState<{ current?: string; next?: string; confirm?: string }>({});
  const [changingPassword, setChangingPassword] = useState(false);

  if (!user) {
    // Defensive only — ProfileScreen only renders inside AuthGate's
    // authenticated branch, so `user` is always non-null in practice.
    return null;
  }

  const saveProfile = async () => {
    setSavingProfile(true);
    const result = await updateProfile({
      name: name.trim() !== user.name ? name.trim() : undefined,
      email: email.trim() !== user.email ? email.trim().toLowerCase() : undefined,
    });
    setSavingProfile(false);
    if (result.ok) {
      toast.show("Profil mis à jour.", "success");
    } else {
      toast.show(result.error ?? "Mise à jour impossible.", "error");
    }
  };

  const submitPasswordChange = async () => {
    const errors: typeof passwordErrors = {};
    if (currentPassword === "") errors.current = "Renseignez votre mot de passe actuel.";
    if (newPassword.length < MIN_PASSWORD_LENGTH) {
      errors.next = `Le mot de passe doit contenir au moins ${MIN_PASSWORD_LENGTH} caractères.`;
    } else if (newPassword.length > MAX_PASSWORD_LENGTH) {
      errors.next = `Le mot de passe ne doit pas dépasser ${MAX_PASSWORD_LENGTH} caractères.`;
    }
    if (confirmPassword !== newPassword) errors.confirm = "Les mots de passe ne correspondent pas.";
    setPasswordErrors(errors);
    if (Object.keys(errors).length > 0) return;

    setChangingPassword(true);
    const result = await changePassword(currentPassword, newPassword);
    setChangingPassword(false);
    if (result.ok) {
      toast.show("Mot de passe modifié.", "success");
      setCurrentPassword("");
      setNewPassword("");
      setConfirmPassword("");
    } else {
      toast.show(result.error ?? "Changement de mot de passe impossible.", "error");
    }
  };

  const doLogout = async () => {
    await logout();
    // No explicit navigation needed: AuthGate re-renders to LoginScreen
    // as soon as useAuth's `user` state clears, the same way sign-in
    // transitions the other direction.
  };

  return (
    <ResponsiveContainer maxWidth={640}>
      <View style={styles.container}>
        <Breadcrumbs
          items={[
            { icon: "home-outline", onPress: () => navigation.dispatch(CommonActions.reset({ index: 0, routes: [{ name: "Home" }] })) },
            { label: "Profil" },
          ]}
        />

        <Text style={styles.title}>Mon profil</Text>

        {/* Account summary */}
        <View style={styles.card}>
          <View style={styles.metaRow}>
            <Text style={styles.metaLabel}>Rôle</Text>
            <Text style={styles.metaValue}>{user.role.name}</Text>
          </View>
          <View style={styles.metaRow}>
            <Text style={styles.metaLabel}>Connexions liées</Text>
            <Text style={styles.metaValue}>
              {[user.hasPassword ? "mot de passe" : null, ...user.linkedProviders].filter(Boolean).join(", ") || "aucune"}
            </Text>
          </View>
          {user.lastLoginAt ? (
            <View style={styles.metaRow}>
              <Text style={styles.metaLabel}>Dernière connexion</Text>
              <Text style={styles.metaValue}>{user.lastLoginAt}</Text>
            </View>
          ) : null}
        </View>

        {/* Editable profile */}
        <View style={styles.card}>
          <Text style={styles.cardHeading}>Informations</Text>
          <TextField label="Nom complet" value={name} onChangeText={setName} autoComplete="name" />
          <TextField
            label="Adresse e-mail"
            value={email}
            onChangeText={setEmail}
            keyboardType="email-address"
            autoCapitalize="none"
            autoComplete="email"
          />
          {user.pendingEmail ? (
            <Text style={styles.hintText}>
              Adresse en attente de confirmation : {user.pendingEmail}. Vérifiez votre boîte mail.
            </Text>
          ) : null}
          <Pressable
            style={({ pressed }) => [styles.primaryButton, pressed && styles.buttonPressed]}
            onPress={saveProfile}
            disabled={savingProfile}
            accessibilityRole="button"
          >
            {savingProfile ? (
              <ActivityIndicator size="small" color={colors.contentInverse} />
            ) : (
              <Text style={styles.primaryButtonText}>Enregistrer</Text>
            )}
          </Pressable>
        </View>

        {/* Password change */}
        <View style={styles.card}>
          <Text style={styles.cardHeading}>Changer le mot de passe</Text>
          <TextField
            label="Mot de passe actuel"
            value={currentPassword}
            onChangeText={setCurrentPassword}
            secureTextEntry
            autoCapitalize="none"
            autoComplete="current-password"
            error={passwordErrors.current}
          />
          <TextField
            label="Nouveau mot de passe"
            value={newPassword}
            onChangeText={setNewPassword}
            secureTextEntry
            autoCapitalize="none"
            autoComplete="new-password"
            error={passwordErrors.next}
          />
          <TextField
            label="Confirmer le nouveau mot de passe"
            value={confirmPassword}
            onChangeText={setConfirmPassword}
            secureTextEntry
            autoCapitalize="none"
            autoComplete="new-password"
            error={passwordErrors.confirm}
          />
          <Pressable
            style={({ pressed }) => [styles.primaryButton, pressed && styles.buttonPressed]}
            onPress={submitPasswordChange}
            disabled={changingPassword}
            accessibilityRole="button"
          >
            {changingPassword ? (
              <ActivityIndicator size="small" color={colors.contentInverse} />
            ) : (
              <Text style={styles.primaryButtonText}>Changer le mot de passe</Text>
            )}
          </Pressable>
        </View>

        {/* Admin entry points */}
        {(hasPermission("manage_users") || hasPermission("manage_roles")) && (
          <View style={styles.card}>
            <Text style={styles.cardHeading}>Administration</Text>
            {hasPermission("manage_users") && (
              <Pressable
                style={({ pressed }) => [styles.secondaryButton, pressed && styles.buttonPressed]}
                onPress={() => navigation.navigate("AdminUsers")}
                accessibilityRole="button"
              >
                <Text style={styles.secondaryButtonText}>Gérer les utilisateurs</Text>
              </Pressable>
            )}
            {hasPermission("manage_roles") && (
              <Pressable
                style={({ pressed }) => [styles.secondaryButton, pressed && styles.buttonPressed]}
                onPress={() => navigation.navigate("AdminRoles")}
                accessibilityRole="button"
              >
                <Text style={styles.secondaryButtonText}>Gérer les rôles et permissions</Text>
              </Pressable>
            )}
          </View>
        )}

        <Pressable
          style={({ pressed }) => [styles.logoutButton, pressed && styles.buttonPressed]}
          onPress={doLogout}
          accessibilityRole="button"
        >
          <Text style={styles.logoutButtonText}>Se déconnecter</Text>
        </Pressable>
      </View>
    </ResponsiveContainer>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, padding: spacing.lg, paddingBottom: spacing.xxl * 2 },
  title: { fontSize: typography.display, fontWeight: "700", color: colors.contentPrimary, marginTop: spacing.md, marginBottom: spacing.lg },
  card: {
    backgroundColor: colors.surfaceRaised,
    borderRadius: radius.xl,
    borderWidth: 1,
    borderColor: colors.borderDefault,
    padding: spacing.lg,
    marginBottom: spacing.lg,
  },
  cardHeading: { fontSize: typography.subtitle, fontWeight: "700", color: colors.contentPrimary, marginBottom: spacing.md },
  metaRow: { flexDirection: "row", justifyContent: "space-between", paddingVertical: spacing.xs },
  metaLabel: { fontSize: typography.body, color: colors.contentTertiary },
  metaValue: { fontSize: typography.body, color: colors.contentPrimary, fontWeight: "600" },
  hintText: { fontSize: typography.small, color: colors.contentTertiary, marginBottom: spacing.md, lineHeight: 17 },
  primaryButton: {
    backgroundColor: colors.actionPrimary,
    borderRadius: radius.lg,
    paddingVertical: 12,
    alignItems: "center",
    justifyContent: "center",
    marginTop: spacing.xs,
  },
  primaryButtonText: { color: colors.actionPrimaryText, fontSize: typography.bodyLarge, fontWeight: "700" },
  secondaryButton: {
    backgroundColor: colors.actionSecondary,
    borderRadius: radius.lg,
    paddingVertical: 12,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: spacing.sm,
  },
  secondaryButtonText: { color: colors.actionSecondaryText, fontSize: typography.bodyLarge, fontWeight: "600" },
  buttonPressed: { opacity: 0.85, transform: [{ scale: 0.985 }] },
  logoutButton: {
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 12,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.error,
  },
  logoutButtonText: { color: colors.error, fontSize: typography.bodyLarge, fontWeight: "700" },
});
