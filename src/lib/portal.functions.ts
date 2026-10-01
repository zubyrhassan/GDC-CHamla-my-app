import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

/**
 * Portal passwords are the last 4 digits of the login ID. Supabase enforces a
 * 6 character minimum, so a fixed suffix is appended on both sides — families
 * only ever type the 4 digits.
 */
export const PORTAL_PASSWORD_SUFFIX = "-gdc";

export function portalPassword(loginId: string) {
  return `${loginId.slice(-4)}${PORTAL_PASSWORD_SUFFIX}`;
}

export function portalEmail(loginId: string, kind: "student" | "parent") {
  return `${loginId.toLowerCase()}@${kind}.gdcchamla.pk`;
}

const createInput = z.object({
  student_id: z.string().uuid(),
  login_id: z.string().min(5).max(32),
  kind: z.enum(["student", "parent"]),
});

/** Creates (or resets) the auth user behind a student/parent portal login. */
export const createPortalAccount = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) => createInput.parse(data))
  .handler(async ({ data, context }) => {
    const { data: allowed, error: permError } = await context.supabase.rpc("can", {
      _module: "students",
      _action: "add",
    });
    if (permError) throw new Error(permError.message);
    if (!allowed) throw new Error("You do not have permission to create portal logins.");

    const loginId = data.login_id.trim().toLowerCase();
    const email = portalEmail(loginId, data.kind);
    const password = portalPassword(loginId);

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    const { data: existingRow } = await supabaseAdmin
      .from("student_portal_accounts")
      .select("id, user_id")
      .eq("student_id", data.student_id)
      .eq("kind", data.kind)
      .maybeSingle();

    if (existingRow) {
      await supabaseAdmin.auth.admin.updateUserById(existingRow.user_id, { password });
      await supabaseAdmin
        .from("student_portal_accounts")
        .update({ login_id: loginId })
        .eq("id", existingRow.id);
      return { login_id: loginId, password: loginId.slice(-4), reset: true };
    }

    const created = await supabaseAdmin.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
      user_metadata: { portal: data.kind, login_id: loginId, student_id: data.student_id },
    });
    if (created.error || !created.data.user) {
      throw new Error(created.error?.message ?? "Could not create the portal login.");
    }

    const { error: insertError } = await supabaseAdmin.from("student_portal_accounts").insert({
      student_id: data.student_id,
      user_id: created.data.user.id,
      login_id: loginId,
      kind: data.kind,
    });
    if (insertError) {
      await supabaseAdmin.auth.admin.deleteUser(created.data.user.id);
      throw new Error(insertError.message);
    }

    return { login_id: loginId, password: loginId.slice(-4), reset: false };
  });

/** Removes a portal login and its auth user. */
export const deletePortalAccount = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) => z.object({ id: z.string().uuid() }).parse(data))
  .handler(async ({ data, context }) => {
    const { data: allowed, error: permError } = await context.supabase.rpc("can", {
      _module: "students",
      _action: "delete",
    });
    if (permError) throw new Error(permError.message);
    if (!allowed) throw new Error("You do not have permission to remove portal logins.");

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: row } = await supabaseAdmin
      .from("student_portal_accounts")
      .select("id, user_id")
      .eq("id", data.id)
      .maybeSingle();
    if (!row) return { ok: true };

    await supabaseAdmin.from("student_portal_accounts").delete().eq("id", row.id);
    await supabaseAdmin.auth.admin.deleteUser(row.user_id);
    return { ok: true };
  });
