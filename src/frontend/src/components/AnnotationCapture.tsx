import React, { useCallback, useEffect, useRef, useState } from "react";
import {
  Platform,
  View,
  Text,
  Modal,
  Pressable,
  TextInput,
  StyleSheet,
  Dimensions,
  ActivityIndicator,
  GestureResponderEvent,
} from "react-native";
import { useAuthContext } from "../context/AuthContext";
import { useAdminApi, AdminApiError } from "../hooks/useAdminApi";
import { useToast } from "./Toast";
import { APP_VERSION } from "../generated/versionInfo";
import { colors, spacing, radius, typography } from "../theme/tokens";

const LONG_PRESS_MS = 500; // matches the platform-default long-press timing already implied elsewhere in this codebase (TouchableOpacity/Pressable's own defaults)
const MOVE_CANCEL_THRESHOLD = 12; // px — a drift past this cancels the timer (a scroll/drag, not a hold in place)
const MENU_WIDTH = 220;

interface CapturedPoint {
  x: number;
  y: number;
  elementRef: string | null;
}

/**
 * AnnotationCapture — FEAT-006 (docs/ROADMAP.md item 10). Wraps the
 * authenticated app so an admin (manage_tracker — see below) can
 * right-click (web) or long-press (native) anywhere to pin a
 * timestamped, app-version-stamped comment. Renders `children` completely
 * unmodified when the current user lacks the permission — no wrapper
 * view, no listeners attached — so a non-admin sees zero behavioral
 * difference, exactly per the spec's acceptance criteria (browser's
 * default context menu untouched on web, no special handling at all on
 * native).
 *
 * Gate changed from `manage_annotations` to `manage_tracker` 2026-09-10
 * (migration 009, annotations/tracker merge) — this now creates a
 * `tracker_items` row directly (see createAnnotationItem() in
 * useAdminApi.ts) rather than a separate `annotations` row, so it's gated
 * by the same permission as the tracker it writes into. Both permissions
 * are only ever granted to `administrateur` today, so nothing loses
 * access — see migration 009's own header comment.
 *
 * Must be rendered inside <AuthProvider> (for useAuthContext). Deliberately
 * NOT rendered inside <Stack.Navigator> itself — it wraps the navigator
 * from the outside so it can capture gestures app-wide — which means it
 * cannot use `useNavigationState`/`useRoute` to know the active screen: a
 * component can only read navigation context from navigators it is
 * NESTED INSIDE, never from one it wraps as a parent (see BUG-048, fixed
 * 2026-09-07 after this caused a total render crash on every authenticated
 * screen — "Couldn't get the navigation state. Is your component inside a
 * navigator?"). `screenName` is passed in as a prop instead, tracked by
 * App.tsx via the NavigationContainer's own ref — see that file's comment.
 */
export default function AnnotationCapture({
  children,
  screenName,
}: {
  children: React.ReactNode;
  screenName: string;
}) {
  const { csrfToken, hasPermission } = useAuthContext();
  const enabled = hasPermission("manage_tracker");
  const api = useAdminApi(csrfToken);
  const toast = useToast();

  const [captured, setCaptured] = useState<CapturedPoint | null>(null);
  const [mode, setMode] = useState<"menu" | "form">("menu");
  const [comment, setComment] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const closeAll = useCallback(() => {
    setCaptured(null);
    setMode("menu");
    setComment("");
  }, []);

  // --- Web: intercept the browser's native contextmenu event. Only ever
  // attached when `enabled` — a non-admin's right-click reaches the real
  // browser menu untouched, and effect cleanup detaches this the instant
  // permission is lost (e.g. an admin role change mid-session).
  useEffect(() => {
    if (!enabled || Platform.OS !== "web" || typeof document === "undefined") return;
    const handler = (e: any) => {
      e.preventDefault();
      setCaptured({ x: e.clientX, y: e.clientY, elementRef: resolveWebElementRef(e.target) });
      setMode("menu");
    };
    document.addEventListener("contextmenu", handler);
    return () => document.removeEventListener("contextmenu", handler);
  }, [enabled]);

  // --- Native: long-press via the plain (non-capture) responder chain.
  // Deliberately `onStartShouldSetResponder`, NOT the `...Capture` variant.
  // Per React Native's own gesture-responder docs, a `Capture` handler
  // that returns true wins the top-down capture phase and prevents every
  // descendant — buttons, ScrollViews, TextInputs — from ever becoming
  // the responder for that touch at all; a root-level `...Capture` long-
  // press listener would silently break every tap in the app the moment
  // it shipped. The plain (bubble-phase) negotiation instead resolves
  // bottom-up: any nested Pressable/TouchableOpacity/ScrollView still
  // wins the negotiation for its own touch first, exactly as it does
  // today, and this wrapper is only ever asked — and only ever fires —
  // for touches that land on otherwise-non-interactive surface (plain
  // background, containers, static text). That is also precisely what
  // produces the "can be pre-empted by a ScrollView actively scrolling,
  // or a nested Pressable already mid-press" limitation already recorded
  // in docs/ROADMAP.md item 10 — a description of this exact mechanism,
  // not a separate caveat layered on top of a different implementation.
  const pressTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const startPoint = useRef<{ x: number; y: number } | null>(null);

  const clearPressTimer = useCallback(() => {
    if (pressTimer.current) {
      clearTimeout(pressTimer.current);
      pressTimer.current = null;
    }
    startPoint.current = null;
  }, []);

  useEffect(() => () => clearPressTimer(), [clearPressTimer]);

  const nativeResponderProps =
    enabled && Platform.OS !== "web"
      ? {
          onStartShouldSetResponder: () => true,
          onResponderTerminationRequest: () => true,
          onResponderGrant: (evt: GestureResponderEvent) => {
            const { pageX, pageY } = evt.nativeEvent;
            startPoint.current = { x: pageX, y: pageY };
            pressTimer.current = setTimeout(() => {
              // Element-reference resolution is deliberately not attempted
              // on native (see docs/ROADMAP.md item 10, "Element-reference
              // strategy") — there's no DOM to walk, and the touch
              // target's native view tag doesn't resolve to a `testID`
              // without extra plumbing this pass doesn't add. Graceful
              // degradation to null, same as an unmatched web click — a
              // screen name plus a position is still a useful annotation.
              setCaptured({ x: pageX, y: pageY, elementRef: null });
              setMode("menu");
            }, LONG_PRESS_MS);
          },
          onResponderMove: (evt: GestureResponderEvent) => {
            if (!startPoint.current) return;
            const { pageX, pageY } = evt.nativeEvent;
            if (Math.abs(pageX - startPoint.current.x) > MOVE_CANCEL_THRESHOLD || Math.abs(pageY - startPoint.current.y) > MOVE_CANCEL_THRESHOLD) {
              clearPressTimer();
            }
          },
          onResponderRelease: clearPressTimer,
          onResponderTerminate: clearPressTimer,
        }
      : {};

  if (!enabled) return <>{children}</>;

  const submit = async () => {
    if (!captured || comment.trim() === "") return;
    setSubmitting(true);
    try {
      // Migration 009 (2026-09-10) — creates a tracker_items row directly
      // (type: "annotation") instead of a separate annotations row. The
      // toast message stays the same ("comment added") since the workflow
      // looks identical to the person pinning it; what a dev sees on the
      // other end (AdminTrackerScreen.tsx, not a separate screen) is what
      // changed.
      await api.createAnnotationItem(screenName, captured.elementRef, captured.x, captured.y, comment.trim(), APP_VERSION);
      toast.show("Commentaire ajouté.", "success");
      closeAll();
    } catch (e: any) {
      toast.show(e instanceof AdminApiError ? e.message : "Impossible d'ajouter le commentaire.", "error");
    } finally {
      setSubmitting(false);
    }
  };

  const winWidth = Dimensions.get("window").width;
  const winHeight = Dimensions.get("window").height;
  const left = captured ? Math.max(spacing.xs, Math.min(captured.x, winWidth - MENU_WIDTH - spacing.md)) : 0;
  const top = captured ? Math.max(spacing.xs, Math.min(captured.y, winHeight - 180)) : 0;

  return (
    <View style={styles.fill} {...nativeResponderProps}>
      {children}
      <Modal transparent visible={!!captured} animationType="fade" onRequestClose={closeAll}>
        <Pressable style={styles.backdrop} onPress={closeAll} accessibilityLabel="Fermer le menu">
          {/* Swallow the backdrop's own responder claim inside the card so tapping the
              form/menu itself doesn't also trigger the backdrop's dismiss-on-press. */}
          <View style={[styles.floating, { left, top }]} onStartShouldSetResponder={() => true}>
            {mode === "menu" ? (
              <Pressable
                style={({ pressed }) => [styles.menuItem, pressed && styles.menuItemPressed]}
                onPress={() => setMode("form")}
                accessibilityRole="menuitem"
              >
                <Text style={styles.menuItemText}>Ajouter un commentaire</Text>
              </Pressable>
            ) : (
              <View style={styles.formCard}>
                <Text style={styles.formLabel}>Commentaire</Text>
                <TextInput
                  style={styles.formInput}
                  value={comment}
                  onChangeText={setComment}
                  multiline
                  numberOfLines={4}
                  autoFocus
                  placeholder="Décrivez le bug ou la suggestion…"
                  placeholderTextColor={colors.contentQuaternary}
                />
                <View style={styles.formActionsRow}>
                  <Pressable
                    style={({ pressed }) => [
                      styles.primaryButton,
                      pressed && styles.buttonPressed,
                      (submitting || comment.trim() === "") && styles.buttonDisabled,
                    ]}
                    onPress={submit}
                    disabled={submitting || comment.trim() === ""}
                    accessibilityRole="button"
                  >
                    {submitting ? <ActivityIndicator size="small" color={colors.contentInverse} /> : <Text style={styles.primaryButtonText}>Valider</Text>}
                  </Pressable>
                  <Pressable style={({ pressed }) => [styles.cancelButton, pressed && styles.buttonPressed]} onPress={closeAll} accessibilityRole="button">
                    <Text style={styles.cancelButtonText}>Annuler</Text>
                  </Pressable>
                </View>
              </View>
            )}
          </View>
        </Pressable>
      </Modal>
    </View>
  );
}

/** Walks up from the actual click target looking for the nearest ancestor
 * carrying `data-testid` (React Native Web already renders a component's
 * `testID` prop as `data-testid` in the DOM — no new prop/wrapper needed)
 * or, failing that, `id`. Stops after a small number of hops rather than
 * walking to the document root — an unmatched click still saves the
 * annotation with just its {x,y}, per docs/ROADMAP.md item 10; this must
 * never block saving a comment. */
function resolveWebElementRef(target: any): string | null {
  let node = target;
  const MAX_HOPS = 6;
  for (let i = 0; i < MAX_HOPS && node; i++) {
    const testId = node.getAttribute?.("data-testid");
    if (testId) return testId;
    const id = node.getAttribute?.("id");
    if (id) return id;
    node = node.parentElement;
  }
  return null;
}

const styles = StyleSheet.create({
  fill: { flex: 1 },
  backdrop: { flex: 1, backgroundColor: "transparent" },
  floating: {
    position: "absolute",
    width: MENU_WIDTH,
    backgroundColor: colors.surfaceBase,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.borderDefault,
    padding: spacing.xs,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.15,
    shadowRadius: 8,
    elevation: 6,
  },
  menuItem: { paddingVertical: spacing.sm + 2, paddingHorizontal: spacing.md, borderRadius: radius.md },
  menuItemPressed: { backgroundColor: colors.surfaceSunken },
  menuItemText: { fontSize: typography.body, color: colors.contentPrimary, fontWeight: "600" },
  formCard: { padding: spacing.sm },
  formLabel: { fontSize: typography.small, color: colors.contentSecondary, marginBottom: spacing.xs },
  formInput: {
    borderWidth: 1,
    borderColor: colors.borderDefault,
    borderRadius: radius.md,
    padding: spacing.sm,
    fontSize: typography.body,
    minHeight: 80,
    textAlignVertical: "top",
    color: colors.contentPrimary,
  },
  formActionsRow: { flexDirection: "row", gap: spacing.sm, marginTop: spacing.sm },
  primaryButton: { flex: 1, backgroundColor: colors.actionPrimary, borderRadius: radius.md, paddingVertical: spacing.sm, alignItems: "center", justifyContent: "center" },
  primaryButtonText: { color: colors.contentInverse, fontSize: typography.body, fontWeight: "700" },
  buttonDisabled: { opacity: 0.5 },
  cancelButton: { paddingVertical: spacing.sm, paddingHorizontal: spacing.md, alignItems: "center", justifyContent: "center" },
  cancelButtonText: { color: colors.contentTertiary, fontSize: typography.body, fontWeight: "600" },
  buttonPressed: { opacity: 0.85 },
});
