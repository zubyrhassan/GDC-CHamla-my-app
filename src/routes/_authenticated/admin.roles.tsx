import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";

import { AppShell } from "@/components/AppShell";
import { AdminNav } from "./admin";
import { Checkbox } from "@/components/ui/checkbox";
import { supabase } from "@/integrations/supabase/client";
import { useSuperAdminGuard } from "@/lib/access";
import {
  ACTIONS,
  ACTION_LABELS,
  ASSIGNABLE_ROLES,
  MODULES,
  MODULE_LABELS,
  ROLE_LABELS,
  actionColumn,
  useRolePermissions,
  type ActionKey,
  type ModuleKey,
} from "@/lib/permissions";

export const Route = createFileRoute("/_authenticated/admin/roles")({
  head: () => ({
    meta: [
      { title: "Roles & Permissions — GDC Chamla" },
      {
        name: "description",
        content:
          "Super Admin matrix controlling what each staff role at Government Degree College Chamla can view, add, edit and delete.",
      },
      { property: "og:title", content: "Roles & Permissions — GDC Chamla" },
      {
        property: "og:description",
        content: "Set default View, Add, Edit and Delete rights for every college staff role.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: RolesPage,
});

function RolesPage() {
  useSuperAdminGuard();
  const queryClient = useQueryClient();
  const { data: rows = [], isLoading } = useRolePermissions();

  const save = useMutation({
    mutationFn: async (input: {
      role: string;
      module: ModuleKey;
      action: ActionKey;
      value: boolean;
    }) => {
      const column = actionColumn(input.action);
      const existing = rows.find((r) => r.role === input.role && r.module === input.module);
      const payload: Record<string, unknown> = {
        role: input.role,
        module: input.module,
        can_view: existing?.can_view ?? false,
        can_add: existing?.can_add ?? false,
        can_edit: existing?.can_edit ?? false,
        can_delete: existing?.can_delete ?? false,
      };
      payload[column] = input.value;
      // Granting add/edit/delete is meaningless without view.
      if (input.value && input.action !== "view") payload["can_view"] = true;
      if (!input.value && input.action === "view") {
        payload["can_add"] = false;
        payload["can_edit"] = false;
        payload["can_delete"] = false;
      }
      const { error } = await supabase
        .from("permissions")
        .upsert(payload as never, { onConflict: "role,module" });
      if (error) throw error;
    },
    onSuccess: () => void queryClient.invalidateQueries({ queryKey: ["permissions"] }),
    onError: (e: Error) => toast.error(e.message),
  });

  function valueOf(role: string, module: ModuleKey, action: ActionKey) {
    const row = rows.find((r) => r.role === role && r.module === module);
    return Boolean(row?.[actionColumn(action)]);
  }

  return (
    <AppShell
      title="Roles & permissions"
      subtitle="Default rights for each staff role. Individual exceptions live on the Staff accounts screen."
    >
      <AdminNav />

      {isLoading ? (
        <p className="text-sm text-muted-foreground">Loading permissions…</p>
      ) : (
        <div className="overflow-x-auto rounded-lg border bg-card shadow-panel">
          <table className="w-full min-w-[840px] text-sm">
            <thead>
              <tr className="border-b bg-secondary/40 text-left">
                <th className="p-3 font-medium">Module</th>
                {ASSIGNABLE_ROLES.map((role) => (
                  <th key={role} className="p-3 font-medium">
                    {ROLE_LABELS[role]}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {MODULES.map((module) => (
                <tr key={module} className="border-b last:border-0 align-top">
                  <td className="p-3 font-medium">{MODULE_LABELS[module]}</td>
                  {ASSIGNABLE_ROLES.map((role) => (
                    <td key={role} className="p-3">
                      {role === "super_admin" ? (
                        <span className="text-xs text-muted-foreground">Full access</span>
                      ) : (
                        <div className="grid grid-cols-2 gap-x-3 gap-y-1.5">
                          {ACTIONS.map((action) => (
                            <label
                              key={action}
                              className="flex items-center gap-1.5 text-xs whitespace-nowrap"
                            >
                              <Checkbox
                                checked={valueOf(role, module, action)}
                                onCheckedChange={(v) =>
                                  save.mutate({
                                    role,
                                    module,
                                    action,
                                    value: v === true,
                                  })
                                }
                              />
                              {ACTION_LABELS[action]}
                            </label>
                          ))}
                        </div>
                      )}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <p className="mt-3 text-xs text-muted-foreground">
        Changes save immediately and are enforced by the database, not only by the interface.
      </p>
    </AppShell>
  );
}
