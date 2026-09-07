import React from "react";
import { View, Text, Pressable, StyleSheet } from "react-native";
import { colors, radius, spacing, typography } from "../theme/tokens";

interface Props {
  children: React.ReactNode;
  onGoHome?: () => void;
}

interface State {
  error: Error | null;
}

/**
 * A render crash anywhere below this boundary used to mean a totally blank
 * white page with zero indication anything had gone wrong — that's what
 * happened reopening a calculation saved before the report-writing-per-visit
 * engine change, since old saved JSON lacks fields the UI now reads
 * unconditionally (see BUGLOG). Defensive fallbacks fix that specific case,
 * but this boundary is the general safety net: whatever crashes next, the
 * person sees an actual message and a way back, not a dead screen.
 */
export default class ErrorBoundary extends React.Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = { error: null };
  }

  static getDerivedStateFromError(error: Error): State {
    return { error };
  }

  componentDidCatch(error: Error, info: React.ErrorInfo) {
    // eslint-disable-next-line no-console
    console.error("Render error caught by ErrorBoundary:", error, info);
  }

  render() {
    if (this.state.error) {
      return (
        <View style={styles.container}>
          <Text style={styles.title}>Un problème est survenu</Text>
          <Text style={styles.body}>
            Cet écran n'a pas pu s'afficher correctement. Si cela concerne un calcul enregistré avant une mise à
            jour récente, les anciennes données ne correspondent peut-être plus exactement au nouveau format
            d'affichage.
          </Text>
          <Text style={styles.detail}>{this.state.error.message}</Text>
          {this.props.onGoHome && (
            <Pressable style={styles.button} onPress={() => { this.setState({ error: null }); this.props.onGoHome?.(); }}>
              <Text style={styles.buttonText}>Retour à l'accueil</Text>
            </Pressable>
          )}
        </View>
      );
    }
    return this.props.children;
  }
}

const styles = StyleSheet.create({
  container: { flex: 1, alignItems: "center", justifyContent: "center", padding: spacing.xxl, backgroundColor: colors.surfaceBase },
  title: { fontSize: typography.heading, fontWeight: "700", color: colors.error, marginBottom: spacing.sm + 2, textAlign: "center" },
  body: { fontSize: typography.bodyLarge, color: colors.contentSecondary, textAlign: "center", lineHeight: 20, marginBottom: spacing.md },
  detail: { fontSize: typography.caption, color: colors.contentQuaternary, textAlign: "center", marginBottom: spacing.xl, fontFamily: "monospace" },
  button: { backgroundColor: colors.actionPrimary, borderRadius: radius.lg, paddingVertical: spacing.md, paddingHorizontal: spacing.xxl },
  buttonText: { color: colors.actionPrimaryText, fontWeight: "700", fontSize: typography.bodyLarge },
});
