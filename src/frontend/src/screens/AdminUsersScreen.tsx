import React, { useCallback, useEffect, useState } from "react";
import { View, Text, StyleSheet, ActivityIndicator, ScrollView } from "react-native";
import { NativeStackScreenProps } from "@react-navigation/native-stack";
import { CommonActions } from "@react-navigation/native";
import { RootStackParamList } from "../../App";
import { useAuthContext } from "../context/AuthContext";
import { useAdminApi, AdminUser, Role, AdminApiError } from "../hooks/useAdminApi";
import { useToast } from "../components/Toast";
import Breadcrumbs from "../components/Breadcrumbs";
import ResponsiveContainer from "../components/ResponsiveContainer";
import SegmentedPicker from "../components/SegmentedPicker";
import { colors, spacing, radius, typography } from "../theme/tokens";

type Props = NativeStackScreenProps<RootStackParamList, "AdminUsers">;

/**
 * AdminUsersScreen — list every account, change its role or
 * active/disabled status (docs/ROADMAP.md item 9: "admin UI to
 * grant/revoke access"). Reachable only from ProfileScreen's
 * permission-gated button, but this screen re-checks
 * hasPermission('manage_users') itself (defense in depth, per
 * ORIENTATIONS.md's Security section — don't rely on a single layer,
 * even a client-side navigation gate) and shows a plain message instead
 * of rendering the list if reached without it. The server independently
 * enforces the same permission on every /admin/users call regardless.
 */
export default function AdminUsersScreen({ navigation }: Props) {
  const { csrfToken, hasPermission } = useAuthContext();
  const api = useAdminApi(csrfToken);
  const toast = useToast();
  const allowed = hasPermission("manage_users");

  const [users, setUsers] = useState<AdminUser[] | null>(null);
  const [roles, setRoles] = useState<Role[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [savingUserId, setSavingUserId] = useState<number | null>(null);

  const load = useCallback(async () => {
    try {
      const [u, r] = await Promise.all([api.listUsers(), api.listRoles()]);
      setUsers(u);
      setRoles(r);
      setError(null);
    } catch (e: any) {
      setError(e instanceof AdminApiError ? e.message : "Erreur de chargement.");
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [csrfToken]);

  useEffect(() => {
    if (allowed) load();
  }, [allowed, load]);

  if (!allowed) {
    return (
      <ResponsiveContainer maxWidth={640}>
        <View style={styles.container}>
          <Text style={styles.deniedText}>Vous n'avez pas la permission d'accéder à cette page.</Text>
        </View>
      </ResponsiveContainer>
    );
  }

  const changeRole = async (user: AdminUser, roleId: number) => {
    if (roleId === user.role.id) return;
    setSavingUserId(user.id);
    try {
      const updated = await api.updateUser(user.id, { roleId });
      setUsers((prev) => (prev ? prev.map((u) => (u.id === user.id ? updated : u)) : prev));
      toast.show(`Rôle de ${user.name} mis à jour.`, "success");
    } catch (e: any) {
      toast.show(e instanceof AdminApiError ? e.message : "Erreur lors de la mise à jour.", "error");
    } finally {
      setSavingUserId(null);
    }
  };

  const changeStatus = async (user: AdminUser, status: "active" | "disabled") => {
    if (status === user.status) return;
    setSavingUserId(user.id);
    try {
      const updated = await api.updateUser(user.id, { status });
      setUsers((prev) => (prev ? prev.map((u) => (u.id === user.id ? updated : u)) : prev));
      toast.show(`Statut de ${user.name} mis à jour.`, "success");
    } catch (e: any) {
      toast.show(e instanceof AdminApiError ? e.message : "Erreur lors de la mise à jour.", "error");
    } finally {
      setSavingUserId(null);
    }
  };

  return (
    <ResponsiveContainer maxWidth={1100}>
      <View style={styles.container}>
        <Breadcrumbs
          items={[
            { icon: "home-outline", onPress: () => navigation.dispatch(CommonActions.reset({ index: 0, routes: [{ name: "Home" }] })) },
            { label: "Profil", onPress: () => navigation.navigate("Profile") },
            { label: "Utilisateurs" },
          ]}
        />
        <Text style={styles.title}>Gestion des utilisateurs</Text>

        {error && (
          <View style={styles.errorBox}>
            <Text style={styles.errorText}>{error}</Text>
          </View>
        )}

        {users === null && !error && <ActivityIndicator style={{ marginTop: 40 }} />}

        {users !== null && roles !== null && (
          <ScrollView>
            {users.map((u) => (
              <View key={u.id} style={styles.userCard}>
                <View style={styles.userHeaderRow}>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.userName}>{u.name}</Text>
                    <Text style={styles.userEmail}>{u.email}</Text>
                  </View>
                  {!u.emailVerified && <Text style={styles.unverifiedBadge}>e-mail non confirmé</Text>}
                  {savingUserId === u.id && <ActivityIndicator size="small" color={colors.contentTertiary} />}
                </View>

                <SegmentedPicker
                  label="Rôle"
                  value={String(u.role.id)}
                  options={roles.map((r) => ({ value: String(r.id), label: r.name }))}
                  onChange={(v) => changeRole(u, Number(v))}
                />

                <SegmentedPicker
                  label="Statut"
                  value={u.status}
                  options={[
                    { value: "active", label: "Actif" },
                    { value: "disabled", label: "Désactivé" },
                  ]}
                  onChange={(v) => changeStatus(u, v as "active" | "disabled")}
                />
              </View>
            ))}
          </ScrollView>
        )}
      </View>
    </ResponsiveContainer>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, padding: spacing.lg },
  title: { fontSize: typography.display, fontWeight: "700", color: colors.contentPrimary, marginTop: spacing.md, marginBottom: spacing.lg },
  deniedText: { fontSize: typography.body, color: colors.contentSecondary, marginTop: spacing.xxl, textAlign: "center" },
  errorBox: { backgroundColor: colors.errorSurface, borderRadius: radius.lg, padding: spacing.md, marginBottom: spacing.md },
  errorText: { color: colors.error, fontSize: typography.body },
  userCard: {
    backgroundColor: colors.surfaceRaised,
    borderRadius: radius.xl,
    borderWidth: 1,
    borderColor: colors.borderDefault,
    padding: spacing.lg,
    marginBottom: spacing.md,
  },
  userHeaderRow: { flexDirection: "row", alignItems: "center", marginBottom: spacing.md },
  userName: { fontSize: typography.subtitle, fontWeight: "700", color: colors.contentPrimary },
  userEmail: { fontSize: typography.small, color: colors.contentTertiary, marginTop: 2 },
  unverifiedBadge: {
    fontSize: typography.caption,
    color: colors.warning,
    backgroundColor: colors.warningSurface,
    borderRadius: radius.pill,
    paddingHorizontal: spacing.sm,
    paddingVertical: 3,
    marginRight: spacing.sm,
  },
});
