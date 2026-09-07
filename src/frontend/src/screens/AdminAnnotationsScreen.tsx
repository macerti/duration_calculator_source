import React, { useCallback, useEffect, useState } from "react";
import { View, Text, StyleSheet, ActivityIndicator, ScrollView, Pressable, Platform, Share } from "react-native";
import * as Clipboard from "expo-clipboard";
import { NativeStackScreenProps } from "@react-navigation/native-stack";
import { CommonActions } from "@react-navigation/native";
import { RootStackParamList } from "../../App";
import { useAuthContext } from "../context/AuthContext";
import { useAdminApi, Annotation, AdminApiError } from "../hooks/useAdminApi";
import { useToast } from "../components/Toast";
import Breadcrumbs from "../components/Breadcrumbs";
import ResponsiveContainer from "../components/ResponsiveContainer";
import SegmentedPicker from "../components/SegmentedPicker";
import { colors, spacing, radius, typography } from "../theme/tokens";

type Props = NativeStackScreenProps<RootStackParamList, "AdminAnnotations">;
type StatusFilter = "all" | "open" | "actioned" | "dismissed";

/**
 * AdminAnnotationsScreen — FEAT-006 (docs/ROADMAP.md item 10). Lists every
 * pinned comment, lets an admin mark one actioned/dismissed or delete it,
 * and exports the full set as Markdown (or JSON) — meant to be pasted
 * directly into a developer/Claude conversation with no reformatting, per
 * the spec's own "Export" requirement. Reachable only via ProfileScreen's
 * `manage_annotations`-gated button; re-checks the permission itself
 * (same defense-in-depth as AdminUsersScreen/AdminRolesScreen) since the
 * server enforces it independently regardless.
 */
export default function AdminAnnotationsScreen({ navigation }: Props) {
  const { csrfToken, hasPermission } = useAuthContext();
  const api = useAdminApi(csrfToken);
  const toast = useToast();
  const allowed = hasPermission("manage_annotations");

  const [annotations, setAnnotations] = useState<Annotation[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [filter, setFilter] = useState<StatusFilter>("open");
  const [savingId, setSavingId] = useState<number | null>(null);
  const [exportText, setExportText] = useState<string | null>(null);
  const [exportFormat, setExportFormat] = useState<"markdown" | "json">("markdown");
  const [exporting, setExporting] = useState(false);

  const load = useCallback(async () => {
    try {
      const rows = await api.listAnnotations(filter === "all" ? undefined : filter);
      setAnnotations(rows);
      setError(null);
    } catch (e: any) {
      setError(e instanceof AdminApiError ? e.message : "Erreur de chargement.");
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [csrfToken, filter]);

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

  const changeStatus = async (a: Annotation, status: Annotation["status"]) => {
    if (status === a.status) return;
    setSavingId(a.id);
    try {
      const updated = await api.updateAnnotationStatus(a.id, status);
      setAnnotations((prev) => {
        if (!prev) return prev;
        // If the current filter excludes the new status, drop the row from
        // this list instead of showing a status that no longer matches
        // what's on screen (e.g. marking "open" as "dismissed" while
        // filtered to "open").
        if (filter !== "all" && updated.status !== filter) return prev.filter((x) => x.id !== a.id);
        return prev.map((x) => (x.id === a.id ? updated : x));
      });
      toast.show(`Statut mis à jour.`, "success");
    } catch (e: any) {
      toast.show(e instanceof AdminApiError ? e.message : "Erreur lors de la mise à jour.", "error");
    } finally {
      setSavingId(null);
    }
  };

  const remove = async (a: Annotation) => {
    try {
      await api.deleteAnnotation(a.id);
      setAnnotations((prev) => (prev ? prev.filter((x) => x.id !== a.id) : prev));
      toast.show("Commentaire supprimé.", "success");
    } catch (e: any) {
      toast.show(e instanceof AdminApiError ? e.message : "Suppression impossible.", "error");
    }
  };

  const runExport = async () => {
    setExporting(true);
    try {
      const text = await api.exportAnnotations(exportFormat, filter === "all" ? undefined : filter);
      setExportText(text);
    } catch (e: any) {
      toast.show(e instanceof AdminApiError ? e.message : "Export impossible.", "error");
    } finally {
      setExporting(false);
    }
  };

  // Real export actions. The previous version of this screen only rendered
  // `exportText` as selectable `<Text>` inside a nested `<ScrollView>` and
  // asked the admin to select-and-copy it manually — on mobile (especially
  // Android) text selection inside a nested scroll container is unreliable
  // or entirely non-functional, which is exactly what Mahdi reported after
  // testing on mobile ("app showed toasts but no way to export them"). These
  // three actions give an actual, OS-level export path on every platform
  // instead of relying on manual text selection.
  const exportFilename = () => `annotations-${filter}.${exportFormat === "markdown" ? "md" : "json"}`;

  const shareExport = async () => {
    if (!exportText) return;
    try {
      await Share.share(
        Platform.OS === "web"
          ? { message: exportText }
          : { message: exportText, title: exportFilename() }
      );
    } catch (e: any) {
      // A dismissed share sheet also rejects on some platforms — that's not
      // a real failure, so only surface it if it looks like an actual error.
      if (e?.message && !/dismiss/i.test(e.message)) {
        toast.show("Partage impossible sur cet appareil.", "error");
      }
    }
  };

  const copyExport = async () => {
    if (!exportText) return;
    try {
      await Clipboard.setStringAsync(exportText);
      toast.show("Export copié dans le presse-papiers.", "success");
    } catch (e: any) {
      toast.show("Copie impossible sur cet appareil.", "error");
    }
  };

  const downloadExport = () => {
    if (!exportText || Platform.OS !== "web" || typeof document === "undefined") return;
    try {
      const blob = new Blob([exportText], { type: exportFormat === "markdown" ? "text/markdown" : "application/json" });
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = exportFilename();
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);
    } catch (e: any) {
      toast.show("Téléchargement impossible.", "error");
    }
  };

  return (
    <ResponsiveContainer maxWidth={800}>
      <View style={styles.container}>
        <Breadcrumbs
          items={[
            { icon: "home-outline", onPress: () => navigation.dispatch(CommonActions.reset({ index: 0, routes: [{ name: "Home" }] })) },
            { label: "Profil", onPress: () => navigation.navigate("Profile") },
            { label: "Annotations" },
          ]}
        />
        <Text style={styles.title}>Annotations</Text>
        <Text style={styles.subtitle}>
          Commentaires pinnés depuis le menu contextuel (clic droit sur ordinateur, appui long sur mobile).
        </Text>

        {error && (
          <View style={styles.errorBox}>
            <Text style={styles.errorText}>{error}</Text>
          </View>
        )}

        <SegmentedPicker
          label="Filtrer par statut"
          value={filter}
          options={[
            { value: "all", label: "Tous" },
            { value: "open", label: "Ouverts" },
            { value: "actioned", label: "Traités" },
            { value: "dismissed", label: "Ignorés" },
          ]}
          onChange={(v) => setFilter(v as StatusFilter)}
        />

        {annotations === null && !error && <ActivityIndicator style={{ marginTop: 40 }} />}

        {annotations !== null && (
          <ScrollView>
            {annotations.length === 0 && <Text style={styles.emptyText}>Aucune annotation pour ce filtre.</Text>}

            {annotations.map((a) => (
              <View key={a.id} style={styles.card}>
                <View style={styles.cardHeaderRow}>
                  <Text style={styles.cardTitle}>
                    #{a.id} — {a.screen}
                    {a.elementRef ? ` (${a.elementRef})` : ""}
                  </Text>
                  {savingId === a.id && <ActivityIndicator size="small" color={colors.contentTertiary} />}
                </View>
                <Text style={styles.metaText}>
                  x={Math.round(a.x)}, y={Math.round(a.y)} · v{a.appVersion} · {a.createdByName} · {a.createdAt}
                </Text>
                <Text style={styles.commentText}>{a.comment}</Text>

                <SegmentedPicker
                  label="Statut"
                  value={a.status}
                  options={[
                    { value: "open", label: "Ouvert" },
                    { value: "actioned", label: "Traité" },
                    { value: "dismissed", label: "Ignoré" },
                  ]}
                  onChange={(v) => changeStatus(a, v as Annotation["status"])}
                />

                <View style={styles.cardActionsRow}>
                  <DangerButton label="Supprimer" confirmLabel="Confirmer la suppression ?" onConfirm={() => remove(a)} />
                </View>
              </View>
            ))}
          </ScrollView>
        )}

        <View style={[styles.card, styles.exportCard]}>
          <Text style={styles.cardTitle}>Exporter</Text>
          <SegmentedPicker
            label="Format"
            value={exportFormat}
            options={[
              { value: "markdown", label: "Markdown" },
              { value: "json", label: "JSON" },
            ]}
            onChange={(v) => setExportFormat(v as "markdown" | "json")}
          />
          <Pressable style={({ pressed }) => [styles.primaryButton, pressed && styles.buttonPressed]} onPress={runExport} disabled={exporting}>
            {exporting ? <ActivityIndicator size="small" color={colors.contentInverse} /> : <Text style={styles.primaryButtonText}>Générer l'export ({filter === "all" ? "tous" : filter})</Text>}
          </Pressable>
          {exportText !== null && (
            <View style={styles.exportOutputWrap}>
              <View style={styles.exportActionsRow}>
                <Pressable style={({ pressed }) => [styles.secondaryButton, pressed && styles.buttonPressed]} onPress={copyExport} accessibilityRole="button">
                  <Text style={styles.secondaryButtonText}>Copier</Text>
                </Pressable>
                <Pressable style={({ pressed }) => [styles.secondaryButton, pressed && styles.buttonPressed]} onPress={shareExport} accessibilityRole="button">
                  <Text style={styles.secondaryButtonText}>Partager</Text>
                </Pressable>
                {Platform.OS === "web" && (
                  <Pressable style={({ pressed }) => [styles.secondaryButton, pressed && styles.buttonPressed]} onPress={downloadExport} accessibilityRole="button">
                    <Text style={styles.secondaryButtonText}>Télécharger</Text>
                  </Pressable>
                )}
              </View>
              <Text style={styles.exportHint}>Aperçu (le texte reste aussi sélectionnable ci-dessous) :</Text>
              <ScrollView style={styles.exportScroll} nestedScrollEnabled>
                <Text selectable style={styles.exportOutput}>
                  {exportText}
                </Text>
              </ScrollView>
            </View>
          )}
        </View>
      </View>
    </ResponsiveContainer>
  );
}

/** Two-tap destructive action — first tap arms it, second tap actually
 * fires. Same pattern as AdminRolesScreen's own DangerButton; duplicated
 * rather than shared since neither screen has a common components import
 * for it yet (see docs/ROADMAP.md item 7 — a future extraction candidate,
 * not scope for this feature). */
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
    padding: spacing.lg,
    marginBottom: spacing.md,
  },
  cardHeaderRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginBottom: spacing.xs },
  cardTitle: { fontSize: typography.subtitle, fontWeight: "700", color: colors.contentPrimary, flex: 1 },
  metaText: { fontSize: typography.caption, color: colors.contentQuaternary, marginBottom: spacing.sm },
  commentText: { fontSize: typography.body, color: colors.contentSecondary, marginBottom: spacing.md },
  cardActionsRow: { flexDirection: "row", gap: spacing.sm, marginTop: spacing.xs },
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
  exportCard: { marginTop: spacing.md },
  primaryButton: {
    backgroundColor: colors.actionPrimary,
    borderRadius: radius.lg,
    paddingVertical: 10,
    paddingHorizontal: spacing.lg,
    alignItems: "center",
    justifyContent: "center",
  },
  primaryButtonText: { color: colors.actionPrimaryText, fontSize: typography.body, fontWeight: "700" },
  buttonPressed: { opacity: 0.85 },
  exportOutputWrap: { marginTop: spacing.md },
  exportActionsRow: { flexDirection: "row", flexWrap: "wrap", gap: spacing.sm, marginBottom: spacing.sm },
  secondaryButton: {
    borderRadius: radius.lg,
    paddingVertical: 10,
    paddingHorizontal: spacing.lg,
    borderWidth: 1,
    borderColor: colors.actionPrimary,
    alignItems: "center",
    justifyContent: "center",
  },
  secondaryButtonText: { color: colors.actionPrimary, fontSize: typography.body, fontWeight: "700" },
  exportHint: { fontSize: typography.caption, color: colors.contentQuaternary, marginBottom: spacing.xs },
  exportScroll: { maxHeight: 320, borderWidth: 1, borderColor: colors.borderDefault, borderRadius: radius.md, backgroundColor: colors.surfaceSunken },
  exportOutput: {
    fontSize: typography.small,
    color: colors.contentPrimary,
    padding: spacing.sm,
    fontFamily: Platform.OS === "ios" ? "Courier" : "monospace",
  },
});
