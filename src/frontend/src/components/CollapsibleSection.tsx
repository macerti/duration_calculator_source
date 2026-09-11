import React, { useState } from "react";
import { View, Text, Pressable, StyleSheet } from "react-native";
import Ionicons from "@expo/vector-icons/Ionicons";
import { colors, radius, spacing, typography } from "../theme/tokens";

interface Props {
  title: string;
  /** Short status line shown next to the title whether expanded or
   * collapsed — e.g. "3 filtres actifs · 12 résultats" — so collapsing
   * the section to save space doesn't hide *that* something is filtered,
   * only the controls used to change it. */
  summary?: string;
  /** Uncontrolled initial state — this component owns its own expanded/
   * collapsed state after that, matching every other lightweight toggle
   * in this codebase (no controlled-component form exists here since no
   * caller needs to force it open/closed from outside). */
  defaultExpanded?: boolean;
  children: React.ReactNode;
}

/**
 * Generic collapsible container — built 2026-09-10 for
 * AdminTrackerScreen.tsx's filters/search panel (Mahdi's request for both
 * to be collapsible), but deliberately generic (no tracker-specific
 * naming/props) so any future screen needing the same "tap a header to
 * show/hide a block of controls" pattern can reuse it instead of writing
 * its own — checked `src/frontend/src/components/` first, nothing like
 * this existed yet.
 */
export default function CollapsibleSection({ title, summary, defaultExpanded = false, children }: Props) {
  const [expanded, setExpanded] = useState(defaultExpanded);
  return (
    <View style={styles.wrap}>
      <Pressable
        style={styles.header}
        onPress={() => setExpanded((e) => !e)}
        accessibilityRole="button"
        accessibilityState={{ expanded }}
      >
        <View style={styles.headerText}>
          <Text style={styles.title}>{title}</Text>
          {summary ? <Text style={styles.summary}>{summary}</Text> : null}
        </View>
        <Ionicons name={expanded ? "chevron-up" : "chevron-down"} size={20} color={colors.contentSecondary} />
      </Pressable>
      {expanded && <View style={styles.body}>{children}</View>}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    borderWidth: 1,
    borderColor: colors.borderDefault,
    borderRadius: radius.lg,
    backgroundColor: colors.surfaceRaised,
    marginBottom: spacing.md + 2,
    overflow: "hidden",
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.lg,
  },
  headerText: { flex: 1, marginRight: spacing.sm },
  title: { fontSize: typography.subtitle, fontWeight: "600", color: colors.contentPrimary },
  summary: { fontSize: typography.small, color: colors.contentTertiary, marginTop: 2 },
  body: {
    paddingHorizontal: spacing.lg,
    paddingBottom: spacing.lg,
    borderTopWidth: 1,
    borderTopColor: colors.borderSubtle,
    paddingTop: spacing.md,
  },
});
