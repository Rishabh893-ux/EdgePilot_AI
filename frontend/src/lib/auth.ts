/**
 * EdgePilot AI — Auth Utilities
 * Role-based access: Admin, Operator, Viewer
 */

import { api } from "./api"

export type Role = "admin" | "operator" | "viewer"

export interface User {
  username: string
  role: Role
  name: string
}

// ── Role permissions ──────────────────────────────────────────────
export const PERMISSIONS: Record<Role, {
  canTrainModel:      boolean
  canResolveAlerts:   boolean
  canLogMaintenance:  boolean
  canViewCopilot:     boolean
  canViewViolations:  boolean
  label:              string
  color:              string
}> = {
  admin: {
    canTrainModel:     true,
    canResolveAlerts:  true,
    canLogMaintenance: true,
    canViewCopilot:    true,
    canViewViolations: true,
    label: "Admin",
    color: "#f59e0b",
  },
  operator: {
    canTrainModel:     false,
    canResolveAlerts:  true,
    canLogMaintenance: true,
    canViewCopilot:    true,
    canViewViolations: true,
    label: "Operator",
    color: "#34d399",
  },
  viewer: {
    canTrainModel:     false,
    canResolveAlerts:  false,
    canLogMaintenance: false,
    canViewCopilot:    false,
    canViewViolations: false,
    label: "Viewer",
    color: "#60a5fa",
  },
}

// ── Auth helpers ────────────────────────────────────────────────
export function normalizeUser(payload: { username: string; role: string } | null): User | null {
  if (!payload) return null
  const role = payload.role as Role
  return { username: payload.username, role, name: payload.username }
}

export function setSession(user: User, token: string) {
  if (typeof window !== "undefined") {
    localStorage.setItem("edgepilot_user", JSON.stringify(user))
    localStorage.setItem("edgepilot_token", token)
    document.cookie = `edgepilot_auth=${btoa(JSON.stringify(user))}; path=/; max-age=86400`
  }
}

export function clearSession() {
  if (typeof window !== "undefined") {
    localStorage.removeItem("edgepilot_user")
    localStorage.removeItem("edgepilot_token")
    document.cookie = "edgepilot_auth=; path=/; max-age=0"
  }
}

export async function logout() {
  if (typeof window === "undefined") return

  const token = getToken()
  if (token) {
    try {
      await api.logout(token)
    } catch {
      // Ignore network issues and still clear the session locally.
    }
  }

  clearSession()
}

export function getUser(): User | null {
  if (typeof window === "undefined") return null
  try {
    const raw = localStorage.getItem("edgepilot_user")
    return raw ? JSON.parse(raw) : null
  } catch {
    return null
  }
}

export function getToken(): string | null {
  if (typeof window === "undefined") return null
  return localStorage.getItem("edgepilot_token")
}

export function isLoggedIn(): boolean {
  return getUser() !== null
}

export function can(role: Role, permission: keyof typeof PERMISSIONS[Role]): boolean {
  return PERMISSIONS[role][permission] as boolean
}
