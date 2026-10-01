import { useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { UserPlus } from "lucide-react";

import { AppShell } from "@/components/AppShell";
import { AdminNav } from "./admin";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { supabase } from "@/integrations/supabase/client";
import { useSuperAdminGuard } from "@/lib/access";
import { createStaffAccount, listStaffAccounts } from "@/lib/staff.functions";
import {
  ACTIONS,
  ACTION_LABELS,
  ASSIGNABLE_ROLES,
  MODULES,
  MODULE_LABELS,
  ROLE_LABELS,
  actionColumn,
  isSuperAdminRole,
  roleLabel,
  useOverrides,
  useRolePermissions,
  type ActionKey,
  type ModuleKey,
} from "@/lib/permissions";

export const Route = createFileRoute("/_authenticated/admin/staff")({
  head: () => ({
    meta: [
      { title: "Staff Accounts — GDC Chamla" },
      {
        name: "description",
        content:
          "Create staff logins and set individual permission exceptions for Government Degree College Chamla.",
      },
      { property: "og:title", content: "Staff Accounts — GDC Chamla" },
      {
        property: "og:description",
        content: "Manage college staff logins, roles and per-person permission overrides.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: StaffPage,
});

type Staff = {
  id: string;
  full_name: string;
  role: string;
  phone: string | null;
  email: string;
  created_at: string;
};

function randomPassword() {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz23456789";
  const bytes = crypto.getRandomValues(new Uint32Array(12));
  return Array.from(bytes, (b) => chars[b % chars.length]).join("");
}

function StaffPage() {
  useSuperAdminGuard();
  const listStaff = useServerFn(listStaffAccounts);
  const [search, setSearch] = useState("");
  const [selected, setSelected] = useState<Staff | null>(null);

  const { data: staff = [], isLoading } = useQuery({
    queryKey: ["staff"],
    queryFn: async () => (await listStaff()) as Staff[],
  });

  const term = search.trim().toLowerCase();
  const shown = term
    ? staff.filter(
        (s) =>
          s.full_name.toLowerCase().includes(term) || s.email.toLowerCase().includes(term),
      )
    : staff;

  return (
    <AppShell
      title="Staff accounts"
      subtitle="Create logins, set roles, and grant or restrict individual staff members."
    >
      <AdminNav />

      <div className="space-y-6">
        <NewStaffCard />

        <section className="rounded-lg border bg-card p-5 shadow-panel">
          <h2 className="font-serif text-lg font-semibold">Staff members</h2>
          <div className="crest-rule mt-3 mb-4 w-16" />

          <Input
            placeholder="Search by name or email"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="mb-4 max-w-sm"
          />

          {isLoading ? (
            <p className="text-sm text-muted-foreground">Loading staff…</p>
          ) : shown.length === 0 ? (
            <p className="text-sm text-muted-foreground">No staff members match that search.</p>
          ) : (
            <div className="divide-y rounded-md border">
              {shown.map((s) => (
                <div key={s.id} className="flex flex-wrap items-center gap-3 p-3">
                  <div className="min-w-0 flex-1">
                    <p className="truncate font-medium">{s.full_name || "Unnamed"}</p>
                    <p className="truncate text-xs text-muted-foreground">{s.email}</p>
                  </div>
                  <RoleSelect staff={s} />
                  <Button
                    variant={selected?.id === s.id ? "default" : "outline"}
                    size="sm"
                    onClick={() => setSelected(selected?.id === s.id ? null : s)}
                  >
                    {selected?.id === s.id ? "Close" : "Permissions"}
                  </Button>
                </div>
              ))}
            </div>
          )}
        </section>

        {selected ? <OverrideMatrix staff={selected} /> : null}
      </div>
    </AppShell>
  );
}

function RoleSelect({ staff }: { staff: Staff }) {
  const queryClient = useQueryClient();
  const update = useMutation({
    mutationFn: async (role: string) => {
      const { error } = await supabase
        .from("profiles")
        .update({ role: role as never })
        .eq("id", staff.id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Role updated");
      void queryClient.invalidateQueries({ queryKey: ["staff"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <Select value={staff.role} onValueChange={(v) => update.mutate(v)}>
      <SelectTrigger className="w-56">
        <SelectValue placeholder={roleLabel(staff.role)} />
      </SelectTrigger>
      <SelectContent>
        {staff.role === "admin" ? (
          <SelectItem value="admin">{ROLE_LABELS["admin"]}</SelectItem>
        ) : null}
        {ASSIGNABLE_ROLES.map((r) => (
          <SelectItem key={r} value={r}>
            {ROLE_LABELS[r]}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}

/** Per-person exceptions: blank falls back to the role default. */
function OverrideMatrix({ staff }: { staff: Staff }) {
  const queryClient = useQueryClient();
  const { data: roleRows = [] } = useRolePermissions();
  const { data: overrides = [] } = useOverrides(staff.id);

  const save = useMutation({
    mutationFn: async (input: {
      module: ModuleKey;
      action: ActionKey;
      value: boolean | null;
    }) => {
      const column = actionColumn(input.action);
      const existing = overrides.find((o) => o.module === input.module);
      const next: Record<string, unknown> = {
        profile_id: staff.id,
        module: input.module,
        can_view: existing?.can_view ?? null,
        can_add: existing?.can_add ?? null,
        can_edit: existing?.can_edit ?? null,
        can_delete: existing?.can_delete ?? null,
      };
      next[column] = input.value;

      const allBlank = ACTIONS.every((a) => next[actionColumn(a)] == null);
      if (allBlank && existing) {
        const { error } = await supabase
          .from("user_permission_overrides")
          .delete()
          .eq("id", existing.id);
        if (error) throw error;
        return;
      }
      const { error } = await supabase
        .from("user_permission_overrides")
        .upsert(next as never, { onConflict: "profile_id,module" });
      if (error) throw error;
    },
    onSuccess: () =>
      void queryClient.invalidateQueries({ queryKey: ["permission-overrides", staff.id] }),
    onError: (e: Error) => toast.error(e.message),
  });

  function roleDefault(module: ModuleKey, action: ActionKey) {
    const row = roleRows.find((r) => r.role === staff.role && r.module === module);
    return Boolean(row?.[actionColumn(action)]);
  }

  function overrideValue(module: ModuleKey, action: ActionKey) {
    const row = overrides.find((o) => o.module === module);
    const v = row?.[actionColumn(action)];
    return v == null ? null : v;
  }

  if (isSuperAdminRole(staff.role)) {
    return (
      <section className="rounded-lg border bg-card p-5 shadow-panel">
        <h2 className="font-serif text-lg font-semibold">{staff.full_name}</h2>
        <p className="mt-1 text-sm text-muted-foreground">
          Super Admins always hold full access, so no exceptions can be set.
        </p>
      </section>
    );
  }

  return (
    <section className="rounded-lg border bg-card p-5 shadow-panel">
      <h2 className="font-serif text-lg font-semibold">
        {staff.full_name || staff.email} — individual permissions
      </h2>
      <p className="mt-1 text-sm text-muted-foreground">
        Ticking or clearing a box overrides the {roleLabel(staff.role)} default for this person
        only. Use “Reset” to fall back to the role default.
      </p>
      <div className="crest-rule mt-3 mb-4 w-16" />

      <div className="overflow-x-auto">
        <table className="w-full min-w-[640px] text-sm">
          <thead>
            <tr className="border-b bg-secondary/40 text-left">
              <th className="p-3 font-medium">Module</th>
              {ACTIONS.map((a) => (
                <th key={a} className="p-3 font-medium">
                  {ACTION_LABELS[a]}
                </th>
              ))}
              <th className="p-3" />
            </tr>
          </thead>
          <tbody>
            {MODULES.map((module) => {
              const hasOverride = ACTIONS.some((a) => overrideValue(module, a) != null);
              return (
                <tr key={module} className="border-b last:border-0">
                  <td className="p-3 font-medium">{MODULE_LABELS[module]}</td>
                  {ACTIONS.map((action) => {
                    const ov = overrideValue(module, action);
                    const effective = ov == null ? roleDefault(module, action) : ov;
                    return (
                      <td key={action} className="p-3">
                        <label className="flex items-center gap-2 text-xs">
                          <Checkbox
                            checked={effective}
                            onCheckedChange={(v) =>
                              save.mutate({ module, action, value: v === true })
                            }
                          />
                          <span className="text-muted-foreground">
                            {ov == null ? "role default" : "override"}
                          </span>
                        </label>
                      </td>
                    );
                  })}
                  <td className="p-3">
                    {hasOverride ? (
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() =>
                          ACTIONS.forEach((action) => save.mutate({ module, action, value: null }))
                        }
                      >
                        Reset
                      </Button>
                    ) : null}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </section>
  );
}

function NewStaffCard() {
  const queryClient = useQueryClient();
  const create = useServerFn(createStaffAccount);
  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [role, setRole] = useState<string>("teacher");
  const [password, setPassword] = useState(randomPassword);
  const [issued, setIssued] = useState<{ email: string; password: string } | null>(null);

  const submit = useMutation({
    mutationFn: async () =>
      create({
        data: {
          email: email.trim(),
          password,
          full_name: fullName.trim(),
          phone: phone.trim() || undefined,
          role: role as "teacher",
        },
      }),
    onSuccess: () => {
      toast.success("Staff account created");
      setIssued({ email: email.trim(), password });
      setFullName("");
      setEmail("");
      setPhone("");
      setPassword(randomPassword());
      void queryClient.invalidateQueries({ queryKey: ["staff"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <section className="rounded-lg border bg-card p-5 shadow-panel">
      <h2 className="font-serif text-lg font-semibold">Create a staff account</h2>
      <p className="mt-1 text-sm text-muted-foreground">
        The login is created here; hand the email and temporary password to the staff member.
      </p>
      <div className="crest-rule mt-3 mb-4 w-16" />

      <div className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-1.5">
          <Label htmlFor="s-name">Full name</Label>
          <Input id="s-name" value={fullName} onChange={(e) => setFullName(e.target.value)} />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="s-email">Email</Label>
          <Input
            id="s-email"
            type="email"
            autoComplete="off"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
          />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="s-phone">Phone</Label>
          <Input
            id="s-phone"
            inputMode="tel"
            placeholder="03XXXXXXXXX"
            value={phone}
            onChange={(e) => setPhone(e.target.value)}
          />
        </div>
        <div className="space-y-1.5">
          <Label>Role</Label>
          <Select value={role} onValueChange={setRole}>
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {ASSIGNABLE_ROLES.map((r) => (
                <SelectItem key={r} value={r}>
                  {ROLE_LABELS[r]}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-1.5 sm:col-span-2">
          <Label htmlFor="s-pass">Temporary password</Label>
          <div className="flex gap-2">
            <Input id="s-pass" value={password} onChange={(e) => setPassword(e.target.value)} />
            <Button type="button" variant="outline" onClick={() => setPassword(randomPassword())}>
              New
            </Button>
          </div>
        </div>
      </div>

      <Button
        className="mt-4"
        disabled={submit.isPending || !fullName.trim() || !email.trim() || password.length < 8}
        onClick={() => submit.mutate()}
      >
        <UserPlus className="mr-1.5 h-4 w-4" />
        {submit.isPending ? "Creating…" : "Create account"}
      </Button>

      {issued ? (
        <div className="mt-4 rounded-md border border-accent/40 bg-accent/10 p-3 text-sm">
          <p className="font-medium">Credentials issued</p>
          <p className="mt-1">Email: {issued.email}</p>
          <p>Password: {issued.password}</p>
          <p className="mt-1 text-xs text-muted-foreground">
            This password is shown once — note it before leaving this screen.
          </p>
        </div>
      ) : null}
    </section>
  );
}
