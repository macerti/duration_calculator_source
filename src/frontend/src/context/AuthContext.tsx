import React, { createContext, useContext } from "react";
import { AuthState, AuthResult } from "../hooks/useAuth";

/**
 * AuthContext — added 2026-09-05 (thirtieth session) to unblock
 * Profile/AdminUsers/AdminRoles.
 *
 * Why this exists: App.tsx's AuthGate already computes useAuth() once at
 * the top, but the pre-existing pattern (see LoginScreen's props) passes
 * auth fields down as explicit props one screen at a time. That pattern
 * doesn't reach screens nested inside the Stack.Navigator without
 * threading auth fields through every route's params, which
 * RootStackParamList doesn't do and shouldn't start doing just for this.
 * A context avoids that plumbing for exactly the three screens
 * (Profile/AdminUsers/AdminRoles) that need `user`/`csrfToken`/
 * `hasPermission`/`logout`/`changePassword`/`updateProfile` outside the
 * pre-auth flow — LoginScreen/RegisterScreen/ForgotPasswordScreen/
 * ResetPasswordScreen keep receiving their handlers as direct props from
 * AuthGate, unchanged, since they render *instead of* the navigator, not
 * inside it.
 */
export interface AuthContextValue extends AuthState {
  logout: () => Promise<void>;
  changePassword: (currentPassword: string, newPassword: string) => Promise<AuthResult>;
  updateProfile: (fields: { name?: string; email?: string }) => Promise<AuthResult>;
  hasPermission: (key: string) => boolean;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({
  value,
  children,
}: {
  value: AuthContextValue;
  children: React.ReactNode;
}) {
  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

/**
 * Only ever called from screens rendered inside AuthGate's authenticated
 * branch (Home, ClientsList, ClientDetail, CalculationWizard,
 * CalculationReport, Profile, AdminUsers, AdminRoles) — all of them sit
 * inside the <AuthProvider> in App.tsx, so the null case here is a
 * programming error (a screen moved outside the provider), not a normal
 * runtime state, hence throwing rather than returning a fallback.
 */
export function useAuthContext(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) {
    throw new Error(
      "useAuthContext() called outside <AuthProvider> — this screen must be rendered inside AuthGate's authenticated branch."
    );
  }
  return ctx;
}
