import { useQuery } from "@tanstack/react-query";

import { supabase } from "@/integrations/supabase/client";

export type AbsenteeFine = {
  id: string;
  student_id: string;
  attendance_record_id: string;
  amount: number;
  date: string;
  lecture_number: number;
  session_label: string;
  waived_amount: number;
};

export const ABSENTEE_FEE_TYPE = "Absentee Fine";

/** Session-wide settings that drive absentee fining. */
export function useSessionSettings() {
  return useQuery({
    queryKey: ["session-settings"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("app_settings")
        .select("key, value")
        .in("key", ["absentee_fine_amount", "current_session_label", "session_start_date"]);
      if (error) throw error;
      const map = new Map((data ?? []).map((r) => [r.key, r.value] as const));
      return {
        fineAmount: Number(map.get("absentee_fine_amount") ?? 20),
        sessionLabel: map.get("current_session_label") ?? "Current session",
        sessionStart: map.get("session_start_date") ?? null,
      };
    },
  });
}

/** Every absentee fine raised in the current session. */
export function useAbsenteeFines(sessionLabel?: string | null) {
  return useQuery({
    queryKey: ["absentee_fines", sessionLabel ?? "all"],
    enabled: sessionLabel !== undefined,
    queryFn: async () => {
      let q = supabase
        .from("absentee_fines")
        .select("id, student_id, attendance_record_id, amount, date, lecture_number, session_label, waived_amount");
      if (sessionLabel) q = q.eq("session_label", sessionLabel);
      const { data, error } = await q;
      if (error) throw error;
      return (data ?? []) as AbsenteeFine[];
    },
  });
}

export type FineTotals = { absences: number; accrued: number; waived: number };

/** Absence count and fine amount per student for the loaded fines. */
export function fineTotalsByStudent(fines: AbsenteeFine[]) {
  const totals = new Map<string, FineTotals>();
  for (const f of fines) {
    const current = totals.get(f.student_id) ?? { absences: 0, accrued: 0, waived: 0 };
    const waived = Number(f.waived_amount || 0);
    current.absences += 1;
    current.waived += waived;
    current.accrued += Math.max(Number(f.amount || 0) - waived, 0);
    totals.set(f.student_id, current);
  }
  return totals;
}

export type SessionTotals = {
  session: string;
  absences: number;
  raised: number;
  paid: number;
  outstanding: number;
};

/**
 * Session-to-date absentee totals for every session on record: absences,
 * fines raised, amount collected against them and the outstanding balance.
 */
export function useSessionTotals() {
  return useQuery({
    queryKey: ["absentee-session-totals"],
    queryFn: async (): Promise<SessionTotals[]> => {
      const [finesRes, typeRes] = await Promise.all([
        supabase.from("absentee_fines").select("session_label, amount, waived_amount"),
        supabase.from("fee_types").select("id, name"),
      ]);
      if (finesRes.error) throw finesRes.error;
      if (typeRes.error) throw typeRes.error;

      const feeTypeId = (typeRes.data ?? []).find(
        (t) => t.name.toLowerCase() === ABSENTEE_FEE_TYPE.toLowerCase(),
      )?.id;

      const map = new Map<string, SessionTotals>();
      const entry = (session: string) => {
        const found = map.get(session) ?? {
          session,
          absences: 0,
          raised: 0,
          paid: 0,
          outstanding: 0,
        };
        map.set(session, found);
        return found;
      };

      for (const row of finesRes.data ?? []) {
        const e = entry(row.session_label);
        e.absences += 1;
        e.raised += Math.max(Number(row.amount || 0) - Number(row.waived_amount || 0), 0);
      }

      if (feeTypeId) {
        const { data: dues, error: duesError } = await supabase
          .from("fee_dues")
          .select("id, session_label")
          .eq("fee_type_id", feeTypeId);
        if (duesError) throw duesError;

        const dueIds = (dues ?? []).map((d) => d.id);
        if (dueIds.length > 0) {
          const { data: payments, error: payError } = await supabase
            .from("fee_transactions")
            .select("fee_due_id, amount")
            .in("fee_due_id", dueIds);
          if (payError) throw payError;

          const sessionByDue = new Map((dues ?? []).map((d) => [d.id, d.session_label] as const));
          for (const p of payments ?? []) {
            const session = p.fee_due_id ? sessionByDue.get(p.fee_due_id) : undefined;
            if (!session) continue;
            entry(session).paid += Number(p.amount || 0);
          }
        }
      }

      return [...map.values()]
        .map((e) => ({ ...e, outstanding: Math.max(0, e.raised - e.paid) }))
        .sort((a, b) => a.session.localeCompare(b.session));
    },
  });
}
