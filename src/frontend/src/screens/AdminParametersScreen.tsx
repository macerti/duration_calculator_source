import React, { useCallback, useEffect, useState } from "react";
import { View, Text, StyleSheet, ActivityIndicator, ScrollView, Pressable, TextInput, Switch } from "react-native";
import { NativeStackScreenProps } from "@react-navigation/native-stack";
import { CommonActions } from "@react-navigation/native";
import { RootStackParamList } from "../../App";
import { useAuthContext } from "../context/AuthContext";
import { useAdminApi, ParameterSet, ParameterSetVersion, AdminApiError } from "../hooks/useAdminApi";
import { useToast } from "../components/Toast";
import Breadcrumbs from "../components/Breadcrumbs";
import ResponsiveContainer from "../components/ResponsiveContainer";
import CollapsibleSection from "../components/CollapsibleSection";
import { colors, spacing, radius, typography } from "../theme/tokens";

type Props = NativeStackScreenProps<RootStackParamList, "AdminParameters">;

/**
 * AdminParametersScreen — FEAT-008 slice 2 (Parameter Admin UI), first
 * frontend pass. Backend (`parameterSetRepo.php`'s new admin functions,
 * 5 routes under `/admin/parameters*`, 14 HTTP tests) built and verified
 * the session before this one — see that session's tracker entry for the
 * full survey of which engine constants are/aren't exposed here and why.
 *
 * Scope of THIS pass, deliberately not the whole `parameter_sets` blob:
 * editable form fields for the scalar/small-object sections that are
 * genuinely "a few numbers a business owner might want to tune"
 * (`naeCoefficients`, `reportWritingPercent`, `rounding.nearest`,
 * `aggregateFactorCaps`). The much larger tabular sections
 * (`iafDurationTables`, `factorCatalogue`, `synergyGrid`, `naceTable` —
 * hundreds of rows combined) are read-only counts here, not editable —
 * a real table editor for those is a separate, larger follow-up, not
 * this same pass. Every edit is saved as a brand-new version (the
 * backend never lets an existing version's data change in place — see
 * `parameterSetRepo.php`'s `saveNewParameterSetVersion()`), so nothing
 * here can silently overwrite history.
 *
 * List/detail/form visual pattern mirrors `AdminSessionLogScreen.tsx`;
 * `maxWidth={1100}`, matching `AdminTrackerScreen.tsx`/
 * `AdminSessionLogScreen.tsx` — not `AdminAnnotationsScreen.tsx`'s
 * narrower 800 — per `DEBT-002`'s own finding on that mistake.
 */
export default function AdminParametersScreen({ navigation }: Props) {
  const { csrfToken, hasPermission } = useAuthContext();
  const api = useAdminApi(csrfToken);
  const toast = useToast();
  const allowed = hasPermission("manage_parameters");

  const [active, setActive] = useState<ParameterSet | null>(null);
  const [edited, setEdited] = useState<ParameterSet | null>(null);
  const [versions, setVersions] = useState<ParameterSetVersion[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [changeNote, setChangeNote] = useState("");
  const [saving, setSaving] = useState(false);
  const [activatingId, setActivatingId] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      const [activeSet, versionList] = await Promise.all([api.getActiveParameterSet(), api.listParameterSetVersions()]);
      setActive(activeSet);
      setEdited(JSON.parse(JSON.stringify(activeSet)));
      setVersions(versionList);
      setError(null);
    } catch (e: any) {
      setError(e instanceof AdminApiError ? e.message : "Erreur de chargement.");
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [csrfToken]);

  useEffect(() => {
    if (allowed) load();
  }, [allowed, load]);

  const isDirty = active !== null && edited !== null && JSON.stringify(active) !== JSON.stringify(edited);

  const updateEdited = (mutate: (draft: ParameterSet) => void) => {
    setEdited((prev) => {
      if (!prev) return prev;
      const clone: ParameterSet = JSON.parse(JSON.stringify(prev));
      mutate(clone);
      return clone;
    });
  };

  const handleSave = async () => {
    if (!edited || changeNote.trim() === "") return;
    setSaving(true);
    try {
      const saved = await api.saveParameterSet(edited, changeNote.trim(), true);
      setActive(saved);
      setEdited(JSON.parse(JSON.stringify(saved)));
      setChangeNote("");
      setVersions(await api.listParameterSetVersions());
      toast.show(`Nouvelle version enregistrée et activée (v${saved.version}).`, "success");
    } catch (e: any) {
      toast.show(e instanceof AdminApiError ? e.message : "Erreur d'enregistrement.", "error");
    } finally {
      setSaving(false);
    }
  };

  const handleDiscard = () => {
    if (active) setEdited(JSON.parse(JSON.stringify(active)));
    setChangeNote("");
  };

  const handleActivate = async (id: string) => {
    setActivatingId(id);
    try {
      const activated = await api.activateParameterSetVersion(id);
      setActive(activated);
      setEdited(JSON.parse(JSON.stringify(activated)));
      setChangeNote("");
      setVersions(await api.listParameterSetVersions());
      toast.show(`Version ${activated.version} activée.`, "success");
    } catch (e: any) {
      toast.show(e instanceof AdminApiError ? e.message : "Erreur d'activation.", "error");
    } finally {
      setActivatingId(null);
    }
  };

  const crumbs = [
    { icon: "home-outline" as const, onPress: () => navigation.dispatch(CommonActions.reset({ index: 0, routes: [{ name: "Home" as const }] })) },
    { label: "Profil", onPress: () => navigation.navigate("Profile") },
    { label: "Paramètres de calcul" },
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
        <Text style={styles.title}>Paramètres de calcul</Text>
        <Text style={styles.subtitle}>
          Coefficients et réglages du moteur de calcul — modifiez ici plutôt que dans le code source. Chaque
          enregistrement crée une nouvelle version horodatée ; les versions précédentes restent consultables et
          réactivables ci-dessous.
        </Text>

        {error && (
          <View style={styles.errorBox}>
            <Text style={styles.errorText}>{error}</Text>
          </View>
        )}

        {edited === null && !error ? (
          <ActivityIndicator style={{ marginTop: spacing.xl }} />
        ) : edited ? (
          <>
            <View style={styles.card}>
              <Text style={styles.cardHeading}>Coefficients NAE (Nombre d'Auditeurs Équivalents)</Text>
              <Text style={styles.cardHint}>
                Utilisés dans le calcul du NAE par site — auparavant des valeurs fixes dans le code (engine/nae.php).
              </Text>
              <NumberField
                label="Abattement personnel répétitif (ex. 0.75)"
                value={edited.naeCoefficients.repetitiveTaskDiscount}
                onChange={(v) => updateEdited((d) => { d.naeCoefficients.repetitiveTaskDiscount = v; })}
                testID="param-nae-repetitive-discount"
              />
              <NumberField
                label="Diviseur personnel indirect (ex. 4)"
                value={edited.naeCoefficients.indirectStaffDivisor}
                onChange={(v) => updateEdited((d) => { d.naeCoefficients.indirectStaffDivisor = v; })}
                testID="param-nae-indirect-divisor"
              />
            </View>

            <View style={styles.card}>
              <Text style={styles.cardHeading}>Rédaction du rapport &amp; arrondi</Text>
              <NumberField
                label="Rédaction du rapport (% du temps sur site)"
                value={edited.reportWritingPercent}
                onChange={(v) => updateEdited((d) => { d.reportWritingPercent = v; })}
                testID="param-report-writing-percent"
              />
              <NumberField
                label="Arrondi du total (au plus proche multiple de)"
                value={edited.rounding.nearest}
                onChange={(v) => updateEdited((d) => { d.rounding.nearest = v; })}
                testID="param-rounding-nearest"
              />
            </View>

            <View style={styles.card}>
              <Text style={styles.cardHeading}>Plafonds des facteurs cumulés</Text>
              <View style={styles.switchRow}>
                <Text style={styles.fieldLabel}>Appliquer les plafonds</Text>
                <Switch
                  value={edited.aggregateFactorCaps.enforceAggregateCaps}
                  onValueChange={(v) => updateEdited((d) => { d.aggregateFactorCaps.enforceAggregateCaps = v; })}
                  testID="param-enforce-caps-switch"
                />
              </View>
              <NumberField
                label="Plafond d'augmentation (%)"
                value={edited.aggregateFactorCaps.maxAugmentationPercent}
                onChange={(v) => updateEdited((d) => { d.aggregateFactorCaps.maxAugmentationPercent = v; })}
                testID="param-max-augmentation"
              />
              <NumberField
                label="Plafond de réduction (%, négatif)"
                value={edited.aggregateFactorCaps.maxReductionPercent}
                onChange={(v) => updateEdited((d) => { d.aggregateFactorCaps.maxReductionPercent = v; })}
                testID="param-max-reduction"
              />
            </View>

            <CollapsibleSection
              title="Tables et catalogues (lecture seule pour l'instant)"
              summary="Tables IAF, catalogue de facteurs, grille de synergie, table NACE"
              defaultExpanded={false}
            >
              <Text style={styles.readOnlyHint}>
                L'édition de ces tables (durées IAF par norme/risque, catalogue de facteurs, grille de synergie, table
                NACE) n'est pas encore disponible depuis cet écran — elle nécessite un éditeur dédié par table, prévu
                dans une prochaine passe. Aperçu du contenu actuellement actif :
              </Text>
              <ReadOnlyCount label="Normes IAF configurées" value={Object.keys(edited.iafDurationTables ?? {}).join(", ") || "—"} />
              <ReadOnlyCount label="Éléments du catalogue de facteurs" value={String((edited.factorCatalogue ?? []).length)} />
              <ReadOnlyCount label="Lignes de la grille de synergie" value={String((edited.synergyGrid ?? []).length)} />
              <ReadOnlyCount label="Entrées de la table NACE" value={String((edited.naceTable ?? []).length)} />
            </CollapsibleSection>

            <View style={styles.card}>
              <Text style={styles.cardHeading}>Enregistrer les modifications</Text>
              <TextInput
                style={styles.textArea}
                value={changeNote}
                onChangeText={setChangeNote}
                placeholder="Note de modification (obligatoire) — ex. « ajustement du diviseur personnel indirect suite à retour terrain »"
                placeholderTextColor={colors.contentTertiary}
                multiline
                testID="param-change-note-input"
              />
              <View style={styles.cardActionsRow}>
                <Pressable
                  style={({ pressed }) => [
                    styles.primaryButton,
                    pressed && styles.buttonPressed,
                    (!isDirty || changeNote.trim() === "" || saving) && styles.buttonDisabled,
                  ]}
                  disabled={!isDirty || changeNote.trim() === "" || saving}
                  onPress={handleSave}
                  accessibilityRole="button"
                  testID="param-save-button"
                >
                  {saving ? <ActivityIndicator size="small" color={colors.actionPrimaryText} /> : <Text style={styles.primaryButtonText}>Enregistrer une nouvelle version</Text>}
                </Pressable>
                <Pressable
                  style={({ pressed }) => [styles.secondaryButton, pressed && styles.buttonPressed, !isDirty && styles.buttonDisabled]}
                  disabled={!isDirty}
                  onPress={handleDiscard}
                  accessibilityRole="button"
                >
                  <Text style={styles.secondaryButtonText}>Annuler les modifications</Text>
                </Pressable>
              </View>
              {!isDirty && <Text style={styles.cardHint}>Aucune modification en attente.</Text>}
            </View>
          </>
        ) : null}

        <Text style={styles.sectionTitle}>Historique des versions</Text>
        {versions === null && !error ? (
          <ActivityIndicator />
        ) : versions !== null && versions.length === 0 ? (
          <Text style={styles.emptyText}>Aucune version.</Text>
        ) : (
          versions?.map((v) => (
            <View key={v.id} style={styles.card}>
              <View style={styles.cardHeaderRow}>
                <Text style={styles.cardLabel}>
                  v{v.version} {v.isActive ? "· active" : ""}
                </Text>
                <Text style={styles.cardDate}>{new Date(v.createdAt).toLocaleString("fr-FR")}</Text>
              </View>
              {v.changeNote && <Text style={styles.cardSummary}>{v.changeNote}</Text>}
              {!v.isActive && (
                <Pressable
                  style={({ pressed }) => [styles.secondaryButton, pressed && styles.buttonPressed, { alignSelf: "flex-start" }, activatingId === v.id && styles.buttonDisabled]}
                  disabled={activatingId === v.id}
                  onPress={() => handleActivate(v.id)}
                  accessibilityRole="button"
                  testID={`param-activate-${v.id}`}
                >
                  {activatingId === v.id ? <ActivityIndicator size="small" color={colors.actionPrimary} /> : <Text style={styles.secondaryButtonText}>Activer cette version</Text>}
                </Pressable>
              )}
            </View>
          ))
        )}
      </ScrollView>
    </ResponsiveContainer>
  );
}

/**
 * Local string state so a partial/invalid decimal (e.g. typing "0." on the
 * way to "0.75", or briefly clearing the field) doesn't get clobbered by a
 * parent re-render before the user finishes typing. Only calls onChange
 * with a real, valid number; reverts the displayed text to the last valid
 * value on blur if what's showing doesn't parse.
 */
function NumberField({ label, value, onChange, testID }: { label: string; value: number; onChange: (v: number) => void; testID?: string }) {
  const [text, setText] = useState(String(value));

  useEffect(() => {
    setText(String(value));
    // Only re-sync from external value changes (e.g. discard/activate) —
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value]);

  const handleChangeText = (t: string) => {
    setText(t);
    const normalized = t.replace(",", ".").trim();
    if (normalized !== "" && normalized !== "-" && !isNaN(Number(normalized))) {
      onChange(Number(normalized));
    }
  };

  const handleBlur = () => {
    if (isNaN(Number(text.replace(",", ".").trim())) || text.trim() === "") {
      setText(String(value));
    }
  };

  return (
    <View style={styles.field}>
      <Text style={styles.fieldLabel}>{label}</Text>
      <TextInput
        style={styles.textInput}
        value={text}
        onChangeText={handleChangeText}
        onBlur={handleBlur}
        keyboardType="numeric"
        testID={testID}
      />
    </View>
  );
}

function ReadOnlyCount({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.field}>
      <Text style={styles.fieldLabel}>{label}</Text>
      <Text style={styles.fieldValue}>{value}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, padding: spacing.lg },
  title: { fontSize: typography.display, fontWeight: "700", color: colors.contentPrimary, marginTop: spacing.md, marginBottom: spacing.xs },
  subtitle: { fontSize: typography.small, color: colors.contentTertiary, marginBottom: spacing.lg },
  sectionTitle: { fontSize: typography.subtitle, fontWeight: "700", color: colors.contentPrimary, marginTop: spacing.lg, marginBottom: spacing.sm },
  deniedText: { fontSize: typography.body, color: colors.contentSecondary, marginTop: spacing.xxl, textAlign: "center" },
  errorBox: { backgroundColor: colors.errorSurface, borderRadius: radius.lg, padding: spacing.md, marginBottom: spacing.md },
  errorText: { color: colors.error, fontSize: typography.body },
  emptyText: { fontSize: typography.body, color: colors.contentTertiary, textAlign: "center", marginTop: spacing.xl },
  readOnlyHint: { fontSize: typography.small, color: colors.contentTertiary, marginBottom: spacing.sm },
  card: {
    backgroundColor: colors.surfaceRaised,
    borderRadius: radius.xl,
    borderWidth: 1,
    borderColor: colors.borderDefault,
    padding: spacing.md,
    marginBottom: spacing.sm,
  },
  cardHeading: { fontSize: typography.subtitle, fontWeight: "700", color: colors.contentPrimary, marginBottom: spacing.xs },
  cardHint: { fontSize: typography.small, color: colors.contentTertiary, marginBottom: spacing.sm },
  cardHeaderRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: spacing.xs },
  cardLabel: { fontSize: typography.bodyLarge, fontWeight: "700", color: colors.contentPrimary },
  cardDate: { fontSize: typography.caption, color: colors.contentQuaternary },
  cardSummary: { fontSize: typography.body, color: colors.contentSecondary, marginBottom: spacing.xs },
  field: { marginBottom: spacing.sm },
  fieldLabel: { fontSize: typography.small, color: colors.contentTertiary, marginBottom: 2, fontWeight: "600" },
  fieldValue: { fontSize: typography.body, color: colors.contentSecondary },
  switchRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: spacing.sm },
  textArea: {
    borderWidth: 1, borderColor: colors.borderDefault, borderRadius: radius.md, padding: spacing.sm,
    fontSize: typography.body, color: colors.contentPrimary, backgroundColor: colors.surfaceBase, marginBottom: spacing.sm, minHeight: 44,
  },
  textInput: {
    borderWidth: 1, borderColor: colors.borderDefault, borderRadius: radius.md, padding: spacing.sm,
    fontSize: typography.body, color: colors.contentPrimary, backgroundColor: colors.surfaceBase,
  },
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
