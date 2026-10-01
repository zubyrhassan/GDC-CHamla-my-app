import { useQuery } from "@tanstack/react-query";

import { supabase } from "@/integrations/supabase/client";
import { useProfile, type Role } from "@/hooks/useProfile";

export const MODULES = [
  "students",
  "attendance",
  "examinations",
  "fees",
  "hostel",
  "struck_off",
  "settings",
  "reports",
  "website",
] as const;
export type ModuleKey = (typeof MODULES)[number];

export const MODULE_LABELS: Record<ModuleKey, string> = {
  students: "Students",
  attendance: "Attendance",
  examinations: "Examinations",
  fees: "Fees",
  hostel: "Hostel",
  struck_off: "Struck off",
  settings: "Settings",
  reports: "Reports",
  website: "Website",
};


export const ACTIONS = ["view", "add", "edit", "delete"] as const;
export type ActionKey = (typeof ACTIONS)[number];

export const ACTION_LABELS: Record<ActionKey, string> = {
  view: "View",
  add: "Add",
  edit: "Edit",
  delete: "Delete",
};

/** Roles the Super Admin can assign. Legacy 'admin' is treated as Super Admin. */
export const ASSIGNABLE_ROLES = [
  "super_admin",
  "principal",
  "coe",
  "coordinator",
  "clerk",
  "teacher",
] as const;

export const ROLE_LABELS: Record<string, string> = {
  super_admin: "Super Admin",
  admin: "Super Admin (legacy)",
  principal: "Principal",
  coe: "Controller of Examinations",
  coordinator: "Coordinator",
  clerk: "Clerk",
  teacher: "Teacher",
};

export function roleLabel(role: string | null | undefined) {
  if (!role) return "Staff";
  return ROLE_LABELS[role] ?? role;
}

export function isSuperAdminRole(role: string | null | undefined) {
  return role === "super_admin" || role === "admin";
}

export type PermissionRow = {
  id: string;
  role: string;
  module: string;
  can_view: boolean;
  can_add: boolean;
  can_edit: boolean;
  can_delete: boolean;
};

export type OverrideRow = {
  id: string;
  profile_id: string;
  module: string;
  can_view: boolean | null;
  can_add: boolean | null;
  can_edit: boolean | null;
  can_delete: boolean | null;
};

const COLUMN: Record<ActionKey, keyof PermissionRow> = {
  view: "can_view",
  add: "can_add",
  edit: "can_edit",
  delete: "can_delete",
};

export function actionColumn(action: ActionKey) {
  return COLUMN[action] as "can_view" | "can_add" | "can_edit" | "can_delete";
}

/** Role defaults for every role — readable by any signed-in staff member. */
export function useRolePermissions() {
  return useQuery({
    queryKey: ["permissions"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("permissions")
        .select("id, role, module, can_view, can_add, can_edit, can_delete");
      if (error) throw error;
      return (data ?? []) as PermissionRow[];
    },
  });
}

/** Per-person overrides. Non super admins may only read their own rows (RLS). */
export function useOverrides(profileId?: string) {
  return useQuery({
    queryKey: ["permission-overrides", profileId ?? "self"],
    queryFn: async () => {
      let q = supabase
        .from("user_permission_overrides")
        .select("id, profile_id, module, can_view, can_add, can_edit, can_delete");
      if (profileId) q = q.eq("profile_id", profileId);
      const { data, error } = await q;
      if (error) throw error;
      return (data ?? []) as OverrideRow[];
    },
  });
}

export type PermissionSet = {
  role: Role | null;
  isSuperAdmin: boolean;
  isLoading: boolean;
  /** Mirrors the database get_permission(): override first, then role default. */
  can: (module: ModuleKey, action: ActionKey) => boolean;
};

/** The signed-in user's effective permissions. */
export function usePermissions(): PermissionSet {
  const { data: profile, isLoading: profileLoading } = useProfile();
  const { data: roleRows = [], isLoading: rolesLoading } = useRolePermissions();
  const { data: overrides = [], isLoading: overridesLoading } = useOverrides(profile?.id);

  const superAdmin = isSuperAdminRole(profile?.role);

  return {
    role: profile?.role ?? null,
    isSuperAdmin: superAdmin,
    isLoading: profileLoading || rolesLoading || overridesLoading,
    can: (module, action) => {
      if (superAdmin) return true;
      if (!profile) return false;
      const col = actionColumn(action);
      const override = overrides.find((o) => o.module === module);
      const overrideValue = override?.[col];
      if (overrideValue != null) return overrideValue;
      const fallback = roleRows.find((r) => r.role === profile.role && r.module === module);
      return Boolean(fallback?.[col]);
    },
  };
}
