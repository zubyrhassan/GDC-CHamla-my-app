import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

const roleEnum = z.enum(["super_admin", "principal", "coe", "coordinator", "clerk", "teacher"]);

const schema = z.object({
  email: z.string().email(),
  password: z.string().min(8),
  full_name: z.string().min(2),
  phone: z.string().optional(),
  role: roleEnum.default("teacher"),
});

/** Throws unless the caller is a Super Admin (legacy 'admin' counts). */
async function assertSuperAdmin(context: { supabase: any; userId: string }) {
  const { data: me, error } = await context.supabase
    .from("profiles")
    .select("role")
    .eq("id", context.userId)
    .maybeSingle();
  if (error) throw new Error(error.message);
  if (me?.role !== "super_admin" && me?.role !== "admin") {
    throw new Error("Only the Super Admin can manage staff accounts");
  }
}

/** Super-admin only: create a staff login. The credentials are handed over in person. */
export const createStaffAccount = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) => schema.parse(data))
  .handler(async ({ data, context }) => {
    await assertSuperAdmin(context);

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    const { data: created, error } = await supabaseAdmin.auth.admin.createUser({
      email: data.email,
      password: data.password,
      email_confirm: true,
      user_metadata: { full_name: data.full_name, phone: data.phone ?? null },
    });
    if (error) throw new Error(error.message);

    const userId = created.user?.id;
    if (!userId) throw new Error("Account was not created");

    const { error: profileErr } = await supabaseAdmin.from("profiles").upsert(
      {
        id: userId,
        full_name: data.full_name,
        phone: data.phone ?? null,
        role: data.role,
      },
      { onConflict: "id" },
    );
    if (profileErr) throw new Error(profileErr.message);

    return { id: userId, email: data.email };
  });

/** Super-admin only: staff list with the login email attached. */
export const listStaffAccounts = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await assertSuperAdmin(context);

    const { data: profiles, error } = await context.supabase
      .from("profiles")
      .select("id, full_name, role, phone, created_at")
      .order("full_name");
    if (error) throw new Error(error.message);

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: users } = await supabaseAdmin.auth.admin.listUsers({ page: 1, perPage: 1000 });
    const emailById = new Map((users?.users ?? []).map((u) => [u.id, u.email ?? ""]));

    return (profiles ?? []).map((p: any) => ({
      id: p.id as string,
      full_name: (p.full_name ?? "") as string,
      role: (p.role ?? "teacher") as string,
      phone: (p.phone ?? null) as string | null,
      created_at: p.created_at as string,
      email: emailById.get(p.id) ?? "",
    }));
  });
