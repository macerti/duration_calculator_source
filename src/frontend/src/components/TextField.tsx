import React, { useState } from "react";
import { View, Text, TextInput, Pressable, StyleSheet, TextInputProps } from "react-native";
import Ionicons from "@expo/vector-icons/Ionicons";
import { colors, radius, spacing, typography } from "../theme/tokens";

interface Props {
  label: string;
  value: string;
  onChangeText: (v: string) => void;
  placeholder?: string;
  /** Masks input — for passwords. Defaults to false (unchanged prior behavior).
   * BUG-047 #1: whenever this is true, a show/hide eye toggle is rendered —
   * every password field in the app gets it from this one change, no
   * per-screen wiring needed. */
  secureTextEntry?: boolean;
  /** Defaults to "sentences", matching every pre-existing caller. Auth
   * screens pass "none" for email fields so "Info@Macerti.com" isn't
   * auto-capitalized into something that fails a case-sensitive compare
   * before this component even existed to prevent it. */
  autoCapitalize?: TextInputProps["autoCapitalize"];
  /** Defaults to "default", matching every pre-existing caller. */
  keyboardType?: TextInputProps["keyboardType"];
  /** Browser/OS autofill hint (e.g. "email", "password", "new-password",
   * "name") — optional, no effect on native behavior when omitted. */
  autoComplete?: TextInputProps["autoComplete"];
  /** Inline validation/server error shown under the field in errorSurface
   * red, same visual language as LoginScreen's banner. Optional — omitting
   * it renders exactly as before. */
  error?: string | null;
  /** BUG-047 #4: fired when the field loses focus, so a caller can run
   * per-field validation as each field is finished instead of only at
   * submit time. Optional — omitting it renders exactly as before. */
  onBlur?: () => void;
}

/**
 * Plain-text input for genuinely textual business-information fields
 * (names, addresses, references) — as opposed to `NumberField`, which
 * forces `keyboardType="numeric"` and is meant for calculation inputs.
 *
 * BUG-026: the Siège name/address fields were previously built with
 * `NumberField`, which put mobile devices into a numeric-only keyboard and
 * prevented normal text entry (letters, spaces, punctuation, accents) for
 * fields that must accept ordinary company names and postal addresses.
 *
 * Extended for the local-accounts/RBAC frontend (2026-09-05) with optional
 * secureTextEntry/autoCapitalize/keyboardType/autoComplete/error props so
 * Register/Login/Profile/ResetPassword reuse this component instead of a
 * parallel one-off input — every new prop defaults to this file's prior
 * hard-coded behavior, so no existing caller's rendering changes.
 */
export default function TextField({
  label,
  value,
  onChangeText,
  placeholder,
  secureTextEntry,
  autoCapitalize,
  keyboardType,
  autoComplete,
  error,
  onBlur,
}: Props) {
  const [revealed, setRevealed] = useState(false);
  const isPasswordField = !!secureTextEntry;

  return (
    <View style={styles.row}>
      <Text style={styles.label}>{label}</Text>
      <View style={[styles.inputWrap, error ? styles.inputWrapError : null]}>
        <TextInput
          style={styles.input}
          value={value}
          onChangeText={onChangeText}
          onBlur={onBlur}
          keyboardType={keyboardType ?? "default"}
          autoCapitalize={autoCapitalize ?? "sentences"}
          secureTextEntry={isPasswordField && !revealed}
          autoComplete={autoComplete}
          placeholder={placeholder}
          placeholderTextColor={colors.contentQuaternary}
        />
        {isPasswordField ? (
          <Pressable
            onPress={() => setRevealed((r) => !r)}
            accessibilityRole="button"
            accessibilityLabel={revealed ? "Masquer le mot de passe" : "Afficher le mot de passe"}
            hitSlop={8}
            style={styles.revealBtn}
          >
            <Ionicons
              name={revealed ? "eye-off-outline" : "eye-outline"}
              size={20}
              color={colors.contentQuaternary}
            />
          </Pressable>
        ) : null}
      </View>
      {error ? <Text style={styles.errorText}>{error}</Text> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  row: { marginBottom: spacing.md },
  label: { fontSize: typography.body, color: colors.contentSecondary, marginBottom: spacing.xs },
  inputWrap: { flexDirection: "row", alignItems: "center", borderWidth: 1, borderColor: colors.borderDefault, borderRadius: radius.md, paddingHorizontal: spacing.sm + 2 },
  inputWrapError: { borderColor: colors.error },
  input: { flex: 1, paddingVertical: spacing.sm + 2, fontSize: typography.subtitle },
  revealBtn: { paddingLeft: spacing.xs, paddingVertical: spacing.xs },
  errorText: { color: colors.error, fontSize: typography.small, marginTop: spacing.xs },
});
