import { useCallback } from "react";
import { API_BASE_URL } from "../config/api";

/** Matches db/roleRepo.php's listRoles()/createRole()/getRoleById(). */
export interface Role {
  id: number;
  name: string;
  description: string | null;
  isSystem: boolean;
  userCount: number;
  permissions: string[];
}

/** Matches db/permissionRepo.php's listPermissions(). */
export interface Permission {
  id: number;
  key: string;
  label: string;
  description: string | null;
}

/** Matches db/userRepo.php's listUsers(). */
export interface AdminUser {
  id: number;
  name: string;
  email: string;
  status: string;
  emailVerified: boolean;
  role: { id: number; name: string };
  lastLoginAt: string | null;
  createdAt: string;
}

/** Matches db/annotationRepo.php's mapAnnotationRow() — FEAT-006. */
export interface Annotation {
  id: number;
  screen: string;
  elementRef: string | null;
  x: number;
  y: number;
  comment: string;
  appVersion: string;
  status: "open" | "actioned" | "dismissed";
  createdAt: string;
  updatedAt: string;
  createdBy: number;
  createdByName: string;
}

/** Matches db/trackerRepo.php's mapTrackerUpdateRow() — FEAT-010. */
export interface TrackerUpdate {
  id: number;
  itemCode: string;
  done: string;
  next: string | null;
  createdAt: string;
}

/** Matches db/trackerRepo.php's mapTrackerItemRow() — FEAT-010. `updates`
 * is only populated by getTrackerItem() (the by-code detail fetch);
 * listTrackerItems() rows never carry it — mirrors the repo layer's own
 * getTrackerItemByCode()-only attachment of history.
 *
 * `screen`/`elementRef`/`x`/`y`/`appVersion`/`createdBy`/`sourceAnnotationId`
 * added by migration 009 (2026-09-10, annotations/tracker merge) — NULL on
 * every normal dev-created row, populated only for `type === "annotation"`
 * rows created via the in-app pin tool (see createAnnotationItem() below). */
export interface TrackerItem {
  code: string;
  type: "bug" | "feature" | "techdebt" | "other" | "annotation";
  title: string;
  userDescription: string | null;
  technicalDescription: string | null;
  status: "open" | "in_progress" | "fixed_unverified" | "verified" | "closed";
  priority: "p0" | "p1" | "p2" | "p3" | null;
  dependencies: string | null;
  testsToDo: string | null;
  comments: string | null;
  screen: string | null;
  elementRef: string | null;
  x: number | null;
  y: number | null;
  appVersion: string | null;
  createdBy: number | null;
  sourceAnnotationId: number | null;
  createdAt: string;
  updatedAt: string;
  updates?: TrackerUpdate[];
}

/** Matches db/sessionLogRepo.php's mapSessionLogRow() — migration 007
 * (session_log table). Append-only by design (see the migration's own
 * comment, point 5): no update/delete here, matching the backend's
 * GET/POST-only routes. */
export interface SessionLogEntry {
  id: number;
  sessionLabel: string;
  summary: string;
  trigger: string | null;
  done: string | null;
  notDone: string | null;
  handoff: string | null;
  commitHash: string | null;
  ciStatus: string | null;
  createdAt: string;
}

export class AdminApiError extends Error {
  constructor(public status: number, message: string) {
    super(message);
    this.name = "AdminApiError";
  }
}

/**
 * /admin/* client. Every mutating call here requires both an authenticated
 * session (requirePermission('manage_roles'|'manage_users') server-side)
 * and the X-CSRF-Token header (requireCsrf()) — see auth/Guard.php. Reads
 * (GET) only require the permission, no CSRF token, matching the backend.
 *
 * Takes csrfToken from the caller (useAuth()'s own state) rather than
 * managing its own — there is exactly one session/CSRF source of truth
 * per docs/DEV_STATUS.md's account-model constraint, and this hook is not
 * it.
 */
export function useAdminApi(csrfToken: string | null) {
  const request = useCallback(
    async <T>(path: string, init?: RequestInit): Promise<T> => {
      let res: Response;
      try {
        res = await fetch(`${API_BASE_URL}${path}`, {
          ...init,
          credentials: "include",
          headers: {
            "Content-Type": "application/json",
            ...(csrfToken ? { "X-CSRF-Token": csrfToken } : {}),
            ...(init?.headers ?? {}),
          },
        });
      } catch (e: any) {
        throw new AdminApiError(0, `Impossible de joindre le serveur. (${e?.message ?? "network error"})`);
      }
      const text = await res.text();
      const body = text ? JSON.parse(text) : undefined;
      if (!res.ok) {
        throw new AdminApiError(res.status, body?.error ?? `La requête a échoué (${res.status}).`);
      }
      return body as T;
    },
    [csrfToken]
  );

  return {
    listRoles: () => request<Role[]>("/admin/roles"),
    createRole: (name: string, description: string | null, permissions: string[]) =>
      request<Role>("/admin/roles", { method: "POST", body: JSON.stringify({ name, description, permissions }) }),
    updateRole: (id: number, name: string, description: string | null, permissions: string[]) =>
      request<Role>(`/admin/roles/${id}`, { method: "PUT", body: JSON.stringify({ name, description, permissions }) }),
    deleteRole: (id: number) => request<{ deleted: number }>(`/admin/roles/${id}`, { method: "DELETE" }),

    listPermissions: () => request<Permission[]>("/admin/permissions"),
    createPermission: (key: string, label: string, description: string | null) =>
      request<Permission>("/admin/permissions", { method: "POST", body: JSON.stringify({ key, label, description }) }),
    updatePermission: (id: number, label: string, description: string | null) =>
      request<Permission>(`/admin/permissions/${id}`, { method: "PUT", body: JSON.stringify({ label, description }) }),
    deletePermission: (id: number) => request<{ deleted: number }>(`/admin/permissions/${id}`, { method: "DELETE" }),

    listUsers: () => request<AdminUser[]>("/admin/users"),
    updateUser: (id: number, fields: { roleId?: number; status?: string }) =>
      request<AdminUser>(`/admin/users/${id}`, { method: "PUT", body: JSON.stringify(fields) }),

    // FEAT-006 — admin annotation/comment tool (docs/ROADMAP.md item 10).
    listAnnotations: (status?: "open" | "actioned" | "dismissed") =>
      request<Annotation[]>(`/admin/annotations${status ? `?status=${status}` : ""}`),
    createAnnotation: (screen: string, elementRef: string | null, x: number, y: number, comment: string, appVersion: string) =>
      request<Annotation>("/admin/annotations", {
        method: "POST",
        body: JSON.stringify({ screen, elementRef, x, y, comment, appVersion }),
      }),
    updateAnnotationStatus: (id: number, status: "open" | "actioned" | "dismissed") =>
      request<Annotation>(`/admin/annotations/${id}`, { method: "PUT", body: JSON.stringify({ status }) }),
    deleteAnnotation: (id: number) => request<{ deleted: number }>(`/admin/annotations/${id}`, { method: "DELETE" }),
    /** Export is plain text (markdown or json), not the JSON-envelope shape
     * every other call here expects — bypasses the shared `request()`
     * helper (which unconditionally JSON.parses the body) and returns the
     * raw response text for the caller to display/share as-is. */
    exportAnnotations: async (format: "markdown" | "json" = "markdown", status?: "open" | "actioned" | "dismissed"): Promise<string> => {
      const params = new URLSearchParams({ format });
      if (status) params.set("status", status);
      let res: Response;
      try {
        res = await fetch(`${API_BASE_URL}/admin/annotations/export?${params.toString()}`, { credentials: "include" });
      } catch (e: any) {
        throw new AdminApiError(0, `Impossible de joindre le serveur. (${e?.message ?? "network error"})`);
      }
      const text = await res.text();
      if (!res.ok) {
        let message = `L'export a échoué (${res.status}).`;
        try {
          const parsed = JSON.parse(text);
          message = parsed?.error ?? message;
        } catch {
          // Non-JSON error body — keep the generic message.
        }
        throw new AdminApiError(res.status, message);
      }
      return text;
    },

    // FEAT-010 — bug/feature/tech-debt tracker (docs/ROADMAP.md item 12).
    // Mirrors the annotations block above: same request() helper, same
    // error shape. `type` and `code` are immutable after creation — see
    // trackerRepo.php's updateTrackerItem() doc comment for why — so
    // updateTrackerItem()'s fields type deliberately excludes them.
    //
    // status/type/priority accept an array (multiselect, added 2026-09-10
    // for AdminTrackerScreen.tsx's filter rework — sent comma-joined,
    // matching api/index.php's ?status=a,b,c parsing) or a single value,
    // kept working for any other caller. `search` matches the backend's
    // ?search= free-text filter (existed unwired since the forty-seventh
    // session; wired here for the first time).
    listTrackerItems: (filters?: {
      status?: TrackerItem["status"] | TrackerItem["status"][];
      type?: TrackerItem["type"] | TrackerItem["type"][];
      priority?: NonNullable<TrackerItem["priority"]> | NonNullable<TrackerItem["priority"]>[];
      search?: string;
    }) => {
      const params = new URLSearchParams();
      const join = (v?: string | string[]) => (Array.isArray(v) ? v.join(",") : v);
      const status = join(filters?.status);
      const type = join(filters?.type);
      const priority = join(filters?.priority);
      if (status) params.set("status", status);
      if (type) params.set("type", type);
      if (priority) params.set("priority", priority);
      if (filters?.search?.trim()) params.set("search", filters.search.trim());
      const qs = params.toString();
      return request<TrackerItem[]>(`/admin/tracker/items${qs ? `?${qs}` : ""}`);
    },
    getTrackerItem: (code: string) => request<TrackerItem>(`/admin/tracker/items/${code}`),
    createTrackerItem: (fields: {
      code: string;
      type: TrackerItem["type"];
      title: string;
      userDescription?: string | null;
      technicalDescription?: string | null;
      status?: TrackerItem["status"];
      priority?: TrackerItem["priority"];
      dependencies?: string | null;
      testsToDo?: string | null;
      comments?: string | null;
    }) => request<TrackerItem>("/admin/tracker/items", { method: "POST", body: JSON.stringify(fields) }),
    updateTrackerItem: (
      code: string,
      fields: Partial<{
        title: string;
        userDescription: string | null;
        technicalDescription: string | null;
        status: TrackerItem["status"];
        priority: TrackerItem["priority"];
        dependencies: string | null;
        testsToDo: string | null;
        comments: string | null;
      }>
    ) => request<TrackerItem>(`/admin/tracker/items/${code}`, { method: "PUT", body: JSON.stringify(fields) }),
    deleteTrackerItem: (code: string) => request<{ deleted: string }>(`/admin/tracker/items/${code}`, { method: "DELETE" }),
    addTrackerUpdate: (code: string, done: string, next?: string | null, status?: TrackerItem["status"]) =>
      request<TrackerItem>(`/admin/tracker/items/${code}/updates`, {
        method: "POST",
        body: JSON.stringify({ done, next: next ?? null, status: status ?? null }),
      }),
    suggestNextTrackerCode: (prefix: string) => request<{ code: string }>(`/admin/tracker/next-code?prefix=${encodeURIComponent(prefix)}`),

    /** The in-app pin tool's create call (migration 009, 2026-09-10
     * annotations/tracker merge) — replaces createAnnotation() above as
     * AnnotationCapture.tsx's only create path. Creates a `tracker_items`
     * row directly (`type: "annotation"`, auto-coded `ANN-NNN`,
     * `technicalDescription`/`priority`/`dependencies`/`testsToDo` all
     * left NULL) for a dev to triage and complete later via
     * updateTrackerItem() — same as any other tracker item from there on. */
    createAnnotationItem: (screen: string, elementRef: string | null, x: number, y: number, comment: string, appVersion: string) =>
      request<TrackerItem>("/admin/tracker/annotations", {
        method: "POST",
        body: JSON.stringify({ screen, elementRef, x, y, comment, appVersion }),
      }),

    // Session/action log (migration 007, forty-eighth session) — "table 1"
    // of Mahdi's two-table ask, live since that session but with no UI
    // caller until now (flagged in every hand-off since). Append-only:
    // list + create only, no update/delete method exists here at all,
    // matching the backend's own GET/POST-only routes.
    listSessionLog: (limit?: number) =>
      request<SessionLogEntry[]>(`/admin/session-log${limit ? `?limit=${limit}` : ""}`),
    createSessionLogEntry: (fields: {
      sessionLabel: string;
      summary: string;
      trigger?: string | null;
      done?: string | null;
      notDone?: string | null;
      handoff?: string | null;
      commitHash?: string | null;
      ciStatus?: string | null;
    }) => request<SessionLogEntry>("/admin/session-log", { method: "POST", body: JSON.stringify(fields) }),
  };
}
