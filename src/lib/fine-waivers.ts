import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import { supabase } from "@/integrations/supabase/client";

export type FineWaiverEvent = {
  id: string;
  student_id: string;
  session_label: string;
  amount: number;
  fines_affected: number;
  reason: string | null;
  performed_by: string | null;
  created_at: string;
};

export type SessionEvent = {
  id: string;
  new_session_label: string;
  previous_session_label: string | null;
  start_date: string;
  archived_fine_count: number;
  archived_fine_amount: number;
  archived_absences: number;
  started_by: string | null;
  created_at: string;
};

/**
 * Waives absentee fines for the selected students in one session.
 * `amount` null waives everything outstanding, 0 restores the fines,
 * any other value waives up to that amount per student, oldest first.
 * Absence records themselves are never touched.
 */
export function useWaiveFines() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (input: {
      studentIds: string[];
      session: string;
      amount: number | null;
      reason?: string | null;
    }) => {
      const { error } = await supabase.rpc("waive_absentee_fines", {
        _student_ids: input.studentIds,
        _session: input.session,
        // null clears the whole outstanding fine; the SQL side accepts NULL here.
        _amount: input.amount as unknown as number,
        ...(input.reason ? { _reason: input.reason } : {}),
      });
      if (error) throw error;
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["absentee_fines"] });
      void queryClient.invalidateQueries({ queryKey: ["absentee-session-totals"] });
      void queryClient.invalidateQueries({ queryKey: ["fee_dues"] });
      void queryClient.invalidateQueries({ queryKey: ["fine_waiver_events"] });
    },
  });
}

export function useFineWaiverEvents(sessionLabel?: string | null) {
  return useQuery({
    queryKey: ["fine_waiver_events", sessionLabel ?? "all"],
    queryFn: async () => {
      let q = supabase
        .from("fine_waiver_events")
        .select(
          "id, student_id, session_label, amount, fines_affected, reason, performed_by, created_at",
        )
        .order("created_at", { ascending: false })
        .limit(200);
      if (sessionLabel) q = q.eq("session_label", sessionLabel);
      const { data, error } = await q;
      if (error) throw error;
      return (data ?? []) as FineWaiverEvent[];
    },
  });
}

/** Audit trail of every academic session that was started. */
export function useSessionEvents() {
  return useQuery({
    queryKey: ["session_events"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("session_events")
        .select(
          "id, new_session_label, previous_session_label, start_date, archived_fine_count, archived_fine_amount, archived_absences, started_by, created_at",
        )
        .order("created_at", { ascending: false });
      if (error) throw error;
      return (data ?? []) as SessionEvent[];
    },
  });
}
