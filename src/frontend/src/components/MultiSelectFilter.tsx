import React from "react";
import { View, Text, Pressable, StyleSheet } from "react-native";
import Ionicons from "@expo/vector-icons/Ionicons";
import { colors, radius, spacing, typography } from "../theme/tokens";

interface Props<T extends string> {
  label: string;
  options: { value: T; label: string }[];
  /** Every currently-checked value — unlike SegmentedPicker's `value`
   * (exactly one), any number of options can be active at once, including
   * zero (meaning "no filter on this field" everywhere this is used —
   * see AdminTrackerScreen.tsx's listTrackerItems() call) or all of them. */
  selected: T[];
  onChange: (selected: T[]) => void;
}

/**
 * Multiselect chip group — built 2026-09-10 for AdminTrackerScreen.tsx's
 * filter rework (Mahdi's request: status/type/priority filters should let
 * an admin check several values at once, e.g. "everything that isn't
 * closed" as several statuses checked together, instead of exactly one
 * via the old SegmentedPicker). Deliberately generic (no tracker-specific
 * typing) so it can be reused wherever a fixed-choice, more-than-one-
 * allowed filter is needed next — checked `src/frontend/src/components/`
 * first, nothing like this existed yet; `SegmentedPicker.tsx` is the
 * nearest precedent (single-select) and this mirrors its visual style
 * deliberately rather than introducing a new pill style for one screen.
 */
export default function MultiSelectFilter<T extends string>({ label, options, selected, onChange }: Props<T>) {
  const toggle = (value: T) => {
    onChange(selected.includes(value) ? selected.filter((v) => v !== value) : [...selected, value]);
  };
  return (
    <View style={styles.wrap}>
      {label !== "" && <Text style={styles.label}>{label}</Text>}
      <View style={styles.row}>
        {options.map((opt) => {
          const active = selected.includes(opt.value);
          return (
            <Pressable
              key={opt.value}
              style={[styles.chip, active && styles.chipActive]}
              onPress={() => toggle(opt.value)}
              accessibilityRole="checkbox"
              accessibilityState={{ checked: active }}
            >
              {active && <Ionicons name="checkmark" size={14} color={colors.contentInverse} style={styles.checkIcon} />}
              <Text style={[styles.chipText, active && styles.chipTextActive]}>{opt.label}</Text>
            </Pressable>
          );
        })}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { marginBottom: spacing.md + 2 },
  label: { fontSize: typography.body, color: colors.contentSecondary, marginBottom: spacing.sm },
  row: { flexDirection: "row", flexWrap: "wrap", gap: spacing.sm },
  chip: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.md,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.borderDefault,
    backgroundColor: colors.surfaceBase,
  },
  chipActive: { backgroundColor: colors.actionPrimary, borderColor: colors.actionPrimary },
  checkIcon: { marginRight: 4 },
  chipText: { fontSize: typography.body, color: colors.contentSecondary },
  chipTextActive: { color: colors.contentInverse, fontWeight: "600" },
});
