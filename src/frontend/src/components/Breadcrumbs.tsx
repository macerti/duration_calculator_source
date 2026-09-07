import React from "react";
import { View, Text, Pressable, StyleSheet } from "react-native";
import Ionicons from "@expo/vector-icons/Ionicons";
import { colors, spacing, typography } from "../theme/tokens";

export interface Crumb {
  // Exactly one of `label` / `icon` should be set. `icon` renders the
  // shared Ionicons "home" glyph instead of text — this is the single
  // treatment for the "Accueil" crumb across every screen (BUG-025 #2:
  // previously some screens rendered "Accueil" as plain text while the
  // calculation wizard rendered a separate icon-only button outside the
  // breadcrumb entirely; both are now the same crumb type).
  label?: string;
  icon?: keyof typeof Ionicons.glyphMap;
  onPress?: () => void; // omit for the current/last crumb
}

/**
 * BUG-050 #2/#3: with every screen's native-stack header now hidden (see
 * App.tsx), this row is the *only* navigation chrome on any given screen —
 * so it also carries the one persistent, app-wide entry point into
 * ProfileScreen via `onProfilePress`, right-aligned via `marginLeft: auto`
 * on its own wrapper so it doesn't disturb the existing crumb-trail layout
 * or spacing. Omit the prop on ProfileScreen itself (no point linking to
 * the screen you're already on) — every other screen passes it.
 */
export default function Breadcrumbs({ items, onProfilePress }: { items: Crumb[]; onProfilePress?: () => void }) {
  return (
    <View style={styles.row}>
      {items.map((item, i) => {
        const content = item.icon ? (
          <Ionicons name={item.icon} size={18} color={item.onPress ? colors.link : colors.contentPrimary} />
        ) : (
          <Text style={item.onPress ? styles.link : styles.current}>{item.label}</Text>
        );
        return (
          <View key={i} style={styles.item}>
            {item.onPress ? (
              <Pressable onPress={item.onPress} hitSlop={8}>
                {content}
              </Pressable>
            ) : (
              content
            )}
            {i < items.length - 1 && <Text style={styles.sep}>›</Text>}
          </View>
        );
      })}
      {onProfilePress && (
        <Pressable
          onPress={onProfilePress}
          hitSlop={8}
          style={styles.profileButton}
          accessibilityRole="button"
          accessibilityLabel="Mon profil"
          testID="breadcrumbs-profile-button"
        >
          <Ionicons name="person-circle-outline" size={22} color={colors.contentSecondary} />
        </Pressable>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: "row", flexWrap: "wrap", alignItems: "center", paddingVertical: spacing.sm },
  item: { flexDirection: "row", alignItems: "center" },
  link: { color: colors.link, fontSize: typography.body },
  current: { color: colors.contentTertiary, fontSize: typography.body, fontWeight: "600" },
  sep: { color: colors.borderDefault, fontSize: typography.body, marginHorizontal: 6 },
  profileButton: { marginLeft: "auto", paddingLeft: spacing.sm },
});
