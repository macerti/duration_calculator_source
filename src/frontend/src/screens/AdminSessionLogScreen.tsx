import React, { useCallback, useEffect, useState } from "react";
import { View, Text, StyleSheet, ActivityIndicator, ScrollView, Pressable, TextInput } from "react-native";
import { NativeStackScreenProps } from "@react-navigation/native-stack";
import { CommonActions } from "@react-navigation/native";
import { RootStackParamList } from "../../App";
import { useAuthContext } from "../context/AuthContext";
import { useAdminApi, SessionLogEntry, AdminApiError } from "../hooks/useAdminApi";
import { useToast } from "../components/Toast";
import Breadcrumbs from "../components/Breadcrumbs";
import ResponsiveContainer from "../components/ResponsiveContainer";
import CollapsibleSection from "../components/CollapsibleSection";
import { colors, spacing, radius, typography } from "../theme/tokens";

type Props = NativeStackScreenProps<RootStackParamList, "AdminSessionLog">;

const LIST_LIMIT = 100;

/**
 * AdminSessionLogScreen — UI for the `session_log` table (migration 007,
 * forty-eighth session). The backend (`sessionLogRepo.php`, GET/POST
 * `/admin/session-log`, 8 HTTP tests) has existed with no frontend caller
 * since it was built — flagged as the smallest independently-doable
 * remaining item in every hand-off since, never picked up. This screen
 * closes that gap.
 *
 * Deliberately read + append only, no edit/delete — mirrors the backend's
 * own GET/POST-only routes (see migration 007's comment, point 5, on why
 * this table is append-only by design). List/card visual pattern mirrors
 * AdminTrackerScreen.tsx; the "new entry" form mirrors that screen's own
 * inline creation card. Reachable only via ProfileScreen's
 * `manage_tracker`-gated button (same permission `session_log`'s own
 * routes are gated by — see migration 007's rationale for not adding a
 * new permission just for this); re-checks the permission itself, same
 * defense-in-depth as every other admin screen, since the server enforces
 * it independently regardless.
 *
 * Uses maxWidth 1100 (ResponsiveContainer), matching AdminTrackerScreen —
 * not AdminAnnotationsScreen's narrower 800 — per DEBT-002's own finding.
 */
export default function AdminSessionLogScreen({ navigation }: Props) {
  const { csrfToken, hasPermission } = useAuthContext();
  const api = useAdminApi(csrfToken);
  const toast = useToast();
  const allowed = hasPermission("manage_tracker");

  const [entries, setEntries] = useState<SessionLogEntry[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);

  const load = useCallback(async () => {
    try {
      const rows = await api.listSessionLog(LIST_LIMIT);
      setEntries(rows);
      setError(null);
    } catch (e: any) {
      setError(e instanceof AdminApiError ? e.message : "Erreur de chargement.");
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [csrfToken]);

  useEffect(() => {
    if (allowed) load();
  }, [allowed, load]);

  const handleCreated = (entry: SessionLogEntry) => {
    setEntries((prev) => (prev ? [entry, ...prev] : [entry]));
    setCreating(false);
    toast.show("Entrée enregistrée.", "success");
  };

  const crumbs = [
    { icon: "home-outline" as const, onPress: () => navigation.dispatch(CommonActions.reset({ index: 0, routes: [{ name: "Home" as const }] })) },
    { label: "Profil", onPress: () => navigation.navigate("Profile") },
    { label: "Journal des sessions" },
  ];

  if (!allowed) {
    return (
      <ResponsiveContainer maxWidth={1100}>
        <Breadcrumbs items={crumbs} />
        <Text style={styles.deniedText}>Vous n'avez pas la permission d'accéder à cette page.</Text>
      </ResponsiveContainer>
    );
  }

  return (
    <ResponsiveContainer maxWidth={1100}>
      <ScrollView style={styles.container} contentContainerStyle={{ paddingBottom: spacing.xxl }}>
        <Breadcrumbs items={crumbs} />
        <Text style={styles.title}>Journal des sessions</Text>
        <Text style={styles.subtitle}>
          Historique append-only des sessions de développement (déclencheur, fait, non-fait, passation) — table `session_log`.
        </Text>

        {error && (
          <View style={styles.errorBox}>
            <Text style={styles.errorText}>{error}</Text>
          </View>
        )}

        {!creating ? (
          <Pressable
            style={({ pressed }) => [styles.primaryButton, pressed && styles.buttonPressed, { alignSelf: "flex-start", marginBottom: spacing.lg }]}
            onPress={() => setCreating(true)}
            accessibilityRole="button"
            testID="session-log-new-entry-button"
          >
            <Text style={styles.primaryButtonText}>+ Nouvelle entrée</Text>
          </Pressable>
        ) : (
          <NewEntryForm api={api} onCreated={handleCreated} onCancel={() => setCreating(false)} toast={toast} />
        )}

        {entries === null && !error ? (
          <ActivityIndicator style={{ marginTop: spacing.xl }} />
        ) : entries !== null && entries.length === 0 ? (
          <Text style={styles.emptyText}>Aucune entrée pour l'instant.</Text>
        ) : (
          entries?.map((entry) => <EntryCard key={entry.id} entry={entry} />)
        )}
      </ScrollView>
    </ResponsiveContainer>
  );
}

function EntryCard({ entry }: { entry: SessionLogEntry }) {
  const fields: Array<[string, string | null]> = [
    ["Déclencheur", entry.trigger],
    ["Fait", entry.done],
    ["Non-fait", entry.notDone],
    ["Passation", entry.handoff],
  ];
  const hasDetail = fields.some(([, v]) => v !== null);
  return (
    <View style={styles.card}>
      <View style={styles.cardHeaderRow}>
        <Text style={styles.cardLabel}>{entry.sessionLabel}</Text>
        <Text style={styles.cardDate}>{new Date(entry.createdAt).toLocaleString("fr-FR")}</Text>
      </View>
      <Text style={styles.cardSummary}>{entry.summary}</Text>
      {(entry.commitHash || entry.ciStatus) && (
        <View style={styles.pillsRow}>
          {entry.commitHash && (
            <View style={styles.pill}>
              <Text style={styles.pillText}>commit {entry.commitHash.slice(0, 10)}</Text>
            </View>
          )}
          {entry.ciStatus && (
            <View style={styles.pill}>
              <Text style={styles.pillText}>CI: {entry.ciStatus}</Text>
            </View>
          )}
        </View>
      )}
      {hasDetail && (
        <CollapsibleSection title="Détails" summary="" defaultExpanded={false}>
          {fields
            .filter(([, v]) => v !== null)
            .map(([label, value]) => (
              <View key={label} style={styles.field}>
                <Text style={styles.fieldLabel}>{label}</Text>
                <Text style={styles.fieldValue}>{value}</Text>
              </View>
            ))}
        </CollapsibleSection>
      )}
    </View>
  );
}

function NewEntryForm({
  api,
  onCreated,
  onCancel,
  toast,
}: {
  api: ReturnType<typeof useAdminApi>;
  onCreated: (entry: SessionLogEntry) => void;
  onCancel: () => void;
  toast: ReturnType<typeof useToast>;
}) {
  const [sessionLabel, setSessionLabel] = useState("");
  const [summary, setSummary] = useState("");
  const [trigger, setTrigger] = useState("");
  const [done, setDone] = useState("");
  const [notDone, setNotDone] = useState("");
  const [handoff, setHandoff] = useState("");
  const [commitHash, setCommitHash] = useState("");
  const [ciStatus, setCiStatus] = useState("");
  const [saving, setSaving] = useState(false);

  const canSave = sessionLabel.trim() !== "" && summary.trim() !== "" && !saving;

  const submit = async () => {
    setSaving(true);
    try {
      const entry = await api.createSessionLogEntry({
        sessionLabel: sessionLabel.trim(),
        summary: summary.trim(),
        trigger: trigger.trim() || null,
        done: done.trim() || null,
        notDone: notDone.trim() || null,
        handoff: handoff.trim() || null,
        commitHash: commitHash.trim() || null,
        ciStatus: ciStatus.trim() || null,
      });
      onCreated(entry);
    } catch (e: any) {
      toast.show(e instanceof AdminApiError ? e.message : "Erreur d'enregistrement.", "error");
    } finally {
      setSaving(false);
    }
  };

  return (
    <View style={styles.formCard}>
      <Text style={styles.cardHeading}>Nouvelle entrée</Text>
      <TextInput
        style={styles.textInput}
        value={sessionLabel}
        onChangeText={setSessionLabel}
        placeholder="Libellé de session (ex. cinquante-quatrième session)"
        placeholderTextColor={colors.contentTertiary}
        testID="session-log-label-input"
      />
      <TextInput
        style={styles.textArea}
        value={summary}
        onChangeText={setSummary}
        placeholder="Résumé (obligatoire)"
        placeholderTextColor={colors.contentTertiary}
        multiline
        testID="session-log-summary-input"
      />
      <TextInput style={styles.textArea} value={trigger} onChangeText={setTrigger} placeholder="Déclencheur (optionnel)" placeholderTextColor={colors.contentTertiary} multiline />
      <TextInput style={styles.textArea} value={done} onChangeText={setDone} placeholder="Fait (optionnel)" placeholderTextColor={colors.contentTertiary} multiline />
      <TextInput style={styles.textArea} value={notDone} onChangeText={setNotDone} placeholder="Non-fait (optionnel)" placeholderTextColor={colors.contentTertiary} multiline />
      <TextInput style={styles.textArea} value={handoff} onChangeText={setHandoff} placeholder="Passation (optionnel)" placeholderTextColor={colors.contentTertiary} multiline />
      <View style={styles.codeRow}>
        <TextInput
          style={[styles.textInput, { flex: 1 }]}
          value={commitHash}
          onChangeText={setCommitHash}
          placeholder="Hash de commit (optionnel)"
          placeholderTextColor={colors.contentTertiary}
          autoCapitalize="none"
        />
        <TextInput
          style={[styles.textInput, { flex: 1 }]}
          value={ciStatus}
          onChangeText={setCiStatus}
          placeholder="Statut CI (optionnel)"
          placeholderTextColor={colors.contentTertiary}
        />
      </View>
      <View style={styles.cardActionsRow}>
        <Pressable
          style={({ pressed }) => [styles.primaryButton, pressed && styles.buttonPressed, !canSave && styles.buttonDisabled]}
          disabled={!canSave}
          onPress={submit}
          accessibilityRole="button"
          testID="session-log-save-button"
        >
          {saving ? <ActivityIndicator size="small" color={colors.actionPrimaryText} /> : <Text style={styles.primaryButtonText}>Enregistrer</Text>}
        </Pressable>
        <Pressable style={({ pressed }) => [styles.secondaryButton, pressed && styles.buttonPressed]} onPress={onCancel} accessibilityRole="button">
          <Text style={styles.secondaryButtonText}>Annuler</Text>
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, padding: spacing.lg },
  title: { fontSize: typography.display, fontWeight: "700", color: colors.contentPrimary, marginTop: spacing.md, marginBottom: spacing.xs },
  subtitle: { fontSize: typography.small, color: colors.contentTertiary, marginBottom: spacing.lg },
  deniedText: { fontSize: typography.body, color: colors.contentSecondary, marginTop: spacing.xxl, textAlign: "center" },
  errorBox: { backgroundColor: colors.errorSurface, borderRadius: radius.lg, padding: spacing.md, marginBottom: spacing.md },
  errorText: { color: colors.error, fontSize: typography.body },
  emptyText: { fontSize: typography.body, color: colors.contentTertiary, textAlign: "center", marginTop: spacing.xl },
  card: {
    backgroundColor: colors.surfaceRaised,
    borderRadius: radius.xl,
    borderWidth: 1,
    borderColor: colors.borderDefault,
    padding: spacing.md,
    marginBottom: spacing.sm,
  },
  cardHeaderRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: spacing.xs },
  cardLabel: { fontSize: typography.bodyLarge, fontWeight: "700", color: colors.contentPrimary },
  cardDate: { fontSize: typography.caption, color: colors.contentQuaternary },
  cardSummary: { fontSize: typography.body, color: colors.contentSecondary, marginBottom: spacing.xs },
  pillsRow: { flexDirection: "row", gap: spacing.xs, flexWrap: "wrap", marginBottom: spacing.xs },
  pill: { borderRadius: radius.pill, paddingVertical: 2, paddingHorizontal: spacing.sm, backgroundColor: colors.surfaceSunken },
  pillText: { fontSize: typography.caption, fontWeight: "700", color: colors.contentTertiary },
  field: { marginBottom: spacing.sm },
  fieldLabel: { fontSize: typography.small, color: colors.contentTertiary, marginBottom: 2, fontWeight: "600" },
  fieldValue: { fontSize: typography.body, color: colors.contentSecondary },
  formCard: { backgroundColor: colors.surfaceSunken, borderRadius: radius.lg, padding: spacing.md, marginBottom: spacing.lg },
  cardHeading: { fontSize: typography.subtitle, fontWeight: "700", color: colors.contentPrimary, marginBottom: spacing.sm },
  textArea: {
    borderWidth: 1, borderColor: colors.borderDefault, borderRadius: radius.md, padding: spacing.sm,
    fontSize: typography.body, color: colors.contentPrimary, backgroundColor: colors.surfaceBase, marginBottom: spacing.sm, minHeight: 44,
  },
  textInput: {
    borderWidth: 1, borderColor: colors.borderDefault, borderRadius: radius.md, padding: spacing.sm,
    fontSize: typography.body, color: colors.contentPrimary, backgroundColor: colors.surfaceBase, marginBottom: spacing.sm,
  },
  codeRow: { flexDirection: "row", gap: spacing.sm },
  cardActionsRow: { flexDirection: "row", gap: spacing.sm, marginTop: spacing.xs },
  primaryButton: {
    backgroundColor: colors.actionPrimary, borderRadius: radius.lg, paddingVertical: 10, paddingHorizontal: spacing.lg,
    alignItems: "center", justifyContent: "center",
  },
  primaryButtonText: { color: colors.actionPrimaryText, fontSize: typography.body, fontWeight: "700" },
  buttonPressed: { opacity: 0.85 },
  buttonDisabled: { opacity: 0.5 },
  secondaryButton: {
    borderRadius: radius.lg, paddingVertical: 10, paddingHorizontal: spacing.lg, borderWidth: 1,
    borderColor: colors.actionPrimary, alignItems: "center", justifyContent: "center",
  },
  secondaryButtonText: { color: colors.actionPrimary, fontSize: typography.body, fontWeight: "700" },
});
