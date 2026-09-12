import React, { useEffect, useState } from "react";
import { Platform, View, StyleSheet, ActivityIndicator, Pressable, Text } from "react-native";
import { StatusBar } from "expo-status-bar";
import { NavigationContainer, useNavigationContainerRef } from "@react-navigation/native";
import { createNativeStackNavigator } from "@react-navigation/native-stack";
import { ToastProvider } from "./src/components/Toast";
import ErrorBoundary from "./src/components/ErrorBoundary";
import VersionFooter from "./src/components/VersionFooter";
import { useAuth } from "./src/hooks/useAuth";
import { AuthProvider } from "./src/context/AuthContext";
import LoginScreen from "./src/screens/LoginScreen";
import RegisterScreen from "./src/screens/RegisterScreen";
import ForgotPasswordScreen from "./src/screens/ForgotPasswordScreen";
import ResetPasswordScreen from "./src/screens/ResetPasswordScreen";
import ProfileScreen from "./src/screens/ProfileScreen";
import AdminUsersScreen from "./src/screens/AdminUsersScreen";
import AdminRolesScreen from "./src/screens/AdminRolesScreen";
import AdminTrackerScreen from "./src/screens/AdminTrackerScreen";
import AdminSessionLogScreen from "./src/screens/AdminSessionLogScreen";
import GuidedTestRunnerScreen from "./src/screens/GuidedTestRunnerScreen";
import AnnotationCapture from "./src/components/AnnotationCapture";
import { colors, typography } from "./src/theme/tokens";

import HomeScreen from "./src/screens/HomeScreen";
import ClientsListScreen from "./src/screens/ClientsListScreen";
import ClientDetailScreen from "./src/screens/ClientDetailScreen";
import CalculationWizardScreen, { WizardSite } from "./src/screens/CalculationWizardScreen";
import CalculationReportScreen from "./src/screens/CalculationReportScreen";

export type RootStackParamList = {
  Home: undefined;
  ClientsList: undefined;
  ClientDetail: { clientId: number; clientName: string };
  CalculationWizard: { clientId: number; clientName: string; caseId?: number };
  CalculationReport: {
    clientId: number;
    clientName: string;
    dossierRef: string;
    sites: WizardSite[];
    result: any;
    roundingOverrides: Record<string, number>;
  };
  Profile: undefined;
  AdminUsers: undefined;
  AdminRoles: undefined;
  AdminTracker: undefined;
  AdminSessionLog: undefined;
  GuidedTestRunner: undefined;
};

const Stack = createNativeStackNavigator<RootStackParamList>();

/** Which pre-auth screen to show when there is no session yet. Defaults
 * to "reset" the moment a reset token shows up (the email link lands
 * here with ?reset_token=... already extracted by useAuth), so a user
 * following that link never has to navigate there manually — matches
 * how "reset" can also become the active view later if useAuth captures
 * a token after the initial mount (see the effect below). */
type PreAuthView = "login" | "register" | "forgot" | "reset";

/**
 * AuthGate — sits between the outer ErrorBoundary/ToastProvider shell and
 * the actual navigation stack. It checks the PHP session (GET /auth/me)
 * before rendering anything:
 *
 *  - Loading  → blank screen with a spinner (< 1 s in practice)
 *  - Not auth → one of Login/Register/ForgotPassword/ResetPassword,
 *    switched locally by `preAuthView` (no react-navigation stack for
 *    these four — they're mutually exclusive full-screen states prior
 *    to having a session at all, not a navigable history a back button
 *    should move through)
 *  - Auth OK  → full app navigation stack, wrapped in <AuthProvider> so
 *    Profile/AdminUsers/AdminRoles can reach user/csrfToken/logout/
 *    hasPermission/changePassword/updateProfile without prop-drilling
 *    through every route's params (see src/context/AuthContext.tsx)
 *
 * The actual OAuth dance happens entirely in the PHP backend; the frontend
 * only redirects the browser to /api/auth/microsoft and lets PHP handle
 * Microsoft, the code exchange, and the session cookie. On return
 * (/?auth=ok), this component re-fetches /auth/me and the session
 * is now valid → app shows normally.
 */
function AuthGate() {
  const auth = useAuth();
  const {
    isLoading,
    isAuthenticated,
    error,
    notice,
    resetToken,
    clearResetToken,
    loginWithMicrosoft,
    login,
    register,
    forgotPassword,
    resetPassword,
    resendVerification,
  } = auth;

  const [preAuthView, setPreAuthView] = useState<PreAuthView>(resetToken ? "reset" : "login");

  // FEAT-006 (BUG-048 fix): the annotation layer needs to know which screen
  // is currently active, but it wraps <Stack.Navigator> from the OUTSIDE
  // (see the render below) so it can capture gestures app-wide, including
  // on the chrome around the navigator itself. That means it is a PARENT
  // of the navigator in the tree, not a descendant of it — and
  // `useNavigationState`/`useRoute` only ever resolve the *nearest*
  // navigator context from a component's own position downward. A parent
  // can never read a context its own child provides, no matter how deeply
  // nested inside <NavigationContainer> it is. Calling that hook directly
  // inside AnnotationCapture (the original FEAT-006 frontend pass) threw
  // "Couldn't get the navigation state. Is your component inside a
  // navigator?" on every single render, for every authenticated user,
  // regardless of admin status — a total, unrecoverable outage once the
  // ErrorBoundary caught it, since remounting hit the exact same crash
  // immediately again. Fixed by tracking the current route name up here
  // instead, via the container's own ref (a documented, supported pattern
  // for exactly this "something outside the navigator needs to know the
  // active route" case), and passing it down as a plain prop.
  const navigationRef = useNavigationContainerRef<RootStackParamList>();
  const [currentScreenName, setCurrentScreenName] = useState<string>("unknown");
  const updateCurrentScreenName = () => {
    setCurrentScreenName(navigationRef.getCurrentRoute()?.name ?? "unknown");
  };

  // A reset token can arrive slightly after the initial render (URL
  // parsing happens inside useAuth's mount effect) — switch views the
  // moment it does, same as the initial-state check above but for the
  // async case.
  useEffect(() => {
    if (resetToken) setPreAuthView("reset");
  }, [resetToken]);

  if (isLoading) {
    return (
      <View style={styles.loadingScreen}>
        <ActivityIndicator size="large" color={colors.contentTertiary} />
      </View>
    );
  }

  if (!isAuthenticated) {
    switch (preAuthView) {
      case "register":
        return <RegisterScreen onRegister={register} onNavigateLogin={() => setPreAuthView("login")} />;
      case "forgot":
        return <ForgotPasswordScreen onForgotPassword={forgotPassword} onNavigateLogin={() => setPreAuthView("login")} />;
      case "reset":
        return (
          <ResetPasswordScreen
            token={resetToken}
            onResetPassword={resetPassword}
            onNavigateLogin={() => {
              clearResetToken();
              setPreAuthView("login");
            }}
          />
        );
      default:
        return (
          <LoginScreen
            onMicrosoft={loginWithMicrosoft}
            onLogin={login}
            onNavigateRegister={() => setPreAuthView("register")}
            onNavigateForgotPassword={() => setPreAuthView("forgot")}
            onResendVerification={resendVerification}
            isLoading={isLoading}
            error={error}
            notice={notice}
          />
        );
    }
  }

  // Authenticated: render the full navigation stack.
  return (
    <AuthProvider value={auth}>
      <View style={styles.navArea}>
        <NavigationContainer
          ref={navigationRef}
          onReady={updateCurrentScreenName}
          onStateChange={updateCurrentScreenName}
        >
          <StatusBar style="auto" />
          {/* FEAT-006: admin-only right-click/long-press annotation capture,
              wrapping the navigator so it's active app-wide for any screen.
              Renders `children` completely unmodified for non-admins — see
              AnnotationCapture's own header comment. `screenName` is read
              from `navigationRef` above (see the comment on it) rather than
              from a hook inside AnnotationCapture itself — see BUG-048. */}
          <AnnotationCapture screenName={currentScreenName}>
            <Stack.Navigator initialRouteName="Home">
              <Stack.Screen
                name="Home"
                component={HomeScreen}
                options={({ navigation }) => ({
                  title: "Audit Duration Calculator",
                  headerRight: () => (
                    <Pressable
                      onPress={() => navigation.navigate("Profile")}
                      hitSlop={8}
                      accessibilityRole="button"
                      accessibilityLabel="Mon profil"
                    >
                      <Text style={styles.headerProfileLink}>Profil</Text>
                    </Pressable>
                  ),
                })}
              />
              <Stack.Screen name="ClientsList" component={ClientsListScreen} options={{ title: "Mes clients", headerShown: false }} />
              <Stack.Screen name="ClientDetail" component={ClientDetailScreen} options={{ title: "Client", headerShown: false }} />
              <Stack.Screen
                name="CalculationWizard"
                component={CalculationWizardScreen}
                options={{ title: "Calcul", headerShown: false }}
              />
              <Stack.Screen
                name="CalculationReport"
                component={CalculationReportScreen}
                options={{ title: "Rapport de calcul", headerShown: false }}
              />
              <Stack.Screen name="Profile" component={ProfileScreen} options={{ title: "Mon profil", headerShown: false }} />
              <Stack.Screen name="AdminUsers" component={AdminUsersScreen} options={{ title: "Utilisateurs", headerShown: false }} />
              <Stack.Screen name="AdminRoles" component={AdminRolesScreen} options={{ title: "Rôles et permissions", headerShown: false }} />
              <Stack.Screen name="AdminTracker" component={AdminTrackerScreen} options={{ title: "Suivi bugs/fonctionnalités", headerShown: false }} />
              <Stack.Screen name="AdminSessionLog" component={AdminSessionLogScreen} options={{ title: "Journal des sessions", headerShown: false }} />
              <Stack.Screen name="GuidedTestRunner" component={GuidedTestRunnerScreen} options={{ title: "Mode Test Guidé", headerShown: false }} />
            </Stack.Navigator>
          </AnnotationCapture>
        </NavigationContainer>
      </View>
    </AuthProvider>
  );
}

export default function App() {
  // BUG-051: ErrorBoundary's "Retour à l'accueil" previously just called
  // setState({error: null}) via onGoHome's native no-op branch — which
  // re-renders the *exact same* crashed component tree with the exact
  // same props/state that caused the crash, so any crash that isn't a
  // one-off (state-dependent, not just a bad render on mount) immediately
  // re-triggers. See the comment on `navigationRef` above for a concrete
  // case (BUG-048) where remounting the same tree hit the same crash
  // again right away. Web already had a real fix (`window.location.reload()`
  // — a full page reload, discarding all JS state). This gives native the
  // equivalent: bumping `errorResetKey` and using it as the root
  // `<ErrorBoundary>`'s `key` forces React to fully unmount and recreate
  // the entire tree below it (ErrorBoundary's own state included),
  // discarding everything — the same practical effect as a page reload.
  // Deliberately not `expo-updates` (the option this bug's own tracker
  // entry floated): that's a native module requiring an EAS rebuild to
  // actually take effect, for an app that today is shipped only as the
  // web export (see REPOSITORY_ARCHITECTURE.md) — adding it now would be
  // an unverifiable dependency on a rebuild pipeline that doesn't run
  // yet, for a problem a plain React remount already solves without any
  // native code. Worth revisiting if/when a real native build ships.
  const [errorResetKey, setErrorResetKey] = useState(0);

  // Mobile web: a native browser "pull down to reload" gesture would reload
  // the whole page and wipe all in-progress wizard state. This disables that
  // specific browser gesture (vertical overscroll bounce/refresh) without
  // touching horizontal scroll or the app's own scroll views — the app has
  // no custom pull-to-refresh of its own yet (see ROADMAP.md), so for now
  // the only correct behavior is "never lose data to this gesture."
  useEffect(() => {
    if (Platform.OS === "web" && typeof document !== "undefined") {
      document.documentElement.style.overscrollBehaviorY = "contain";
      document.body.style.overscrollBehaviorY = "contain";
    }
  }, []);

  return (
    <ErrorBoundary
      key={errorResetKey}
      onGoHome={() => {
        if (Platform.OS === "web" && typeof window !== "undefined") {
          window.location.reload();
        } else {
          setErrorResetKey((k) => k + 1);
        }
      }}
    >
      <ToastProvider>
        <View style={styles.root}>
          {/* Auth gate: handles login/loading/app rendering */}
          <AuthGate />
          {/* FEAT-003: version/last-update footer, visible on every screen
              regardless of which stack screen is active — kept as a sibling
              of the navigator rather than per-screen so there is exactly
              one place this can drift out of sync. */}
          <VersionFooter />
        </View>
      </ToastProvider>
    </ErrorBoundary>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  navArea: { flex: 1 },
  loadingScreen: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: colors.surfaceSunken,
  },
  headerProfileLink: {
    color: colors.link,
    fontSize: typography.body,
    fontWeight: "600",
    marginRight: 4,
  },
});
