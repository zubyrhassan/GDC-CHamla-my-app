import { useEffect } from "react";
import { useNavigate } from "@tanstack/react-router";
import { toast } from "sonner";

import { usePermissions, type ActionKey, type ModuleKey } from "@/lib/permissions";

/** Plain teachers use the teacher desk; every other role uses the staff console. */
export function useHomePath() {
  const { role } = usePermissions();
  return role === "teacher" ? "/teacher" : "/admin";
}

/**
 * Sends staff back to their dashboard when they open a section they cannot view.
 * Returns the permission set so screens can also gate buttons.
 */
export function useModuleGuard(module: ModuleKey) {
  const perms = usePermissions();
  const navigate = useNavigate();
  const home = useHomePath();
  const allowed = perms.isLoading || perms.can(module, "view");

  useEffect(() => {
    if (perms.isLoading || allowed) return;
    toast.error("You don't have access to this section");
    navigate({ to: home, replace: true });
  }, [perms.isLoading, allowed, navigate, home]);

  return { ...perms, allowed: perms.can(module, "view") };
}

/** Super-admin-only screens (roles matrix, staff accounts). */
export function useSuperAdminGuard() {
  const perms = usePermissions();
  const navigate = useNavigate();
  const home = useHomePath();

  useEffect(() => {
    if (perms.isLoading || perms.isSuperAdmin) return;
    toast.error("You don't have access to this section");
    navigate({ to: home, replace: true });
  }, [perms.isLoading, perms.isSuperAdmin, navigate, home]);

  return perms;
}

/** Renders children only when the signed-in user holds the permission. */
export function Can({
  module,
  action,
  children,
}: {
  module: ModuleKey;
  action: ActionKey;
  children: React.ReactNode;
}) {
  const { can } = usePermissions();
  if (!can(module, action)) return null;
  return <>{children}</>;
}
