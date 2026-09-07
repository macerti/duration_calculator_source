import React, { useState, useEffect, useRef } from "react";
import { View, Text, TextInput, Pressable, StyleSheet, ActivityIndicator, FlatList } from "react-native";
import { api } from "../api/client";
import { NaceRiskEntry } from "../types/engine";
import { colors, radius, spacing, typography } from "../theme/tokens";

interface Props {
  value: string; // selected NACE code
  onChange: (code: string, entry?: NaceRiskEntry) => void;
}

const DEBOUNCE_MS = 300;

export default function NaceSearchField({ value, onChange }: Props) {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<NaceRiskEntry[]>([]);
  const [loading, setLoading] = useState(false);
  const [open, setOpen] = useState(false);
  const [selectedLabel, setSelectedLabel] = useState<string | null>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // If a code is already set (e.g. loaded from a saved case), resolve its label once.
  useEffect(() => {
    if (value && !selectedLabel) {
      api
        .getNaceEntry(value)
        .then((entry) => setSelectedLabel(`${entry.codeNace} — ${entry.description}`))
        .catch(() => {
          /* code not found or API unreachable — leave unresolved, field still shows the raw code */
        });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value]);

  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    if (query.trim().length < 2) {
      setResults([]);
      return;
    }
    setLoading(true);
    debounceRef.current = setTimeout(() => {
      api
        .searchNace(query.trim())
        .then((r) => setResults(r.slice(0, 15)))
        .catch(() => setResults([]))
        .finally(() => setLoading(false));
    }, DEBOUNCE_MS);
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, [query]);

  const select = (entry: NaceRiskEntry) => {
    onChange(entry.codeNace, entry);
    setSelectedLabel(`${entry.codeNace} — ${entry.description}`);
    setQuery("");
    setResults([]);
    setOpen(false);
  };

  const clear = () => {
    onChange("");
    setSelectedLabel(null);
    setQuery("");
  };

  return (
    <View style={styles.wrap}>
      <Text style={styles.label}>Secteur (code NACE)</Text>

      {selectedLabel ? (
        <View style={styles.selectedRow}>
          <Text style={styles.selectedText} numberOfLines={2}>
            {selectedLabel}
          </Text>
          <Pressable onPress={clear}>
            <Text style={styles.changeText}>Changer</Text>
          </Pressable>
        </View>
      ) : (
        <>
          <TextInput
            style={styles.input}
            value={query}
            onChangeText={(t) => {
              setQuery(t);
              setOpen(true);
            }}
            placeholder="Rechercher un secteur d'activité..."
            placeholderTextColor={colors.contentQuaternary}
            onFocus={() => setOpen(true)}
          />
          {loading && <ActivityIndicator style={{ marginTop: 6 }} />}
          {open && results.length > 0 && (
            <View style={styles.dropdown}>
              <FlatList
                data={results}
                keyExtractor={(item) => item.codeNace}
                keyboardShouldPersistTaps="handled"
                renderItem={({ item }) => (
                  <Pressable style={styles.resultRow} onPress={() => select(item)}>
                    <Text style={styles.resultCode}>{item.codeNace}</Text>
                    <Text style={styles.resultDesc} numberOfLines={2}>
                      {item.description}
                    </Text>
                  </Pressable>
                )}
              />
            </View>
          )}
          {open && !loading && query.trim().length >= 2 && results.length === 0 && (
            <Text style={styles.noResults}>Aucun secteur trouvé pour "{query}"</Text>
          )}
        </>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { marginBottom: spacing.md },
  label: { fontSize: typography.body, color: colors.contentSecondary, marginBottom: spacing.xs },
  input: { borderWidth: 1, borderColor: colors.borderDefault, borderRadius: radius.md, paddingHorizontal: spacing.sm + 2, paddingVertical: spacing.sm + 2, fontSize: typography.subtitle },
  dropdown: { borderWidth: 1, borderColor: colors.borderDefault, borderRadius: radius.md, marginTop: spacing.xs, maxHeight: 220, backgroundColor: colors.surfaceBase },
  resultRow: { paddingVertical: spacing.sm + 2, paddingHorizontal: spacing.md, borderBottomWidth: 1, borderBottomColor: colors.borderSubtle },
  resultCode: { fontSize: typography.caption, color: colors.contentTertiary, fontWeight: "700" },
  resultDesc: { fontSize: typography.body, color: colors.contentPrimary, marginTop: 2 },
  noResults: { fontSize: typography.small, color: colors.contentQuaternary, marginTop: 6, fontStyle: "italic" },
  selectedRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", borderWidth: 1, borderColor: colors.borderDefault, borderRadius: radius.md, paddingHorizontal: spacing.sm + 2, paddingVertical: spacing.sm + 2, backgroundColor: colors.surfaceSunken },
  selectedText: { fontSize: typography.body, color: colors.contentPrimary, flex: 1, marginRight: spacing.sm },
  changeText: { color: colors.link, fontSize: typography.small, fontWeight: "600" },
});
