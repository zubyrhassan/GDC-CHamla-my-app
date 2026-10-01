import { useQuery } from "@tanstack/react-query";

import { supabase } from "@/integrations/supabase/client";

export type FeeDueStatus = "unpaid" | "partial" | "paid";

export type FeeDue = {
  id: string;
  student_id: string;
  fee_type_id: string | null;
  amount: number;
  due_date: string;
  session_label: string;
  status: FeeDueStatus;
  notes: string | null;
  created_at: string;
};

export const FEE_DUE_STATUS_LABELS: Record<FeeDueStatus, string> = {
  unpaid: "Unpaid",
  partial: "Partial",
  paid: "Paid",
};

/** All assigned fee dues across the college. */
export function useFeeDues() {
  return useQuery({
    queryKey: ["fee_dues"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("fee_dues")
        .select("*")
        .order("due_date", { ascending: false });
      if (error) throw error;
      return (data ?? []) as FeeDue[];
    },
  });
}

/** Default term label, e.g. "Fall 2026" for Aug–Dec, "Spring 2026" otherwise. */
export function defaultSessionLabel(date = new Date()) {
  const month = date.getMonth() + 1;
  return `${month >= 7 ? "Fall" : "Spring"} ${date.getFullYear()}`;
}

export function feeDueStatusClass(status: FeeDueStatus) {
  if (status === "paid") return "text-primary";
  if (status === "partial") return "text-accent-foreground";
  return "text-destructive";
}
