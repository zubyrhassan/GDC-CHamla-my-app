import { useQuery } from "@tanstack/react-query";

import { supabase } from "@/integrations/supabase/client";
import type { Student } from "@/lib/sms-types";

export type PortalKind = "student" | "parent";

export type PortalAccount = {
  id: string;
  student_id: string;
  user_id: string;
  login_id: string;
  kind: PortalKind;
  created_at: string;
};

/**
 * Login ID = registration year followed by the roll number digits,
 * e.g. registration 2026 + roll 503 -> "2026503". Parents get a "p" prefix.
 */
export function defaultLoginId(student: Pick<Student, "roll_number" | "session" | "admission_date">, kind: PortalKind) {
  const yearFromSession = (student.session ?? "").match(/(20\d{2})/)?.[1];
  const yearFromAdmission = (student.admission_date ?? "").slice(0, 4);
  const year = yearFromSession || yearFromAdmission || String(new Date().getFullYear());
  const roll = (student.roll_number ?? "").replace(/\D+/g, "") || "0";
  const base = `${year}${roll}`;
  return kind === "parent" ? `p${base}` : base;
}

/** Portal logins issued for one student (staff view). */
export function usePortalAccounts(studentId: string | null | undefined) {
  return useQuery({
    queryKey: ["portal-accounts", studentId],
    enabled: Boolean(studentId),
    queryFn: async () => {
      const { data, error } = await supabase
        .from("student_portal_accounts")
        .select("id, student_id, user_id, login_id, kind, created_at")
        .eq("student_id", studentId!);
      if (error) throw error;
      return (data ?? []) as PortalAccount[];
    },
  });
}

/** The portal account of the signed-in student/parent, if this is a portal session. */
export function useMyPortalAccount() {
  return useQuery({
    queryKey: ["my-portal-account"],
    queryFn: async () => {
      const { data: userData } = await supabase.auth.getUser();
      if (!userData.user) return null;
      const { data, error } = await supabase
        .from("student_portal_accounts")
        .select("id, student_id, user_id, login_id, kind, created_at")
        .eq("user_id", userData.user.id)
        .maybeSingle();
      if (error) throw error;
      return (data as PortalAccount | null) ?? null;
    },
  });
}
