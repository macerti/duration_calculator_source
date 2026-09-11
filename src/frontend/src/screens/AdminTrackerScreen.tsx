import React, { useCallback, useEffect, useRef, useState } from "react";
import { View, Text, StyleSheet, ActivityIndicator, ScrollView, Pressable, TextInput } from "react-native";
import { NativeStackScreenProps } from "@react-navigation/native-stack";
import { CommonActions } from "@react-navigation/native";
import { RootStackParamList } from "../../App";
import { useAuthContext } from "../context/AuthContext";
import { useAdminApi, TrackerItem, AdminApiError } from "../hooks/useAdminApi";
import { useToast } from "../components/Toast";
import Breadcrumbs from "../components/Breadcrumbs";
import ResponsiveContainer from "../components/ResponsiveContainer";
import SegmentedPicker from "../components/SegmentedPicker";
import MultiSelectFilter from "../components/MultiSelectFilter";
import CollapsibleSection from "../components/CollapsibleSection";
import { colors, spacing, radius, typography } from "../theme/tokens";

type Props = NativeStackScreenProps<RootStackParamList, "AdminTracker">;

const STATUS_LABELS: Record<TrackerItem["status"], string> = {
  open: "Ouvert",
  in_progress: "En cours",
  fixed_unverified: "Corrigé (non vérifié)",
  verified: "Vérifié",
  closed: "Fermé",
};
const TYPE_LABELS: Record<TrackerItem["type"], string> = {
  bug: "Bug",
  feature: "Fonctionnalité",
  techdebt: "Dette technique",
  other: "Autre",
  // Added 2026-09-10, migration 009 (annotations/tracker merge) — the
  // placeholder type a row created via the in-app pin tool gets before a
  // dev reclassifies it. See createAnnotationTrackerItem() in
  // trackerRepo.php.
  annotation: "Annotation",
};
const PRIORITY_LABELS: Record<NonNullable<TrackerItem["priority"]>, string> = {
  p0: "P0", p1: "P1", p2: "P2", p3: "P3",
};
const ALL_STATUSES = Object.keys(STATUS_LABELS) as TrackerItem["status"][];
const ALL_TYPES = Object.keys(TYPE_LABELS) as TrackerItem["type"][];
const ALL_PRIORITIES = Object.keys(PRIORITY_LABELS) as NonNullable<TrackerItem["priority"]>[];
// "always defaultly set to show all what's not closed" — Mahdi, 2026-09-10.
// Every status except 'closed' checked on load; type/priority start with
// nothing checked, which — for a multiselect — means "no filter on this
// field" (matches listTrackerItems()'s own empty-array-means-no-filter
// semantics), not "show nothing".
const DEFAULT_STATUS_FILTER: TrackerItem["status"][] = ["open", "in_progress", "fixed_unverified", "verified"];
const SEARCH_DEBOUNCE_MS = 300; // matches NaceSearchField.tsx's own debounce timing

/** Status line shown next to "Filtres et recherche" whether the section is
 * expanded or collapsed, so collapsing it to save space never hides *that*
 * something is filtered — only the controls used to change it. */
function filterSummary(
  statusFilter: TrackerItem["status"][],
  typeFilter: TrackerItem["type"][],
  priorityFilter: NonNullable<TrackerItem["priority"]>[],
  search: string,
  resultCount: number | null
): string {
  let active = 0;
  if (statusFilter.length > 0 && statusFilter.length < ALL_STATUSES.length) active++;
  if (typeFilter.length > 0) active++;
  if (priorityFilter.length > 0) active++;
  if (search.trim() !== "") active++;
  const filterPart = active === 0 ? "Aucun filtre actif" : `${active} filtre${active > 1 ? "s" : ""} actif${active > 1 ? "s" : ""}`;
  const countPart = resultCount === null ? "" : ` · ${resultCount} résultat${resultCount !== 1 ? "s" : ""}`;
  return filterPart + countPart;
}

/**
 * AdminTrackerScreen — FEAT-010 (docs/ROADMAP.md item 12). Admin-visible,
 * filterable, CRUD-able UI for the bug/feature/tech-debt tracker
 * (`tracker_items` + append-only `tracker_updates` history), replacing
 * BUGLOG.md/ROADMAP.md/DEV_STATUS.md as the *progress-tracking* source of
 * truth per Mahdi's explicit 2026-09-07 request — those markdown files
 * remain, but only for dev-to-dev narrative hand-off, not status tracking.
 * Mirrors AdminAnnotationsScreen.tsx's shape (list/filter/card pattern,
 * useAdminApi's request() error handling) since that's this project's own
 * named precedent to follow. Reachable only via ProfileScreen's
 * `manage_tracker`-gated button; re-checks the permission itself (same
 * defense-in-depth as every other admin screen) since the server enforces
 * it independently regardless.
 *
 * Uses a wide maxWidth (1100, matching CalculationWizardScreen) rather
 * than AdminAnnotationsScreen's narrower 800 — deliberately not repeating
 * the narrow-desktop-column mistake tracked as DEBT-002.
 */
export default function AdminTrackerScreen({ navigation }: Props) {
  const { csrfToken, hasPermission } = useAuthContext();
  const api = useAdminApi(csrfToken);
  const toast = useToast();
  const allowed = hasPermission("manage_tracker");

  const [items, setItems] = useState<TrackerItem[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [statusFilter, setStatusFilter] = useState<TrackerItem["status"][]>(DEFAULT_STATUS_FILTER);
  const [typeFilter, setTypeFilter] = useState<TrackerItem["type"][]>([]);
  const [priorityFilter, setPriorityFilter] = useState<NonNullable<TrackerItem["priority"]>[]>([]);
  const [searchInput, setSearchInput] = useState(""); // raw typed value, debounced below
  const [search, setSearch] = useState(""); // value actually sent to the API
  const searchDebounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [selectedCode, setSelectedCode] = useState<string | null>(null);
  const [detail, setDetail] = useState<TrackerItem | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [busyCode, setBusyCode] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);

  useEffect(() => {
    if (searchDebounceRef.current) clearTimeout(searchDebounceRef.current);
    searchDebounceRef.current = setTimeout(() => setSearch(searchInput), SEARCH_DEBOUNCE_MS);
    return () => {
      if (searchDebounceRef.current) clearTimeout(searchDebounceRef.current);
    };
  }, [searchInput]);

  const load = useCallback(async () => {
    try {
      const rows = await api.listTrackerItems({
        status: statusFilter.length > 0 ? statusFilter : undefined,
        type: typeFilter.length > 0 ? typeFilter : undefined,
        priority: priorityFilter.length > 0 ? priorityFilter : undefined,
        search: search.trim() !== "" ? search.trim() : undefined,
      });
      setItems(rows);
      setError(null);
    } catch (e: any) {
      setError(e instanceof AdminApiError ? e.message : "Erreur de chargement.");
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [csrfToken, statusFilter, typeFilter, priorityFilter, search]);

  useEffect(() => {
    if (allowed) load();
  }, [allowed, load]);

  const openDetail = async (code: string) => {
    setSelectedCode(code);
    setDetail(null);
    setDetailLoading(true);
    try {
      const item = await api.getTrackerItem(code);
      setDetail(item);
    } catch (e: any) {
      toast.show(e instanceof AdminApiError ? e.message : "Erreur de chargement.", "error");
    } finally {
      setDetailLoading(false);
    }
  };

  const closeDetail = () => {
    setSelectedCode(null);
    setDetail(null);
  };

  const refreshList = (updated: TrackerItem) => {
    setItems((prev) => {
      if (!prev) return prev;
      // Empty array = no filter on that field, same semantics as
      // listTrackerItems() itself — see the DEFAULT_STATUS_FILTER comment
      // above for why an empty selection means "all", not "none".
      const stillMatches =
        (statusFilter.length === 0 || statusFilter.includes(updated.status)) &&
        (typeFilter.length === 0 || typeFilter.includes(updated.type)) &&
        (priorityFilter.length === 0 || (updated.priority !== null && priorityFilter.includes(updated.priority)));
      const exists = prev.some((x) => x.code === updated.code);
      if (!stillMatches) return prev.filter((x) => x.code !== updated.code);
      if (exists) return prev.map((x) => (x.code === updated.code ? updated : x));
      return [updated, ...prev];
    });
  };

  const saveField = async (code: string, fields: Parameters<ReturnType<typeof useAdminApi>["updateTrackerItem"]>[1]) => {
    setBusyCode(code);
    try {
      const updated = await api.updateTrackerItem(code, fields);
      setDetail(updated);
      refreshList(updated);
      toast.show("Mis à jour.", "success");
    } catch (e: any) {
      toast.show(e instanceof AdminApiError ? e.message : "Mise à jour impossible.", "error");
    } finally {
      setBusyCode(null);
    }
  };

  const logUpdate = async (code: string, done: string, next: string | null, status: TrackerItem["status"] | undefined) => {
    if (done.trim() === "") return;
    setBusyCode(code);
    try {
      const updated = await api.addTrackerUpdate(code, done.trim(), next && next.trim() !== "" ? next.trim() : null, status);
      setDetail(updated);
      refreshList(updated);
      toast.show("Historique mis à jour.", "success");
    } catch (e: any) {
      toast.show(e instanceof AdminApiError ? e.message : "Impossible d'ajouter la mise à jour.", "error");
    } finally {
      setBusyCode(null);
    }
  };

  const remove = async (code: string) => {
    setBusyCode(code);
    try {
      await api.deleteTrackerItem(code);
      setItems((prev) => (prev ? prev.filter((x) => x.code !== code) : prev));
      if (selectedCode === code) closeDetail();
      toast.show("Élément supprimé.", "success");
    } catch (e: any) {
      toast.show(e instanceof AdminApiError ? e.message : "Suppression impossible.", "error");
    } finally {
      setBusyCode(null);
    }
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
      <View style={styles.container}>
        <Breadcrumbs
          items={[
            { icon: "home-outline", onPress: () => navigation.dispatch(CommonActions.reset({ index: 0, routes: [{ name: "Home" }] })) },
            { label: "Profil", onPress: () => navigation.navigate("Profile") },
            { label: "Suivi bugs/fonctionnalités" },
          ]}
        />
        <Text style={styles.title}>Suivi bugs / fonctionnalités / dette technique</Text>
        <Text style={styles.subtitle}>
          Source de vérité pour la progression — les fichiers markdown (BUGLOG.md, ROADMAP.md, DEV_STATUS.md) restent
          réservés à la transmission d'informations entre développeurs.
        </Text>

        {error && (
          <View style={styles.errorBox}>
            <Text style={styles.errorText}>{error}</Text>
          </View>
        )}

        <CollapsibleSection
          title="Filtres et recherche"
          summary={filterSummary(statusFilter, typeFilter, priorityFilter, search, items?.length ?? null)}
          defaultExpanded={false}
        >
          <View style={styles.searchRow}>
            <TextInput
              style={styles.searchInput}
              value={searchInput}
              onChangeText={setSearchInput}
              placeholder="Rechercher (code, titre, description, commentaires)…"
              placeholderTextColor={colors.contentTertiary}
              accessibilityLabel="Rechercher dans le suivi"
            />
            {searchInput !== "" && (
              <Pressable onPress={() => setSearchInput("")} accessibilityRole="button" accessibilityLabel="Effacer la recherche">
                <Text style={styles.clearSearchText}>Effacer</Text>
              </Pressable>
            )}
          </View>
          <MultiSelectFilter
            label="Statut"
            selected={statusFilter}
            options={ALL_STATUSES.map((s) => ({ value: s, label: STATUS_LABELS[s] }))}
            onChange={setStatusFilter}
          />
          <MultiSelectFilter
            label="Type"
            selected={typeFilter}
            options={ALL_TYPES.map((t) => ({ value: t, label: TYPE_LABELS[t] }))}
            onChange={setTypeFilter}
          />
          <MultiSelectFilter
            label="Priorité"
            selected={priorityFilter}
            options={ALL_PRIORITIES.map((p) => ({ value: p, label: PRIORITY_LABELS[p] }))}
            onChange={setPriorityFilter}
          />
          <Pressable
            onPress={() => {
              setStatusFilter(DEFAULT_STATUS_FILTER);
              setTypeFilter([]);
              setPriorityFilter([]);
              setSearchInput("");
            }}
            accessibilityRole="button"
          >
            <Text style={styles.resetLink}>Réinitialiser (tout sauf fermé)</Text>
          </Pressable>
        </CollapsibleSection>

        {items === null && !error && <ActivityIndicator style={{ marginTop: 40 }} />}

        {items !== null && (
          <View style={styles.contentRow}>
            <ScrollView style={styles.listCol}>
              {items.length === 0 && <Text style={styles.emptyText}>Aucun élément pour ces filtres.</Text>}
              {items.map((it) => (
                <Pressable
                  key={it.code}
                  style={[styles.listCard, selectedCode === it.code && styles.listCardActive]}
                  onPress={() => openDetail(it.code)}
                >
                  <View style={styles.listCardHeaderRow}>
                    <Text style={styles.listCardCode}>{it.code}</Text>
                    <View style={styles.pillsRow}>
                      <Pill text={TYPE_LABELS[it.type]} tone="neutral" />
                      {it.priority && <Pill text={PRIORITY_LABELS[it.priority]} tone={priorityTone(it.priority)} />}
                      <Pill text={STATUS_LABELS[it.status]} tone={statusTone(it.status)} />
                    </View>
                  </View>
                  <Text style={styles.listCardTitle} numberOfLines={2}>{it.title}</Text>
                </Pressable>
              ))}
              <CreateItemCard
                creating={creating}
                setCreating={setCreating}
                onCreate={async (fields) => {
                  try {
                    const created = await api.createTrackerItem(fields);
                    refreshList(created);
                    setCreating(false);
                    toast.show(`${created.code} créé.`, "success");
                  } catch (e: any) {
                    toast.show(e instanceof AdminApiError ? e.message : "Création impossible.", "error");
                  }
                }}
                suggestCode={(prefix) => api.suggestNextTrackerCode(prefix)}
              />
            </ScrollView>

            <View style={styles.detailCol}>
              {selectedCode === null && (
                <View style={styles.detailPlaceholder}>
                  <Text style={styles.emptyText}>Sélectionnez un élément pour voir son détail.</Text>
                </View>
              )}
              {selectedCode !== null && detailLoading && <ActivityIndicator style={{ marginTop: 40 }} />}
              {selectedCode !== null && !detailLoading && detail && (
                <DetailPanel
                  key={detail.code}
                  item={detail}
                  busy={busyCode === detail.code}
                  onSave={(fields) => saveField(detail.code, fields)}
                  onLogUpdate={(done, next, status) => logUpdate(detail.code, done, next, status)}
                  onDelete={() => remove(detail.code)}
                  onClose={closeDetail}
                />
              )}
            </View>
          </View>
        )}
      </View>
    </ResponsiveContainer>
  );
}

function statusTone(status: TrackerItem["status"]): PillTone {
  switch (status) {
    case "open": return "info";
    case "in_progress": return "warning";
    case "fixed_unverified": return "warning";
    case "verified": return "success";
    case "closed": return "neutral";
  }
}
function priorityTone(priority: NonNullable<TrackerItem["priority"]>): PillTone {
  switch (priority) {
    case "p0": return "error";
    case "p1": return "warning";
    case "p2": return "info";
    case "p3": return "neutral";
  }
}

type PillTone = "neutral" | "info" | "warning" | "success" | "error";
function Pill({ text, tone }: { text: string; tone: PillTone }) {
  const toneStyles: Record<PillTone, { bg: string; fg: string }> = {
    neutral: { bg: colors.surfaceSunken, fg: colors.contentSecondary },
    info: { bg: colors.infoSurface, fg: colors.info },
    warning: { bg: colors.warningSurface, fg: colors.warning },
    success: { bg: colors.successSurface, fg: colors.success },
    error: { bg: colors.errorSurface, fg: colors.error },
  };
  const t = toneStyles[tone];
  return (
    <View style={[styles.pill, { backgroundColor: t.bg }]}>
      <Text style={[styles.pillText, { color: t.fg }]}>{text}</Text>
    </View>
  );
}

/** Detail view: read fields, an editable status/priority picker pair,
 * a "log an update" form (done/next/optional status — the primary way
 * progress gets recorded per migration 004's own design), and delete. */
function DetailPanel({
  item, busy, onSave, onLogUpdate, onDelete, onClose,
}: {
  item: TrackerItem;
  busy: boolean;
  onSave: (fields: { status?: TrackerItem["status"]; priority?: TrackerItem["priority"] }) => void;
  onLogUpdate: (done: string, next: string | null, status?: TrackerItem["status"]) => void;
  onDelete: () => void;
  onClose: () => void;
}) {
  const [done, setDone] = useState("");
  const [next, setNext] = useState("");
  const [logStatus, setLogStatus] = useState<TrackerItem["status"] | "">("");
  const [confirmDelete, setConfirmDelete] = useState(false);

  return (
    <ScrollView style={styles.detailScroll}>
      <View style={styles.detailHeaderRow}>
        <Text style={styles.detailCode}>{item.code}</Text>
        <Pressable onPress={onClose} accessibilityRole="button">
          <Text style={styles.closeLink}>Fermer</Text>
        </Pressable>
      </View>
      <Text style={styles.detailTitle}>{item.title}</Text>

      {item.screen && (
        <Field label="Origine (annotation in-app)">
          <Text style={styles.fieldValue}>
            Écran : {item.screen}
            {item.elementRef ? ` · Élément : ${item.elementRef}` : ""}
            {"\n"}Position : ({item.x ?? "?"}, {item.y ?? "?"}){item.appVersion ? ` · v${item.appVersion}` : ""}
          </Text>
        </Field>
      )}

      {item.userDescription && (
        <Field label="Description utilisateur">
          <Text style={styles.fieldValue}>{item.userDescription}</Text>
        </Field>
      )}
      {item.technicalDescription && (
        <Field label="Description technique">
          <Text style={styles.fieldValue}>{item.technicalDescription}</Text>
        </Field>
      )}
      {item.dependencies && (
        <Field label="Dépendances">
          <Text style={styles.fieldValue}>{item.dependencies}</Text>
        </Field>
      )}
      {item.testsToDo && (
        <Field label="Tests à faire">
          <Text style={styles.fieldValue}>{item.testsToDo}</Text>
        </Field>
      )}
      {item.comments && (
        <Field label="Commentaires (TODO courant)">
          <Text style={styles.fieldValue}>{item.comments}</Text>
        </Field>
      )}

      <SegmentedPicker
        label="Statut"
        value={item.status}
        options={(Object.keys(STATUS_LABELS) as TrackerItem["status"][]).map((s) => ({ value: s, label: STATUS_LABELS[s] }))}
        onChange={(v) => onSave({ status: v as TrackerItem["status"] })}
      />
      <SegmentedPicker
        label="Priorité"
        value={item.priority ?? undefined}
        options={(Object.keys(PRIORITY_LABELS) as NonNullable<TrackerItem["priority"]>[]).map((p) => ({ value: p, label: PRIORITY_LABELS[p] }))}
        onChange={(v) => onSave({ priority: v as TrackerItem["priority"] })}
      />

      <Text style={styles.historyHeading}>Historique</Text>
      {(item.updates ?? []).length === 0 && <Text style={styles.emptyText}>Aucune mise à jour enregistrée.</Text>}
      {(item.updates ?? []).map((u) => (
        <View key={u.id} style={styles.historyRow}>
          <Text style={styles.historyDate}>{u.createdAt}</Text>
          <Text style={styles.historyDone}>{u.done}</Text>
          {u.next && <Text style={styles.historyNext}>Suite : {u.next}</Text>}
        </View>
      ))}

      <View style={styles.logCard}>
        <Text style={styles.cardHeading}>Ajouter une mise à jour</Text>
        <TextInput
          style={styles.textArea}
          value={done}
          onChangeText={setDone}
          placeholder="Fait (obligatoire)"
          placeholderTextColor={colors.contentTertiary}
          multiline
        />
        <TextInput
          style={styles.textArea}
          value={next}
          onChangeText={setNext}
          placeholder="Suite (optionnel)"
          placeholderTextColor={colors.contentTertiary}
          multiline
        />
        <SegmentedPicker
          label="Changer le statut en même temps (optionnel)"
          value={logStatus === "" ? undefined : logStatus}
          options={(Object.keys(STATUS_LABELS) as TrackerItem["status"][]).map((s) => ({ value: s, label: STATUS_LABELS[s] }))}
          onChange={(v) => setLogStatus(v as TrackerItem["status"])}
        />
        <Pressable
          style={({ pressed }) => [styles.primaryButton, pressed && styles.buttonPressed, (busy || done.trim() === "") && styles.buttonDisabled]}
          disabled={busy || done.trim() === ""}
          onPress={() => {
            onLogUpdate(done, next, logStatus === "" ? undefined : logStatus);
            setDone("");
            setNext("");
            setLogStatus("");
          }}
          accessibilityRole="button"
        >
          {busy ? <ActivityIndicator size="small" color={colors.contentInverse} /> : <Text style={styles.primaryButtonText}>Enregistrer la mise à jour</Text>}
        </Pressable>
      </View>

      <Pressable
        style={({ pressed }) => [styles.dangerButton, confirmDelete && styles.dangerButtonArmed, pressed && styles.buttonPressed]}
        onPress={() => {
          if (confirmDelete) { onDelete(); setConfirmDelete(false); }
          else setConfirmDelete(true);
        }}
        accessibilityRole="button"
      >
        <Text style={[styles.dangerButtonText, confirmDelete && styles.dangerButtonTextArmed]}>
          {confirmDelete ? "Confirmer la suppression ?" : "Supprimer"}
        </Text>
      </Pressable>
    </ScrollView>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <View style={styles.field}>
      <Text style={styles.fieldLabel}>{label}</Text>
      {children}
    </View>
  );
}

/** Inline create form — code is suggested (editable) via
 * suggestNextTrackerCode, type is a picker (immutable once created,
 * per trackerRepo.php's own rule), title is required. */
function CreateItemCard({
  creating, setCreating, onCreate, suggestCode,
}: {
  creating: boolean;
  setCreating: (v: boolean) => void;
  onCreate: (fields: { code: string; type: TrackerItem["type"]; title: string; priority?: TrackerItem["priority"] }) => void;
  suggestCode: (prefix: string) => Promise<{ code: string }>;
}) {
  const [type, setType] = useState<TrackerItem["type"]>("bug");
  const [code, setCode] = useState("");
  const [title, setTitle] = useState("");
  const [priority, setPriority] = useState<NonNullable<TrackerItem["priority"]> | "">("");
  const [suggesting, setSuggesting] = useState(false);

  const prefixFor = (t: TrackerItem["type"]) => (t === "bug" ? "BUG" : t === "feature" ? "FEAT" : t === "techdebt" ? "DEBT" : "ITEM");

  if (!creating) {
    return (
      <Pressable style={({ pressed }) => [styles.secondaryButton, pressed && styles.buttonPressed, { marginTop: spacing.sm }]} onPress={() => setCreating(true)} accessibilityRole="button">
        <Text style={styles.secondaryButtonText}>+ Nouvel élément</Text>
      </Pressable>
    );
  }

  return (
    <View style={styles.logCard}>
      <Text style={styles.cardHeading}>Nouvel élément</Text>
      <SegmentedPicker
        label="Type"
        value={type}
        options={(Object.keys(TYPE_LABELS) as TrackerItem["type"][]).map((t) => ({ value: t, label: TYPE_LABELS[t] }))}
        onChange={(v) => setType(v as TrackerItem["type"])}
      />
      <View style={styles.codeRow}>
        <TextInput
          style={[styles.textInput, { flex: 1 }]}
          value={code}
          onChangeText={setCode}
          placeholder={`ex. ${prefixFor(type)}-053`}
          placeholderTextColor={colors.contentTertiary}
          autoCapitalize="characters"
        />
        <Pressable
          style={({ pressed }) => [styles.secondaryButton, pressed && styles.buttonPressed]}
          disabled={suggesting}
          onPress={async () => {
            setSuggesting(true);
            try {
              const { code: suggested } = await suggestCode(prefixFor(type));
              setCode(suggested);
            } finally {
              setSuggesting(false);
            }
          }}
          accessibilityRole="button"
        >
          {suggesting ? <ActivityIndicator size="small" /> : <Text style={styles.secondaryButtonText}>Suggérer</Text>}
        </Pressable>
      </View>
      <TextInput
        style={styles.textInput}
        value={title}
        onChangeText={setTitle}
        placeholder="Titre"
        placeholderTextColor={colors.contentTertiary}
      />
      <SegmentedPicker
        label="Priorité (optionnel)"
        value={priority === "" ? undefined : priority}
        options={[
          { value: "p0", label: "P0" }, { value: "p1", label: "P1" }, { value: "p2", label: "P2" }, { value: "p3", label: "P3" },
        ]}
        onChange={(v) => setPriority(v as NonNullable<TrackerItem["priority"]>)}
      />
      <View style={styles.cardActionsRow}>
        <Pressable
          style={({ pressed }) => [styles.primaryButton, pressed && styles.buttonPressed, (code.trim() === "" || title.trim() === "") && styles.buttonDisabled]}
          disabled={code.trim() === "" || title.trim() === ""}
          onPress={() => onCreate({ code: code.trim(), type, title: title.trim(), priority: priority === "" ? undefined : priority })}
          accessibilityRole="button"
        >
          <Text style={styles.primaryButtonText}>Créer</Text>
        </Pressable>
        <Pressable style={({ pressed }) => [styles.secondaryButton, pressed && styles.buttonPressed]} onPress={() => setCreating(false)} accessibilityRole="button">
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
  searchRow: { flexDirection: "row", alignItems: "center", gap: spacing.sm, marginBottom: spacing.md + 2 },
  searchInput: { flex: 1, borderWidth: 1, borderColor: colors.borderDefault, borderRadius: radius.md, paddingHorizontal: spacing.sm + 2, paddingVertical: spacing.sm + 2, fontSize: typography.subtitle, backgroundColor: colors.surfaceBase },
  clearSearchText: { color: colors.link, fontSize: typography.small, fontWeight: "600" },
  resetLink: { color: colors.link, fontSize: typography.small, fontWeight: "600", marginTop: spacing.xs },
  contentRow: { flexDirection: "row", gap: spacing.lg, flex: 1, minHeight: 400 },
  listCol: { flex: 1, maxWidth: 460 },
  detailCol: { flex: 1.3 },
  listCard: {
    backgroundColor: colors.surfaceRaised,
    borderRadius: radius.xl,
    borderWidth: 1,
    borderColor: colors.borderDefault,
    padding: spacing.md,
    marginBottom: spacing.sm,
  },
  listCardActive: { borderColor: colors.actionPrimary },
  listCardHeaderRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginBottom: spacing.xs },
  listCardCode: { fontSize: typography.small, fontWeight: "700", color: colors.contentTertiary },
  listCardTitle: { fontSize: typography.bodyLarge, color: colors.contentPrimary },
  pillsRow: { flexDirection: "row", gap: spacing.xs, flexWrap: "wrap" },
  pill: { borderRadius: radius.pill, paddingVertical: 2, paddingHorizontal: spacing.sm },
  pillText: { fontSize: typography.caption, fontWeight: "700" },
  detailPlaceholder: { padding: spacing.xl, alignItems: "center" },
  detailScroll: {
    backgroundColor: colors.surfaceRaised,
    borderRadius: radius.xl,
    borderWidth: 1,
    borderColor: colors.borderDefault,
    padding: spacing.lg,
  },
  detailHeaderRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: spacing.xs },
  detailCode: { fontSize: typography.subtitle, fontWeight: "700", color: colors.contentTertiary },
  closeLink: { fontSize: typography.body, color: colors.link },
  detailTitle: { fontSize: typography.heading, fontWeight: "700", color: colors.contentPrimary, marginBottom: spacing.md },
  field: { marginBottom: spacing.md },
  fieldLabel: { fontSize: typography.small, color: colors.contentTertiary, marginBottom: spacing.xs, fontWeight: "600" },
  fieldValue: { fontSize: typography.body, color: colors.contentSecondary },
  historyHeading: { fontSize: typography.subtitle, fontWeight: "700", color: colors.contentPrimary, marginTop: spacing.md, marginBottom: spacing.sm },
  historyRow: { borderLeftWidth: 2, borderLeftColor: colors.borderDefault, paddingLeft: spacing.md, marginBottom: spacing.md },
  historyDate: { fontSize: typography.caption, color: colors.contentQuaternary, marginBottom: 2 },
  historyDone: { fontSize: typography.body, color: colors.contentSecondary },
  historyNext: { fontSize: typography.small, color: colors.contentTertiary, marginTop: 2, fontStyle: "italic" },
  logCard: { backgroundColor: colors.surfaceSunken, borderRadius: radius.lg, padding: spacing.md, marginTop: spacing.md },
  cardHeading: { fontSize: typography.subtitle, fontWeight: "700", color: colors.contentPrimary, marginBottom: spacing.sm },
  textArea: {
    borderWidth: 1, borderColor: colors.borderDefault, borderRadius: radius.md, padding: spacing.sm,
    fontSize: typography.body, color: colors.contentPrimary, backgroundColor: colors.surfaceBase, marginBottom: spacing.sm, minHeight: 44,
  },
  textInput: {
    borderWidth: 1, borderColor: colors.borderDefault, borderRadius: radius.md, padding: spacing.sm,
    fontSize: typography.body, color: colors.contentPrimary, backgroundColor: colors.surfaceBase, marginBottom: spacing.sm,
  },
  codeRow: { flexDirection: "row", gap: spacing.sm, alignItems: "flex-start" },
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
  dangerButton: {
    borderRadius: radius.lg, paddingVertical: 10, paddingHorizontal: spacing.lg, borderWidth: 1,
    borderColor: colors.error, alignItems: "center", justifyContent: "center", marginTop: spacing.lg,
  },
  dangerButtonArmed: { backgroundColor: colors.error },
  dangerButtonText: { color: colors.error, fontSize: typography.body, fontWeight: "700" },
  dangerButtonTextArmed: { color: colors.contentInverse },
});
