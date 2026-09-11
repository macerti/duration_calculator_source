import React, { useMemo, useState } from "react";
import { View, Text, StyleSheet, ScrollView, Pressable, TextInput, Platform, Share } from "react-native";
import * as Clipboard from "expo-clipboard";
import { NativeStackScreenProps } from "@react-navigation/native-stack";
import { CommonActions } from "@react-navigation/native";
import { RootStackParamList } from "../../App";
import { useAuthContext } from "../context/AuthContext";
import { useToast } from "../components/Toast";
import Breadcrumbs from "../components/Breadcrumbs";
import ResponsiveContainer from "../components/ResponsiveContainer";
import CollapsibleSection from "../components/CollapsibleSection";
import SegmentedPicker from "../components/SegmentedPicker";
import { colors, spacing, radius, typography } from "../theme/tokens";
import { ACCEPTANCE_TEST_SECTIONS, TOTAL_ACCEPTANCE_TEST_COUNT, AcceptanceTestSection } from "../data/acceptanceTests";
import { APP_VERSION } from "../generated/versionInfo";

type Props = NativeStackScreenProps<RootStackParamList, "GuidedTestRunner">;

type ResultStatus = "pass" | "fail" | "skip";
interface ItemResult {
  status: ResultStatus | null;
  note: string;
}
type ResultsMap = Record<string, ItemResult>;

const EMPTY_RESULT: ItemResult = { status: null, note: "" };

function sectionCounts(section: AcceptanceTestSection, results: ResultsMap) {
  let pass = 0, fail = 0, skip = 0, answered = 0;
  for (const item of section.items) {
    const r = results[item.id];
    if (!r || r.status === null) continue;
    answered++;
    if (r.status === "pass") pass++;
    else if (r.status === "fail") fail++;
    else skip++;
  }
  return { pass, fail, skip, answered, total: section.items.length };
}

function sectionSummary(section: AcceptanceTestSection, results: ResultsMap): string {
  const { pass, fail, skip, answered, total } = sectionCounts(section, results);
  if (answered === 0) return `${total} scénario${total > 1 ? "s" : ""} · pas encore commencé`;
  const parts: string[] = [];
  if (pass > 0) parts.push(`${pass} ✅`);
  if (fail > 0) parts.push(`${fail} ❌`);
  if (skip > 0) parts.push(`${skip} ⏭️`);
  return `${answered}/${total} répondu${answered > 1 ? "s" : ""} — ${parts.join(" · ")}`;
}

/**
 * Builds the same "Test History" entry format already used at the bottom
 * of docs/TEST_CHECKLIST.md (see that file's own entries, e.g. the
 * forty-sixth session's DEBT-002 pass) — the point of FEAT-007 is a
 * one-click export a human or AI dev can paste straight into that log
 * without hand-synthesizing it from a live testing session.
 */
function buildMarkdownReport(results: ResultsMap, testedBy: string, dateStr: string): string {
  const lines: string[] = [];
  lines.push(`## ${dateStr} — v${APP_VERSION} — Guided Test Mode session`);
  lines.push("");
  lines.push(`Tested by: ${testedBy.trim() !== "" ? testedBy.trim() : "(non renseigné)"}`);
  lines.push("");

  let totalFail = 0, totalPass = 0, totalSkip = 0, totalAnswered = 0;
  const failDetails: string[] = [];

  for (const section of ACCEPTANCE_TEST_SECTIONS) {
    const { pass, fail, skip, answered, total } = sectionCounts(section, results);
    totalPass += pass; totalFail += fail; totalSkip += skip; totalAnswered += answered;
    if (answered === 0) continue;
    lines.push(`### ${section.number}. ${section.title} — ${answered}/${total}`);
    for (const item of section.items) {
      const r = results[item.id];
      if (!r || r.status === null) continue;
      const mark = r.status === "pass" ? "✅" : r.status === "fail" ? "❌" : "⏭️";
      const note = r.note.trim();
      lines.push(`- **${item.id}**: ${mark}${note !== "" ? ` — ${note}` : ""}`);
      if (r.status === "fail") failDetails.push(`${item.id}: ${note !== "" ? note : "(aucune description fournie)"}`);
    }
    lines.push("");
  }

  const notAnswered = TOTAL_ACCEPTANCE_TEST_COUNT - totalAnswered;
  lines.unshift(
    `Failures: ${totalFail}. Passed: ${totalPass}. Skipped: ${totalSkip}.` +
      (notAnswered > 0 ? ` Not run: ${notAnswered}/${TOTAL_ACCEPTANCE_TEST_COUNT}.` : ` All ${TOTAL_ACCEPTANCE_TEST_COUNT} scenarios covered.`),
    ""
  );
  if (failDetails.length > 0) {
    lines.push("### Failure details");
    for (const f of failDetails) lines.push(`- ${f}`);
    lines.push("");
  }
  return lines.join("\n");
}

function buildJsonReport(results: ResultsMap, testedBy: string, dateStr: string): string {
  const sections = ACCEPTANCE_TEST_SECTIONS.map((section) => ({
    number: section.number,
    title: section.title,
    items: section.items.map((item) => ({
      id: item.id,
      description: item.description,
      status: results[item.id]?.status ?? null,
      note: results[item.id]?.note?.trim() || null,
    })),
  }));
  const { pass, fail, skip, answered } = ACCEPTANCE_TEST_SECTIONS.reduce(
    (acc, s) => {
      const c = sectionCounts(s, results);
      return { pass: acc.pass + c.pass, fail: acc.fail + c.fail, skip: acc.skip + c.skip, answered: acc.answered + c.answered };
    },
    { pass: 0, fail: 0, skip: 0, answered: 0 }
  );
  return JSON.stringify(
    {
      appVersion: APP_VERSION,
      date: dateStr,
      testedBy: testedBy.trim() || null,
      totals: { total: TOTAL_ACCEPTANCE_TEST_COUNT, answered, pass, fail, skip },
      sections,
    },
    null,
    2
  );
}

/**
 * GuidedTestRunnerScreen — FEAT-007 ("In-App Guided Acceptance Test
 * Runner & Report Exporter", docs/ROADMAP.md P1 queue, approved/top
 * immediate tooling task per the tracker's own comments).
 *
 * Embeds docs/TEST_CHECKLIST.md's 73 scenarios (see
 * ../data/acceptanceTests.ts) directly in the app instead of requiring a
 * separate markdown file open side-by-side. A tester works through each
 * scenario inline (pass/fail/skip + an optional note, shown only for
 * fail/skip — matching TEST_CHECKLIST.md's own "❌ fail — describe what
 * happened, ⏭️ skipped, note why" convention, since a note is rarely
 * needed for a plain pass), then exports a standardized report in the
 * exact Markdown shape already used by TEST_CHECKLIST.md's own "Test
 * History" log (ready to paste in directly) plus a structured JSON
 * export for a dev/AI to consume without re-parsing prose. Export
 * actions (Copier/Partager/Télécharger) reuse the exact pattern the
 * now-deleted AdminAnnotationsScreen.tsx used (see git history at
 * 2e5e889^) — timestamped filenames (BUG-049), real OS-level share/
 * download rather than manual text selection (BUG-050 #7) — rather than
 * re-deriving a fresh version of the same fix.
 *
 * v1 scope, deliberately: results live only in this screen's React state
 * (not persisted to the backend) — a tester exports at the end and
 * pastes/attaches the result wherever it needs to go (this project's own
 * DEV_STATUS.md/TEST_CHECKLIST.md hand-off convention, or a tracker_items
 * comment). Persisting in-progress runs server-side, or auto-filing a
 * tracker_items row per failure, would be a reasonable follow-up but
 * isn't required by FEAT-007's own approved scope and would meaningfully
 * grow this session's chunk — left as a natural next increment rather
 * than attempted half-done.
 *
 * Gated behind manage_tracker (same population already responsible for
 * the bug/feature/tech-debt tracker) rather than a new dedicated
 * permission — this is dev/tester tooling, not end-user-facing, and
 * adding a new permission would need its own migration + admin-role UI
 * wiring for no clear benefit over reusing the existing one.
 */
export default function GuidedTestRunnerScreen({ navigation }: Props) {
  const { user, hasPermission } = useAuthContext();
  const toast = useToast();
  const allowed = hasPermission("manage_tracker");

  const [results, setResults] = useState<ResultsMap>({});
  const [testedBy, setTestedBy] = useState(user?.name ?? "");
  const [exportFormat, setExportFormat] = useState<"markdown" | "json">("markdown");
  const [exportText, setExportText] = useState<string | null>(null);
  const [resetArmed, setResetArmed] = useState(false);

  const totals = useMemo(() => {
    let pass = 0, fail = 0, skip = 0, answered = 0;
    for (const section of ACCEPTANCE_TEST_SECTIONS) {
      const c = sectionCounts(section, results);
      pass += c.pass; fail += c.fail; skip += c.skip; answered += c.answered;
    }
    return { pass, fail, skip, answered, total: TOTAL_ACCEPTANCE_TEST_COUNT };
  }, [results]);

  const setItemStatus = (id: string, status: ResultStatus) => {
    setResults((prev) => ({ ...prev, [id]: { status, note: prev[id]?.note ?? "" } }));
  };
  const setItemNote = (id: string, note: string) => {
    setResults((prev) => ({ ...prev, [id]: { status: prev[id]?.status ?? null, note } }));
  };

  const dateStr = useMemo(() => new Date().toISOString().slice(0, 10), []);

  const generateExport = () => {
    const text = exportFormat === "markdown" ? buildMarkdownReport(results, testedBy, dateStr) : buildJsonReport(results, testedBy, dateStr);
    setExportText(text);
  };

  const exportFilename = () => {
    const now = new Date();
    const pad = (n: number) => String(n).padStart(2, "0");
    const stamp = `${now.getFullYear()}${pad(now.getMonth() + 1)}${pad(now.getDate())}-${pad(now.getHours())}${pad(now.getMinutes())}${pad(now.getSeconds())}`;
    return `guided-test-report-${stamp}.${exportFormat === "markdown" ? "md" : "json"}`;
  };

  const copyExport = async () => {
    if (!exportText) return;
    try {
      await Clipboard.setStringAsync(exportText);
      toast.show("Rapport copié dans le presse-papiers.", "success");
    } catch {
      toast.show("Copie impossible sur cet appareil.", "error");
    }
  };

  const shareExport = async () => {
    if (!exportText) return;
    try {
      await Share.share(Platform.OS === "web" ? { message: exportText } : { message: exportText, title: exportFilename() });
    } catch (e: any) {
      if (e?.message && !/dismiss/i.test(e.message)) toast.show("Partage impossible sur cet appareil.", "error");
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
    } catch {
      toast.show("Téléchargement impossible.", "error");
    }
  };

  const resetAll = () => {
    if (!resetArmed) {
      setResetArmed(true);
      return;
    }
    setResults({});
    setExportText(null);
    setResetArmed(false);
    toast.show("Session de test réinitialisée.", "success");
  };

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
      <ScrollView style={styles.container} contentContainerStyle={{ paddingBottom: spacing.xxl }}>
        <Breadcrumbs
          items={[
            { icon: "home-outline", onPress: () => navigation.dispatch(CommonActions.reset({ index: 0, routes: [{ name: "Home" }] })) },
            { label: "Profil", onPress: () => navigation.navigate("Profile") },
            { label: "Mode Test Guidé" },
          ]}
        />
        <Text style={styles.title}>Mode Test Guidé</Text>
        <Text style={styles.subtitle}>
          Les {TOTAL_ACCEPTANCE_TEST_COUNT} scénarios de docs/TEST_CHECKLIST.md, à parcourir directement dans l'app.
          Marquez chaque scénario, puis exportez un rapport prêt à coller dans le journal Test History ou à transmettre
          au développeur suivant.
        </Text>

        <View style={styles.progressBox}>
          <Text style={styles.progressText}>
            {totals.answered}/{totals.total} répondus — {totals.pass} ✅ · {totals.fail} ❌ · {totals.skip} ⏭️
          </Text>
        </View>

        {ACCEPTANCE_TEST_SECTIONS.map((section) => (
          <CollapsibleSection
            key={section.number}
            title={`${section.number}. ${section.title}`}
            summary={sectionSummary(section, results)}
            defaultExpanded={false}
          >
            {section.items.map((item) => {
              const r = results[item.id] ?? EMPTY_RESULT;
              const showNote = r.status === "fail" || r.status === "skip";
              return (
                <View key={item.id} style={styles.itemRow}>
                  <View style={styles.itemHeaderRow}>
                    <Text style={styles.itemId}>{item.id}</Text>
                    <SegmentedPicker<ResultStatus>
                      label=""
                      value={r.status ?? undefined}
                      options={[
                        { value: "pass", label: "✅" },
                        { value: "fail", label: "❌" },
                        { value: "skip", label: "⏭️" },
                      ]}
                      onChange={(v) => setItemStatus(item.id, v)}
                    />
                  </View>
                  <Text style={styles.itemDescription}>{item.description}</Text>
                  {showNote && (
                    <TextInput
                      style={styles.noteInput}
                      value={r.note}
                      onChangeText={(t) => setItemNote(item.id, t)}
                      placeholder={r.status === "fail" ? "Décrivez ce qui s'est passé…" : "Pourquoi ce scénario est ignoré…"}
                      placeholderTextColor={colors.contentTertiary}
                      multiline
                    />
                  )}
                </View>
              );
            })}
          </CollapsibleSection>
        ))}

        <View style={styles.exportCard}>
          <Text style={styles.cardHeading}>Exporter le rapport</Text>
          <TextInput
            style={styles.textInput}
            value={testedBy}
            onChangeText={setTestedBy}
            placeholder="Testé par (nom)"
            placeholderTextColor={colors.contentTertiary}
          />
          <SegmentedPicker<"markdown" | "json">
            label="Format"
            value={exportFormat}
            options={[
              { value: "markdown", label: "Markdown" },
              { value: "json", label: "JSON" },
            ]}
            onChange={setExportFormat}
          />
          <Pressable style={({ pressed }) => [styles.primaryButton, pressed && styles.buttonPressed]} onPress={generateExport} accessibilityRole="button">
            <Text style={styles.primaryButtonText}>Générer le rapport</Text>
          </Pressable>

          {exportText && (
            <>
              <ScrollView style={styles.exportPreview} nestedScrollEnabled>
                <Text style={styles.exportPreviewText}>{exportText}</Text>
              </ScrollView>
              <View style={styles.cardActionsRow}>
                <Pressable style={({ pressed }) => [styles.secondaryButton, pressed && styles.buttonPressed]} onPress={copyExport} accessibilityRole="button" testID="guided-test-export-copy-button">
                  <Text style={styles.secondaryButtonText}>Copier</Text>
                </Pressable>
                <Pressable style={({ pressed }) => [styles.secondaryButton, pressed && styles.buttonPressed]} onPress={shareExport} accessibilityRole="button" testID="guided-test-export-share-button">
                  <Text style={styles.secondaryButtonText}>Partager</Text>
                </Pressable>
                <Pressable style={({ pressed }) => [styles.secondaryButton, pressed && styles.buttonPressed]} onPress={downloadExport} accessibilityRole="button" testID="guided-test-export-download-button">
                  <Text style={styles.secondaryButtonText}>Télécharger</Text>
                </Pressable>
              </View>
            </>
          )}
        </View>

        <Pressable
          style={({ pressed }) => [styles.dangerButton, resetArmed && styles.dangerButtonArmed, pressed && styles.buttonPressed]}
          onPress={resetAll}
          onBlur={() => setResetArmed(false)}
          accessibilityRole="button"
        >
          <Text style={[styles.dangerButtonText, resetArmed && styles.dangerButtonTextArmed]}>
            {resetArmed ? "Confirmer la réinitialisation" : "Réinitialiser la session de test"}
          </Text>
        </Pressable>
      </ScrollView>
    </ResponsiveContainer>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, padding: spacing.lg },
  title: { fontSize: typography.display, fontWeight: "700", color: colors.contentPrimary, marginTop: spacing.md, marginBottom: spacing.xs },
  subtitle: { fontSize: typography.small, color: colors.contentTertiary, marginBottom: spacing.lg },
  deniedText: { fontSize: typography.body, color: colors.contentSecondary, marginTop: spacing.xxl, textAlign: "center" },
  progressBox: { backgroundColor: colors.surfaceSunken, borderRadius: radius.lg, padding: spacing.md, marginBottom: spacing.lg },
  progressText: { fontSize: typography.subtitle, fontWeight: "700", color: colors.contentPrimary },
  itemRow: { borderTopWidth: 1, borderTopColor: colors.borderSubtle, paddingVertical: spacing.sm },
  itemHeaderRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: spacing.xs },
  itemId: { fontSize: typography.small, fontWeight: "700", color: colors.contentTertiary },
  itemDescription: { fontSize: typography.body, color: colors.contentSecondary, marginBottom: spacing.xs },
  noteInput: {
    borderWidth: 1, borderColor: colors.borderDefault, borderRadius: radius.md, padding: spacing.sm,
    fontSize: typography.body, color: colors.contentPrimary, backgroundColor: colors.surfaceBase, minHeight: 44,
  },
  exportCard: {
    backgroundColor: colors.surfaceRaised, borderRadius: radius.xl, borderWidth: 1, borderColor: colors.borderDefault,
    padding: spacing.lg, marginTop: spacing.lg,
  },
  cardHeading: { fontSize: typography.subtitle, fontWeight: "700", color: colors.contentPrimary, marginBottom: spacing.sm },
  textInput: {
    borderWidth: 1, borderColor: colors.borderDefault, borderRadius: radius.md, padding: spacing.sm,
    fontSize: typography.body, color: colors.contentPrimary, backgroundColor: colors.surfaceBase, marginBottom: spacing.sm,
  },
  exportPreview: { maxHeight: 260, backgroundColor: colors.surfaceSunken, borderRadius: radius.md, padding: spacing.sm, marginTop: spacing.md },
  exportPreviewText: { fontSize: typography.small, color: colors.contentSecondary, fontFamily: Platform.OS === "web" ? "monospace" : undefined },
  cardActionsRow: { flexDirection: "row", gap: spacing.sm, marginTop: spacing.sm },
  primaryButton: {
    backgroundColor: colors.actionPrimary, borderRadius: radius.lg, paddingVertical: 10, paddingHorizontal: spacing.lg,
    alignItems: "center", justifyContent: "center",
  },
  primaryButtonText: { color: colors.actionPrimaryText, fontSize: typography.body, fontWeight: "700" },
  buttonPressed: { opacity: 0.85 },
  secondaryButton: {
    borderRadius: radius.lg, paddingVertical: 10, paddingHorizontal: spacing.lg, borderWidth: 1,
    borderColor: colors.actionPrimary, alignItems: "center", justifyContent: "center",
  },
  secondaryButtonText: { color: colors.actionPrimary, fontSize: typography.body, fontWeight: "700" },
  dangerButton: {
    borderRadius: radius.lg, paddingVertical: 10, paddingHorizontal: spacing.lg, borderWidth: 1,
    borderColor: colors.error, alignItems: "center", justifyContent: "center", marginTop: spacing.lg,
  },
  dangerButtonArmed: { backgroundColor: colors.error },
  dangerButtonText: { color: colors.error, fontSize: typography.body, fontWeight: "700" },
  dangerButtonTextArmed: { color: colors.contentInverse },
});
