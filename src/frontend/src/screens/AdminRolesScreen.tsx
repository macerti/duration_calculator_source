import React, { useCallback, useEffect, useState } from "react";
import { View, Text, StyleSheet, ActivityIndicator, ScrollView, Pressable } from "react-native";
import { NativeStackScreenProps } from "@react-navigation/native-stack";
import { CommonActions } from "@react-navigation/native";
import { RootStackParamList } from "../../App";
import { useAuthContext } from "../context/AuthContext";
import { useAdminApi, Role, Permission, AdminApiError } from "../hooks/useAdminApi";
import { useToast } from "../components/Toast";
import Breadcrumbs from "../components/Breadcrumbs";
import ResponsiveContainer from "../components/ResponsiveContainer";
import TextField from "../components/TextField";
import { colors, spacing, radius, typography } from "../theme/tokens";

type Props = NativeStackScreenProps<RootStackParamList, "AdminRoles">;

/**
 * AdminRolesScreen — role CRUD with per-role permission grants, plus
 * permission CRUD (docs/ROADMAP.md item 9: "admin-manageable roles,
 * permissions, and per-role function grants"). Same defense-in-depth
 * permission re-check as AdminUsersScreen — see that file's comment for
 * why this isn't redundant with the server-side check.
 *
 * Both /admin/roles and /admin/permissions are gated server-side behind
 * the same 'manage_roles' permission (see api/index.php) — there is no
 * separate 'manage_permissions' permission, so this screen checks
 * exactly one flag for both sections.
 */
export default function AdminRolesScreen({ navigation }: Props) {
  const { csrfToken, hasPermission } = useAuthContext();
  const api = useAdminApi(csrfToken);
  const toast = useToast();
  const allowed = hasPermission("manage_roles");

  const [roles, setRoles] = useState<Role[] | null>(null);
  const [permissions, setPermissions] = useState<Permission[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [creatingRole, setCreatingRole] = useState(false);
  const [creatingPermission, setCreatingPermission] = useState(false);

  const load = useCallback(async () => {
    try {
      const [r, p] = await Promise.all([api.listRoles(), api.listPermissions()]);
      setRoles(r);
      setPermissions(p);
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

  return (
    <ResponsiveContainer maxWidth={1100}>
      <View style={styles.container}>
        <Breadcrumbs
          items={[
            { icon: "home-outline", onPress: () => navigation.dispatch(CommonActions.reset({ index: 0, routes: [{ name: "Home" }] })) },
            { label: "Profil", onPress: () => navigation.navigate("Profile") },
            { label: "Rôles et permissions" },
          ]}
        />
        <Text style={styles.title}>Rôles et permissions</Text>

        {error && (
          <View style={styles.errorBox}>
            <Text style={styles.errorText}>{error}</Text>
          </View>
        )}

        {(roles === null || permissions === null) && !error && <ActivityIndicator style={{ marginTop: 40 }} />}

        {roles !== null && permissions !== null && (
          <ScrollView>
            <Text style={styles.sectionHeading}>Rôles</Text>
            {roles.map((r) => (
              <RoleCard
                key={r.id}
                role={r}
                allPermissions={permissions}
                onSave={async (name, description, perms) => {
                  try {
                    const updated = await api.updateRole(r.id, name, description, perms);
                    setRoles((prev) => (prev ? prev.map((x) => (x.id === r.id ? updated : x)) : prev));
                    toast.show(`Rôle "${name}" mis à jour.`, "success");
                  } catch (e: any) {
                    toast.show(e instanceof AdminApiError ? e.message : "Erreur lors de l'enregistrement.", "error");
                  }
                }}
                onDelete={async () => {
                  try {
                    await api.deleteRole(r.id);
                    setRoles((prev) => (prev ? prev.filter((x) => x.id !== r.id) : prev));
                    toast.show(`Rôle "${r.name}" supprimé.`, "success");
                  } catch (e: any) {
                    toast.show(e instanceof AdminApiError ? e.message : "Suppression impossible.", "error");
                  }
                }}
              />
            ))}

            {creatingRole ? (
              <NewRoleForm
                allPermissions={permissions}
                onCancel={() => setCreatingRole(false)}
                onCreate={async (name, description, perms) => {
                  try {
                    const created = await api.createRole(name, description, perms);
                    setRoles((prev) => (prev ? [...prev, created] : [created]));
                    setCreatingRole(false);
                    toast.show(`Rôle "${name}" créé.`, "success");
                  } catch (e: any) {
                    toast.show(e instanceof AdminApiError ? e.message : "Création impossible.", "error");
                  }
                }}
              />
            ) : (
              <Pressable style={({ pressed }) => [styles.addButton, pressed && styles.buttonPressed]} onPress={() => setCreatingRole(true)}>
                <Text style={styles.addButtonText}>+ Nouveau rôle</Text>
              </Pressable>
            )}

            <Text style={[styles.sectionHeading, { marginTop: spacing.xxl }]}>Permissions</Text>
            {permissions.map((p) => (
              <PermissionCard
                key={p.id}
                permission={p}
                onSave={async (label, description) => {
                  try {
                    await api.updatePermission(p.id, label, description);
                    setPermissions((prev) => (prev ? prev.map((x) => (x.id === p.id ? { ...x, label, description } : x)) : prev));
                    toast.show(`Permission "${p.key}" mise à jour.`, "success");
                  } catch (e: any) {
                    toast.show(e instanceof AdminApiError ? e.message : "Erreur lors de l'enregistrement.", "error");
                  }
                }}
                onDelete={async () => {
                  try {
                    await api.deletePermission(p.id);
                    setPermissions((prev) => (prev ? prev.filter((x) => x.id !== p.id) : prev));
                    toast.show(`Permission "${p.key}" supprimée.`, "success");
                  } catch (e: any) {
                    toast.show(e instanceof AdminApiError ? e.message : "Suppression impossible.", "error");
                  }
                }}
              />
            ))}

            {creatingPermission ? (
              <NewPermissionForm
                onCancel={() => setCreatingPermission(false)}
                onCreate={async (key, label, description) => {
                  try {
                    const created = await api.createPermission(key, label, description);
                    setPermissions((prev) => (prev ? [...prev, created] : [created]));
                    setCreatingPermission(false);
                    toast.show(`Permission "${key}" créée.`, "success");
                  } catch (e: any) {
                    toast.show(e instanceof AdminApiError ? e.message : "Création impossible.", "error");
                  }
                }}
              />
            ) : (
              <Pressable style={({ pressed }) => [styles.addButton, pressed && styles.buttonPressed]} onPress={() => setCreatingPermission(true)}>
                <Text style={styles.addButtonText}>+ Nouvelle permission</Text>
              </Pressable>
            )}
          </ScrollView>
        )}
      </View>
    </ResponsiveContainer>
  );
}

/** Toggleable permission chips — a plain multi-select, since
 * SegmentedPicker (used elsewhere in this app) is single-select only. */
function PermissionChips({
  allPermissions,
  selected,
  onToggle,
}: {
  allPermissions: Permission[];
  selected: Set<string>;
  onToggle: (key: string) => void;
}) {
  return (
    <View style={styles.chipsRow}>
      {allPermissions.map((p) => {
        const active = selected.has(p.key);
        return (
          <Pressable
            key={p.key}
            style={[styles.chip, active && styles.chipActive]}
            onPress={() => onToggle(p.key)}
            accessibilityRole="button"
            accessibilityLabel={p.label}
          >
            <Text style={[styles.chipText, active && styles.chipTextActive]}>{p.label}</Text>
          </Pressable>
        );
      })}
    </View>
  );
}

/** Two-tap destructive action — first tap arms it, second tap (within
 * the same render) actually fires. Avoids needing a Modal confirmation
 * dialog for what is otherwise a single Pressable. */
function DangerButton({ label, confirmLabel, onConfirm }: { label: string; confirmLabel: string; onConfirm: () => void }) {
  const [armed, setArmed] = useState(false);
  return (
    <Pressable
      style={({ pressed }) => [styles.dangerButton, armed && styles.dangerButtonArmed, pressed && styles.buttonPressed]}
      onPress={() => {
        if (armed) {
          onConfirm();
          setArmed(false);
        } else {
          setArmed(true);
        }
      }}
      accessibilityRole="button"
    >
      <Text style={[styles.dangerButtonText, armed && styles.dangerButtonTextArmed]}>{armed ? confirmLabel : label}</Text>
    </Pressable>
  );
}

function RoleCard({
  role,
  allPermissions,
  onSave,
  onDelete,
}: {
  role: Role;
  allPermissions: Permission[];
  onSave: (name: string, description: string | null, permissions: string[]) => Promise<void>;
  onDelete: () => Promise<void>;
}) {
  const [name, setName] = useState(role.name);
  const [description, setDescription] = useState(role.description ?? "");
  const [selected, setSelected] = useState<Set<string>>(new Set(role.permissions));
  const [saving, setSaving] = useState(false);

  const toggle = (key: string) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  };

  const save = async () => {
    setSaving(true);
    await onSave(name.trim(), description.trim() || null, Array.from(selected));
    setSaving(false);
  };

  return (
    <View style={styles.card}>
      <View style={styles.cardHeaderRow}>
        <Text style={styles.cardTitle}>{role.name}</Text>
        {role.isSystem && <Text style={styles.systemBadge}>rôle protégé</Text>}
        <Text style={styles.userCountText}>{role.userCount} utilisateur{role.userCount !== 1 ? "s" : ""}</Text>
      </View>

      <TextField label="Nom" value={name} onChangeText={setName} />
      <TextField label="Description" value={description} onChangeText={setDescription} />

      <Text style={styles.subLabel}>Permissions accordées</Text>
      <PermissionChips allPermissions={allPermissions} selected={selected} onToggle={toggle} />

      <View style={styles.cardActionsRow}>
        <Pressable style={({ pressed }) => [styles.primaryButton, pressed && styles.buttonPressed]} onPress={save} disabled={saving}>
          {saving ? <ActivityIndicator size="small" color={colors.contentInverse} /> : <Text style={styles.primaryButtonText}>Enregistrer</Text>}
        </Pressable>
        {!role.isSystem && (
          <DangerButton label="Supprimer" confirmLabel="Confirmer la suppression ?" onConfirm={onDelete} />
        )}
      </View>
    </View>
  );
}

function NewRoleForm({
  allPermissions,
  onCreate,
  onCancel,
}: {
  allPermissions: Permission[];
  onCreate: (name: string, description: string | null, permissions: string[]) => Promise<void>;
  onCancel: () => void;
}) {
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [saving, setSaving] = useState(false);
  const [nameError, setNameError] = useState<string | null>(null);

  const toggle = (key: string) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  };

  const create = async () => {
    if (name.trim() === "") {
      setNameError("Le nom du rôle est obligatoire.");
      return;
    }
    setNameError(null);
    setSaving(true);
    await onCreate(name.trim(), description.trim() || null, Array.from(selected));
    setSaving(false);
  };

  return (
    <View style={[styles.card, styles.newCard]}>
      <Text style={styles.cardTitle}>Nouveau rôle</Text>
      <TextField label="Nom" value={name} onChangeText={setName} error={nameError} />
      <TextField label="Description" value={description} onChangeText={setDescription} />
      <Text style={styles.subLabel}>Permissions accordées</Text>
      <PermissionChips allPermissions={allPermissions} selected={selected} onToggle={toggle} />
      <View style={styles.cardActionsRow}>
        <Pressable style={({ pressed }) => [styles.primaryButton, pressed && styles.buttonPressed]} onPress={create} disabled={saving}>
          {saving ? <ActivityIndicator size="small" color={colors.contentInverse} /> : <Text style={styles.primaryButtonText}>Créer</Text>}
        </Pressable>
        <Pressable style={({ pressed }) => [styles.cancelButton, pressed && styles.buttonPressed]} onPress={onCancel}>
          <Text style={styles.cancelButtonText}>Annuler</Text>
        </Pressable>
      </View>
    </View>
  );
}

function PermissionCard({
  permission,
  onSave,
  onDelete,
}: {
  permission: Permission;
  onSave: (label: string, description: string | null) => Promise<void>;
  onDelete: () => Promise<void>;
}) {
  const [label, setLabel] = useState(permission.label);
  const [description, setDescription] = useState(permission.description ?? "");
  const [saving, setSaving] = useState(false);

  const save = async () => {
    setSaving(true);
    await onSave(label.trim(), description.trim() || null);
    setSaving(false);
  };

  return (
    <View style={styles.card}>
      <View style={styles.cardHeaderRow}>
        <Text style={styles.cardTitle}>{permission.key}</Text>
      </View>
      <TextField label="Libellé" value={label} onChangeText={setLabel} />
      <TextField label="Description" value={description} onChangeText={setDescription} />
      <View style={styles.cardActionsRow}>
        <Pressable style={({ pressed }) => [styles.primaryButton, pressed && styles.buttonPressed]} onPress={save} disabled={saving}>
          {saving ? <ActivityIndicator size="small" color={colors.contentInverse} /> : <Text style={styles.primaryButtonText}>Enregistrer</Text>}
        </Pressable>
        <DangerButton label="Supprimer" confirmLabel="Confirmer la suppression ?" onConfirm={onDelete} />
      </View>
    </View>
  );
}

function NewPermissionForm({
  onCreate,
  onCancel,
}: {
  onCreate: (key: string, label: string, description: string | null) => Promise<void>;
  onCancel: () => void;
}) {
  const [key, setKey] = useState("");
  const [label, setLabel] = useState("");
  const [description, setDescription] = useState("");
  const [saving, setSaving] = useState(false);
  const [errors, setErrors] = useState<{ key?: string; label?: string }>({});

  const create = async () => {
    const next: typeof errors = {};
    if (!/^[a-z][a-z0-9_]{2,99}$/.test(key.trim())) {
      next.key = "Minuscules, chiffres et underscores uniquement (ex: manage_reports).";
    }
    if (label.trim() === "") next.label = "Le libellé est obligatoire.";
    setErrors(next);
    if (Object.keys(next).length > 0) return;
    setSaving(true);
    await onCreate(key.trim(), label.trim(), description.trim() || null);
    setSaving(false);
  };

  return (
    <View style={[styles.card, styles.newCard]}>
      <Text style={styles.cardTitle}>Nouvelle permission</Text>
      <TextField label="Clé technique" value={key} onChangeText={setKey} placeholder="manage_reports" autoCapitalize="none" error={errors.key} />
      <TextField label="Libellé" value={label} onChangeText={setLabel} error={errors.label} />
      <TextField label="Description" value={description} onChangeText={setDescription} />
      <View style={styles.cardActionsRow}>
        <Pressable style={({ pressed }) => [styles.primaryButton, pressed && styles.buttonPressed]} onPress={create} disabled={saving}>
          {saving ? <ActivityIndicator size="small" color={colors.contentInverse} /> : <Text style={styles.primaryButtonText}>Créer</Text>}
        </Pressable>
        <Pressable style={({ pressed }) => [styles.cancelButton, pressed && styles.buttonPressed]} onPress={onCancel}>
          <Text style={styles.cancelButtonText}>Annuler</Text>
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, padding: spacing.lg },
  title: { fontSize: typography.display, fontWeight: "700", color: colors.contentPrimary, marginTop: spacing.md, marginBottom: spacing.lg },
  deniedText: { fontSize: typography.body, color: colors.contentSecondary, marginTop: spacing.xxl, textAlign: "center" },
  errorBox: { backgroundColor: colors.errorSurface, borderRadius: radius.lg, padding: spacing.md, marginBottom: spacing.md },
  errorText: { color: colors.error, fontSize: typography.body },
  sectionHeading: { fontSize: typography.heading, fontWeight: "700", color: colors.contentPrimary, marginBottom: spacing.md },
  card: {
    backgroundColor: colors.surfaceRaised,
    borderRadius: radius.xl,
    borderWidth: 1,
    borderColor: colors.borderDefault,
    padding: spacing.lg,
    marginBottom: spacing.md,
  },
  newCard: { borderStyle: "dashed", borderColor: colors.borderStrong },
  cardHeaderRow: { flexDirection: "row", alignItems: "center", marginBottom: spacing.sm, gap: spacing.sm },
  cardTitle: { fontSize: typography.subtitle, fontWeight: "700", color: colors.contentPrimary, flex: 1 },
  systemBadge: {
    fontSize: typography.caption,
    color: colors.info,
    backgroundColor: colors.infoSurface,
    borderRadius: radius.pill,
    paddingHorizontal: spacing.sm,
    paddingVertical: 3,
  },
  userCountText: { fontSize: typography.small, color: colors.contentTertiary },
  subLabel: { fontSize: typography.body, color: colors.contentSecondary, marginBottom: spacing.sm },
  chipsRow: { flexDirection: "row", flexWrap: "wrap", gap: spacing.sm, marginBottom: spacing.md },
  chip: {
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.md,
    borderRadius: radius.pill,
    borderWidth: 1,
    borderColor: colors.borderDefault,
    backgroundColor: colors.surfaceBase,
  },
  chipActive: { backgroundColor: colors.actionPrimary, borderColor: colors.actionPrimary },
  chipText: { fontSize: typography.small, color: colors.contentSecondary },
  chipTextActive: { color: colors.contentInverse, fontWeight: "600" },
  cardActionsRow: { flexDirection: "row", gap: spacing.sm, marginTop: spacing.xs },
  primaryButton: {
    backgroundColor: colors.actionPrimary,
    borderRadius: radius.lg,
    paddingVertical: 10,
    paddingHorizontal: spacing.lg,
    alignItems: "center",
    justifyContent: "center",
  },
  primaryButtonText: { color: colors.actionPrimaryText, fontSize: typography.body, fontWeight: "700" },
  cancelButton: { paddingVertical: 10, paddingHorizontal: spacing.lg, alignItems: "center", justifyContent: "center" },
  cancelButtonText: { color: colors.contentTertiary, fontSize: typography.body, fontWeight: "600" },
  dangerButton: {
    borderRadius: radius.lg,
    paddingVertical: 10,
    paddingHorizontal: spacing.lg,
    borderWidth: 1,
    borderColor: colors.error,
    alignItems: "center",
    justifyContent: "center",
  },
  dangerButtonArmed: { backgroundColor: colors.error },
  dangerButtonText: { color: colors.error, fontSize: typography.body, fontWeight: "700" },
  dangerButtonTextArmed: { color: colors.contentInverse },
  addButton: {
    borderRadius: radius.lg,
    paddingVertical: 12,
    borderWidth: 1,
    borderColor: colors.borderDefault,
    borderStyle: "dashed",
    alignItems: "center",
    marginBottom: spacing.md,
  },
  addButtonText: { color: colors.link, fontSize: typography.bodyLarge, fontWeight: "600" },
  buttonPressed: { opacity: 0.85 },
});
